import type { VisualLogicRule } from './logic-engine';
import type { ProjectFramework, VirtualProject } from './types';
import { scanElements } from './source-editor';
import {
  countAnimatedElementsInFiles,
  mergeMotionCssIntoGlobalCss,
} from './animation-studio';
import {
  decodeDataUrlToBytes,
  extractInlineBase64MediaFromFiles,
  isVirtualMediaDataUrlFile,
  listVirtualMediaAssets,
} from './media-pipeline';

export interface ProductionExportOptions {
  compileLogic: boolean;
  includeScrollRevealRuntime: boolean;
  extractInlineBase64Media: boolean;
}

export interface ProductionExportReport {
  compiledRulesCount: number;
  wiredElementCount: number;
  animatedElementCount: number;
  mediaAssetCount: number;
  extractedInlineMediaCount: number;
  bytesSavedFromInlineMedia: number;
  generatedFiles: string[];
  modifiedFiles: string[];
  binaryFiles: string[];
}

export interface CompiledProductionExport {
  textFiles: Record<string, string>;
  binaryFiles: Record<string, Uint8Array>;
  runtimePreviewCode: string;
  runtimePreviewPath: string;
  report: ProductionExportReport;
}

function parseStudioIdRef(ref: string): { filePath: string; elementIndex: number } | null {
  if (!ref || !ref.includes('::')) return null;
  const idx = ref.lastIndexOf('::');
  const filePath = ref.slice(0, idx);
  const elementIndex = Number(ref.slice(idx + 2));
  if (!filePath || !Number.isInteger(elementIndex) || elementIndex < 0) return null;
  return { filePath, elementIndex };
}

function makeStableWebdId(filePath: string, elementIndex: number): string {
  const cleanFile = filePath
    .replace(/\.(tsx|jsx|html|htm)$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `webd-${cleanFile || 'page'}-${elementIndex}`;
}

/**
 * Stamps `data-webd-id="..."` onto specific elements in TSX/JSX/HTML source
 * without shifting indices (injects in descending character offset order).
 */
export function stampWebdIdsInSource(
  source: string,
  isHtml: boolean,
  idByElementIndex: Map<number, string>
): string {
  if (idByElementIndex.size === 0) return source;
  const elements = scanElements(source, isHtml);
  const insertions: Array<{ pos: number; attr: string }> = [];

  for (const [elIdx, webdId] of idByElementIndex.entries()) {
    const el = elements[elIdx];
    if (!el) continue;
    const openTag = source.slice(el.openStart, el.openEnd);
    if (/\bdata-webd-id\s*=/.test(openTag)) continue;
    const insertPos = openTag.endsWith('/>') ? el.openEnd - 2 : el.openEnd - 1;
    const spacer = /\s/.test(source[insertPos - 1] || '') ? '' : ' ';
    insertions.push({ pos: insertPos, attr: `${spacer}data-webd-id="${webdId}"` });
  }

  insertions.sort((a, b) => b.pos - a.pos);
  let next = source;
  for (const ins of insertions) {
    next = next.slice(0, ins.pos) + ins.attr + next.slice(ins.pos);
  }
  return next;
}

function collectStudioRefsFromRules(rules: VisualLogicRule[]): Set<string> {
  const refs = new Set<string>();
  const nonElementActions = new Set([
    'toast',
    'navigate',
    'setState',
    'incrementState',
    'addToArray',
    'removeFromArray',
    'persistState',
    'loadState',
  ]);

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (parseStudioIdRef(rule.componentId)) refs.add(rule.componentId);
    if (!nonElementActions.has(rule.action) && parseStudioIdRef(rule.target)) {
      refs.add(rule.target);
    }
    if (rule.elseAction && !nonElementActions.has(rule.elseAction) && rule.elseTarget && parseStudioIdRef(rule.elseTarget)) {
      refs.add(rule.elseTarget);
    }
    if (Array.isArray(rule.flowNodes)) {
      for (const node of rule.flowNodes) {
        if (
          node.type === 'action' &&
          node.action &&
          !nonElementActions.has(node.action) &&
          node.target &&
          parseStudioIdRef(node.target)
        ) {
          refs.add(node.target);
        }
      }
    }
  }
  return refs;
}

function rewriteRulesWithStableIds(
  rules: VisualLogicRule[],
  studioToWebdId: Map<string, string>
): VisualLogicRule[] {
  const mapRef = (val: string | undefined): string => {
    if (!val) return '';
    return studioToWebdId.get(val) || val;
  };
  return rules
    .filter((r) => r.enabled !== false)
    .map((rule) => ({
      ...rule,
      componentId: mapRef(rule.componentId),
      target: mapRef(rule.target),
      elseTarget: rule.elseTarget ? mapRef(rule.elseTarget) : undefined,
      flowNodes: rule.flowNodes?.map((node) => ({
        ...node,
        target: node.target ? mapRef(node.target) : node.target,
      })),
    }));
}

function generateVanillaRuntimeBody(
  compiledRules: VisualLogicRule[],
  includeScrollReveal: boolean
): string {
  const rulesJson = JSON.stringify(compiledRules, null, 2);
  return `const COMPILED_RULES = ${rulesJson};
const INCLUDE_SCROLL_REVEAL = ${JSON.stringify(includeScrollReveal)};
const STORAGE_KEY = 'webd:app-state';

function getAppState() {
  if (typeof window === 'undefined') return {};
  const w = window;
  if (!w.__WEBD_APP_STATE__ || typeof w.__WEBD_APP_STATE__ !== 'object') {
    let restored = {};
    try {
      restored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {}
    w.__WEBD_APP_STATE__ = restored && typeof restored === 'object' ? restored : {};
  }
  return w.__WEBD_APP_STATE__;
}

function getStatePath(path) {
  let cursor = getAppState();
  for (const part of String(path || '').split('.').filter(Boolean)) {
    cursor = cursor && typeof cursor === 'object' ? cursor[part] : undefined;
  }
  return cursor;
}

function setControlValue(target, value) {
  const next = String(value == null ? '' : value);
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    target.value = next;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    target.textContent = next;
  }
}

function syncBindings() {
  document.querySelectorAll('[data-studio-bind]').forEach((node) => {
    const val = getStatePath(node.getAttribute('data-studio-bind') || '');
    if (val === undefined || val === null) return;
    const output = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
      setControlValue(node, output);
    } else {
      node.textContent = output;
    }
  });
}

function setStatePath(path, value) {
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return;
  let cursor = getAppState();
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getAppState()));
  } catch {}
  syncBindings();
  window.dispatchEvent(new CustomEvent('webd:state-change', { detail: getAppState() }));
}

function parseValue(raw) {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

function resolveTarget(target) {
  if (!target) return null;
  const key = String(target).trim().replace(/^#/, '');
  if (!key) return null;
  return (
    document.querySelector('[data-webd-id="' + key + '"]') ||
    document.getElementById(key)
  );
}

function getEventValue(event) {
  const el = event && event.target;
  if (!el) return '';
  if ('value' in el && el.value !== undefined) return String(el.value);
  return String(el.textContent || '').trim();
}

function getEventText(event) {
  const el = event && event.target;
  return el ? String(el.textContent || '').trim() : '';
}

function conditionMatches(rule, event) {
  const op = rule.conditionOperator || 'always';
  if (op === 'always') return true;
  const actual = getEventValue(event);
  const expected = typeof rule.conditionValue === 'string' ? rule.conditionValue : '';
  if (op === 'isEmpty') return actual.trim() === '';
  if (op === 'isNotEmpty') return actual.trim() !== '';
  if (op === 'equals') return actual === expected;
  if (op === 'notEquals') return actual !== expected;
  if (op === 'contains') return actual.toLowerCase().includes(expected.toLowerCase());
  if (op === 'greaterThan') return actual.trim() !== '' && Number(actual) > Number(expected);
  if (op === 'lessThan') return actual.trim() !== '' && Number(actual) < Number(expected);
  return true;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483000;max-width:min(360px,calc(100vw - 40px));padding:12px 16px;border-radius:10px;background:#0f172a;color:#fff;font:500 13px/1.45 system-ui,sans-serif;box-shadow:0 12px 30px rgba(15,23,42,.25);';
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function executeRule(rule, event, onNavigate) {
  if (!rule || rule.enabled === false) return;
  if (Array.isArray(rule.flowNodes) && rule.flowNodes.length > 0) {
    const byId = Object.fromEntries(rule.flowNodes.map((n) => [n.id, n]));
    const edges = Array.isArray(rule.flowEdges) ? rule.flowEdges : [];
    const visited = new Set();
    const walk = (id) => {
      if (!id || visited.has(id) || visited.size > 150) return;
      visited.add(id);
      const node = byId[id];
      if (!node) return;
      if (node.type === 'condition') {
        const passed = conditionMatches({ conditionOperator: node.conditionOperator || 'always', conditionValue: node.conditionValue || '' }, event);
        edges
          .filter((e) => e.from === id && ((String(e.label || '').toLowerCase() === 'true' || String(e.label || '').toLowerCase() === 'if true') === passed))
          .forEach((e) => walk(e.to));
        return;
      }
      if (node.type === 'action' && node.action) {
        executeRule({ ...rule, action: node.action, target: node.target || '', value: node.value || '', valueSource: node.valueSource || 'literal', flowNodes: undefined, flowEdges: undefined, conditionOperator: 'always', elseAction: undefined }, event, onNavigate);
      }
      edges.filter((e) => e.from === id).forEach((e) => walk(e.to));
    };
    edges.filter((e) => e.from === 'trigger').forEach((e) => walk(e.to));
    return;
  }

  let activeRule = rule;
  if (!conditionMatches(rule, event)) {
    if (!rule.elseAction) return;
    activeRule = { ...rule, action: rule.elseAction, target: rule.elseTarget || '', value: rule.elseValue || '', elseAction: undefined };
  }

  const stateActions = ['setState', 'incrementState', 'addToArray', 'removeFromArray', 'persistState', 'loadState'];
  const needsTarget = !['toast', 'navigate', ...stateActions].includes(activeRule.action);
  const target = needsTarget ? resolveTarget(activeRule.target) : null;
  if (needsTarget && !target) return;

  const sourceVal = activeRule.valueSource === 'eventValue'
    ? getEventValue(event)
    : activeRule.valueSource === 'eventText'
    ? getEventText(event)
    : String(activeRule.value || '');

  switch (activeRule.action) {
    case 'show':
      target.hidden = false;
      target.style.display = target.dataset.webdPrevDisplay || '';
      if (window.getComputedStyle(target).display === 'none') target.style.display = 'block';
      break;
    case 'hide':
      if (target.dataset.webdPrevDisplay === undefined) target.dataset.webdPrevDisplay = target.style.display || '';
      target.style.display = 'none';
      target.hidden = true;
      break;
    case 'toggle': {
      const hidden = target.hidden || window.getComputedStyle(target).display === 'none';
      if (hidden) {
        target.hidden = false;
        target.style.display = target.dataset.webdPrevDisplay || '';
        if (window.getComputedStyle(target).display === 'none') target.style.display = 'block';
      } else {
        target.dataset.webdPrevDisplay = target.style.display || '';
        target.style.display = 'none';
        target.hidden = true;
      }
      break;
    }
    case 'setText':
      target.textContent = String(activeRule.value || '');
      break;
    case 'setTextFromValue':
      target.textContent = sourceVal;
      break;
    case 'setValue':
      setControlValue(target, sourceVal);
      break;
    case 'increment':
    case 'decrement': {
      const cur = Number(('value' in target ? target.value : target.textContent) || 0) || 0;
      const step = Number(activeRule.value || 1) || 1;
      setControlValue(target, String(cur + (activeRule.action === 'increment' ? step : -step)));
      break;
    }
    case 'setState':
      setStatePath(activeRule.target, parseValue(activeRule.value));
      break;
    case 'incrementState': {
      const cur = Number(getStatePath(activeRule.target) || 0) || 0;
      const step = Number(activeRule.value || 1) || 1;
      setStatePath(activeRule.target, cur + step);
      break;
    }
    case 'addToArray': {
      const existing = getStatePath(activeRule.target);
      const next = Array.isArray(existing) ? [...existing] : [];
      next.push(parseValue(activeRule.value));
      setStatePath(activeRule.target, next);
      break;
    }
    case 'removeFromArray': {
      const existing = getStatePath(activeRule.target);
      const matchVal = parseValue(activeRule.value);
      const next = (Array.isArray(existing) ? existing : []).filter((item) => {
        if (item && typeof item === 'object' && matchVal && typeof matchVal === 'object' && matchVal.id !== undefined) {
          return String(item.id) !== String(matchVal.id);
        }
        return String(item) !== String(matchVal);
      });
      setStatePath(activeRule.target, next);
      break;
    }
    case 'persistState':
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getAppState())); } catch {}
      break;
    case 'loadState':
      try {
        window.__WEBD_APP_STATE__ = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
        syncBindings();
      } catch {}
      break;
    case 'navigate':
      if (activeRule.target) onNavigate(activeRule.target);
      break;
    case 'toast':
      showToast(String(activeRule.value || ''));
      break;
  }
}

function attachWebdRuntime(onNavigate) {
  const cleanups = [];
  syncBindings();

  if (COMPILED_RULES.length > 0) {
    const triggerToDomEvent = {
      onClick: 'click',
      onChange: 'change',
      onInput: 'input',
      onSubmit: 'submit',
      onMouseEnter: 'mouseover',
      onFocus: 'focusin',
      onBlur: 'focusout',
    };
    const activeTriggers = Array.from(new Set(COMPILED_RULES.map((r) => r.trigger)));
    for (const trigger of activeTriggers) {
      const domEvent = triggerToDomEvent[trigger];
      if (!domEvent) continue;
      const listener = (event) => {
        const el = event.target && event.target.closest ? event.target.closest('[data-webd-id]') : null;
        if (!el) return;
        const id = el.getAttribute('data-webd-id');
        if (!id) return;
        for (const rule of COMPILED_RULES) {
          if (rule.trigger !== trigger || rule.componentId !== id) continue;
          if (trigger === 'onSubmit') event.preventDefault();
          executeRule(rule, event, onNavigate);
        }
      };
      document.addEventListener(domEvent, listener, true);
      cleanups.push(() => document.removeEventListener(domEvent, listener, true));
    }
  }

  if (INCLUDE_SCROLL_REVEAL && typeof IntersectionObserver !== 'undefined') {
    const revealNodes = Array.from(document.querySelectorAll('.webd-reveal, .webd-stagger-children'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('webd-in-view');
            if (!entry.target.classList.contains('webd-reveal-repeat')) {
              observer.unobserve(entry.target);
            }
          } else if (entry.target.classList.contains('webd-reveal-repeat')) {
            entry.target.classList.remove('webd-in-view');
          }
        });
      },
      { threshold: 0.12 }
    );
    revealNodes.forEach((node) => observer.observe(node));
    cleanups.push(() => observer.disconnect());
  }

  return () => cleanups.forEach((fn) => fn());
}`;
}

export function generateReactProductionRuntimeSource(
  compiledRules: VisualLogicRule[],
  includeScrollReveal: boolean,
  framework: ProjectFramework
): string {
  const isNextApp = framework === 'nextjs-app';
  const body = generateVanillaRuntimeBody(compiledRules, includeScrollReveal);
  const routerImport = isNextApp ? `import { useRouter } from 'next/navigation';\n` : '';
  const routerInit = isNextApp
    ? `  const router = useRouter();\n`
    : '';
  const navHandler = isNextApp
    ? `(route: string) => router.push(route)`
    : `(route: string) => { window.location.assign(route); }`;

  return `'use client';

/**
 * Auto-generated by Atelier Studio Production Export Compiler.
 * Compiles visual Logic Builder rules (${compiledRules.length}) and Scroll-Reveal animations
 * into a standalone zero-dependency React runtime.
 */
import { useEffect, useState } from 'react';
${routerImport}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const __WEBD_RUNTIME__ = (() => {
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
  return { attachWebdRuntime, getAppState, setStatePath };
})();

export function useWebdAppState<T = Record<string, unknown>>() {
  const [state, setState] = useState<T>(() => __WEBD_RUNTIME__.getAppState() as T);
  useEffect(() => {
    const sync = () => setState({ ...(__WEBD_RUNTIME__.getAppState() as Record<string, unknown>) } as T);
    window.addEventListener('webd:state-change', sync);
    return () => window.removeEventListener('webd:state-change', sync);
  }, []);
  return [state, __WEBD_RUNTIME__.setStatePath] as const;
}

export default function WebdProductionRuntime() {
${routerInit}  useEffect(() => {
    return __WEBD_RUNTIME__.attachWebdRuntime(${navHandler});
  }, [${isNextApp ? 'router' : ''}]);

  return null;
}
`;
}

export function generateHtmlProductionRuntimeSource(
  compiledRules: VisualLogicRule[],
  includeScrollReveal: boolean
): string {
  const body = generateVanillaRuntimeBody(compiledRules, includeScrollReveal);
  return `/* Auto-generated by Atelier Studio Production Export Compiler */
(function () {
${body
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}

  function boot() {
    attachWebdRuntime(function (route) {
      window.location.assign(route);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
`;
}

function mountRuntimeInReactLayoutOrPages(
  textFiles: Record<string, string>,
  runtimePath: string,
  framework: ProjectFramework
): string[] {
  const modified: string[] = [];
  const runtimeImportFromRoot = runtimePath.replace(/^src\//, '@/').replace(/\.tsx$/, '');
  const relativeFrom = (fromFile: string, toFile: string): string => {
    const fromParts = fromFile.split('/').slice(0, -1).filter(Boolean);
    const toParts = toFile.replace(/\.tsx$/, '').split('/').filter(Boolean);
    while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
      fromParts.shift();
      toParts.shift();
    }
    const rel = [...fromParts.map(() => '..'), ...toParts].join('/');
    return rel.startsWith('.') ? rel : `./${rel}`;
  };

  const layoutCandidates =
    framework === 'nextjs-app'
      ? ['app/layout.tsx', 'app/layout.jsx', 'src/app/layout.tsx', 'src/app/layout.jsx']
      : framework === 'nextjs-pages'
      ? ['pages/_app.tsx', 'pages/_app.jsx', 'src/pages/_app.tsx', 'src/pages/_app.jsx']
      : ['src/App.tsx', 'src/App.jsx'];

  const layoutPath = layoutCandidates.find((p) => Boolean(textFiles[p]));
  if (layoutPath) {
    let code = textFiles[layoutPath];
    if (!code.includes('WebdProductionRuntime')) {
      const importPath = relativeFrom(layoutPath, runtimePath);
      const importStmt = `import WebdProductionRuntime from '${importPath}';\n`;
      if (/^['"]use client['"];?/.test(code.trimStart())) {
        code = code.replace(/^(\s*['"]use client['"];?\s*\n?)/, `$1${importStmt}`);
      } else {
        code = importStmt + code;
      }
      if (code.includes('{children}')) {
        code = code.replace('{children}', '<WebdProductionRuntime />\n        {children}');
      } else if (/<\/body>/i.test(code)) {
        code = code.replace(/<\/body>/i, '  <WebdProductionRuntime />\n      </body>');
      } else if (/<Component\b/.test(code)) {
        code = code.replace(/(<Component\b[^>]*\/>)/, '<><WebdProductionRuntime />$1</>');
      }
      textFiles[layoutPath] = code;
      modified.push(layoutPath);
    }
    return modified;
  }

  // Fallback: mount inside each TSX/JSX page file
  for (const [path, code] of Object.entries(textFiles)) {
    if (!/^(?:src\/)?(?:app|pages)\/.*\.(?:tsx|jsx)$/i.test(path)) continue;
    if (code.includes('WebdProductionRuntime')) continue;
    const importPath = runtimePath.startsWith('src/') ? runtimeImportFromRoot : relativeFrom(path, runtimePath);
    const importStmt = `import WebdProductionRuntime from '${importPath}';\n`;
    let next = /^['"]use client['"];?/.test(code.trimStart())
      ? code.replace(/^(\s*['"]use client['"];?\s*\n?)/, `$1${importStmt}`)
      : importStmt + code;
    const elements = scanElements(next, false);
    const rootEl = elements[0];
    if (rootEl && !rootEl.selfClosing && rootEl.closeStart > rootEl.openEnd) {
      next =
        next.slice(0, rootEl.openEnd) +
        '\n      <WebdProductionRuntime />' +
        next.slice(rootEl.openEnd);
      textFiles[path] = next;
      modified.push(path);
    }
  }
  return modified;
}

export function compileProjectForProductionExport(
  project: VirtualProject,
  logicRules: VisualLogicRule[],
  options: ProductionExportOptions
): CompiledProductionExport {
  let workingFiles: Record<string, string> = { ...project.files };
  let extractedInlineMediaCount = 0;
  let bytesSavedFromInlineMedia = 0;

  // 1. Clean Media Pipeline: extract any lingering inline base64 data URLs to public/assets/
  if (options.extractInlineBase64Media) {
    const extraction = extractInlineBase64MediaFromFiles(workingFiles, project.framework);
    workingFiles = extraction.files;
    extractedInlineMediaCount = extraction.extractedCount;
    bytesSavedFromInlineMedia = extraction.bytesSavedInCode;
  }

  // 2. Separate binary virtual assets (public/assets/* or assets/*) from text source files
  const textFiles: Record<string, string> = {};
  const binaryFiles: Record<string, Uint8Array> = {};
  const binaryFilePaths: string[] = [];

  for (const [path, content] of Object.entries(workingFiles)) {
    if (isVirtualMediaDataUrlFile(path, content)) {
      const decoded = decodeDataUrlToBytes(content);
      if (decoded) {
        binaryFiles[path] = decoded.bytes;
        binaryFilePaths.push(path);
        continue;
      }
    }
    textFiles[path] = content;
  }

  const animCounts = countAnimatedElementsInFiles(textFiles);
  const needsScrollReveal = options.includeScrollRevealRuntime && animCounts.revealCount > 0;
  const activeRules = options.compileLogic ? logicRules.filter((r) => r.enabled !== false) : [];
  const needsRuntime = activeRules.length > 0 || needsScrollReveal;

  const generatedFiles: string[] = [];
  const modifiedFiles = new Set<string>();

  // 3. Ensure motion CSS is present in global CSS if animated elements exist
  if (animCounts.total > 0) {
    const cssPath =
      project.globalCssPaths.find((p) => Boolean(textFiles[p])) ||
      Object.keys(textFiles).find((p) => /\.css$/i.test(p));
    if (cssPath && textFiles[cssPath] !== undefined) {
      const nextCss = mergeMotionCssIntoGlobalCss(textFiles[cssPath]);
      if (nextCss !== textFiles[cssPath]) {
        textFiles[cssPath] = nextCss;
        modifiedFiles.add(cssPath);
      }
    }
  }

  // 4. Stamp stable `data-webd-id` attributes on referenced Logic elements
  const studioRefs = options.compileLogic ? collectStudioRefsFromRules(activeRules) : new Set<string>();
  const studioToWebdId = new Map<string, string>();
  const idsByFile = new Map<string, Map<number, string>>();

  for (const ref of studioRefs) {
    const parsed = parseStudioIdRef(ref);
    if (!parsed || !textFiles[parsed.filePath]) continue;
    const stableId = makeStableWebdId(parsed.filePath, parsed.elementIndex);
    studioToWebdId.set(ref, stableId);
    if (!idsByFile.has(parsed.filePath)) {
      idsByFile.set(parsed.filePath, new Map());
    }
    idsByFile.get(parsed.filePath)!.set(parsed.elementIndex, stableId);
  }

  for (const [filePath, indexMap] of idsByFile.entries()) {
    const isHtml = /\.html?$/i.test(filePath);
    const stamped = stampWebdIdsInSource(textFiles[filePath], isHtml, indexMap);
    if (stamped !== textFiles[filePath]) {
      textFiles[filePath] = stamped;
      modifiedFiles.add(filePath);
    }
  }

  const compiledRules = rewriteRulesWithStableIds(activeRules, studioToWebdId);

  // 5. Generate standalone React or HTML runtime & wire it in
  let runtimePreviewCode = '';
  let runtimePreviewPath = '';

  if (project.framework === 'html') {
    runtimePreviewPath = 'assets/webd-runtime.js';
    runtimePreviewCode = generateHtmlProductionRuntimeSource(compiledRules, needsScrollReveal);
    if (needsRuntime) {
      textFiles[runtimePreviewPath] = runtimePreviewCode;
      generatedFiles.push(runtimePreviewPath);
      for (const [path, html] of Object.entries(textFiles)) {
        if (!/\.html?$/i.test(path)) continue;
        if (html.includes('webd-runtime.js')) continue;
        const scriptTag = '  <script src="./assets/webd-runtime.js" defer></script>\n';
        const nextHtml = /<\/body>/i.test(html)
          ? html.replace(/<\/body>/i, `${scriptTag}</body>`)
          : `${html}\n${scriptTag}`;
        textFiles[path] = nextHtml;
        modifiedFiles.add(path);
      }
    }
  } else {
    const compRoot =
      project.framework === 'react-vite' ||
      Object.keys(textFiles).some((p) => p.startsWith('src/components/'))
        ? 'src/components'
        : 'components';
    runtimePreviewPath = `${compRoot}/WebdProductionRuntime.tsx`;
    runtimePreviewCode = generateReactProductionRuntimeSource(
      compiledRules,
      needsScrollReveal,
      project.framework
    );
    if (needsRuntime) {
      textFiles[runtimePreviewPath] = runtimePreviewCode;
      generatedFiles.push(runtimePreviewPath);
      const mountedIn = mountRuntimeInReactLayoutOrPages(
        textFiles,
        runtimePreviewPath,
        project.framework
      );
      mountedIn.forEach((p) => modifiedFiles.add(p));
    }
  }

  const virtualMedia = listVirtualMediaAssets(workingFiles);

  return {
    textFiles,
    binaryFiles,
    runtimePreviewCode,
    runtimePreviewPath,
    report: {
      compiledRulesCount: compiledRules.length,
      wiredElementCount: studioToWebdId.size,
      animatedElementCount: animCounts.total,
      mediaAssetCount: virtualMedia.length,
      extractedInlineMediaCount,
      bytesSavedFromInlineMedia,
      generatedFiles,
      modifiedFiles: Array.from(modifiedFiles).sort(),
      binaryFiles: binaryFilePaths.sort(),
    },
  };
}
