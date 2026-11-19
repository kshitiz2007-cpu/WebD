import { transform } from 'sucrase';
import { instrumentSourceWithStudioIds } from './source-editor';
import { ProjectPage, VirtualProject } from './types';

function resolveVirtualModulePath(
  fromFile: string,
  specifier: string,
  files: Record<string, string>
): string | null {
  let candidateBase = '';
  if (specifier.startsWith('@/')) {
    const rest = specifier.slice(2);
    // Support both root `@/` and `src/` alias convention
    if (hasFileCandidate(rest, files)) {
      candidateBase = rest;
    } else if (hasFileCandidate(`src/${rest}`, files)) {
      candidateBase = `src/${rest}`;
    } else {
      candidateBase = rest;
    }
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const dirParts = fromFile.split('/').slice(0, -1);
    const relParts = specifier.split('/');
    for (const part of relParts) {
      if (part === '.' || part === '') continue;
      if (part === '..') dirParts.pop();
      else dirParts.push(part);
    }
    candidateBase = dirParts.join('/');
  } else {
    return null;
  }

  const exts = ['', '.tsx', '.ts', '.jsx', '.js', '.json', '.css', '.module.css', '.scss', '.sass', '.less', '/index.tsx', '/index.ts', '/index.jsx', '/index.js', '/index.css'];
  for (const ext of exts) {
    const full = candidateBase + ext;
    if (files[full] !== undefined) return full;
  }
  return null;
}

function hasFileCandidate(base: string, files: Record<string, string>): boolean {
  const exts = ['', '.tsx', '.ts', '.jsx', '.js', '.json', '.css', '.module.css', '.scss', '.sass', '.less', '/index.tsx', '/index.ts', '/index.jsx', '/index.js', '/index.css'];
  return exts.some((ext) => files[base + ext] !== undefined);
}

function collectImportedStyles(
  files: Record<string, string>,
  sourceEntries: Array<[string, string]>
): { css: string; cssModules: Record<string, Record<string, string>> } {
  const visited = new Set<string>();
  const cssParts: string[] = [];
  const cssModules: Record<string, Record<string, string>> = {};
  const pending: Array<{ from: string; specifier: string }> = [];
  const importPattern = /(?:from\s*|import\s*)['"]([^'"]+)['"]/g;

  for (const [filePath, source] of sourceEntries) {
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(source)) !== null) {
      if (match[1].startsWith('.') || match[1].startsWith('@/')) pending.push({ from: filePath, specifier: match[1] });
    }
  }

  while (pending.length) {
    const item = pending.shift()!;
    const resolved = resolveVirtualModulePath(item.from, item.specifier, files);
    if (!resolved || visited.has(resolved) || !/\.(?:css|scss|sass|less)$/i.test(resolved)) continue;
    visited.add(resolved);
    const content = files[resolved] || '';
    if (!content.trim()) continue;

    if (/\.module\.css$/i.test(resolved)) {
      const names = new Set<string>();
      const classPattern = /\.([_a-zA-Z][\w-]*)/g;
      let classMatch: RegExpExecArray | null;
      while ((classMatch = classPattern.exec(content)) !== null) names.add(classMatch[1]);
      cssModules[resolved] = Object.fromEntries([...names].map((name) => [name, name]));
      cssParts.push(content);
    } else {
      cssParts.push(content.replace(/@import\s+["']tailwindcss["']\s*;/g, ''));
    }

    const nestedPattern = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?/g;
    let nested: RegExpExecArray | null;
    while ((nested = nestedPattern.exec(content)) !== null) {
      if (nested[1].startsWith('.') || nested[1].startsWith('@/')) pending.push({ from: resolved, specifier: nested[1] });
    }
  }

  // React Bits CircularCarousel uses height: 100% on its root. When it is
  // inserted as a sibling in a page, its parent often has no explicit height,
  // so the carousel collapses to 0px and appears to have failed to render.
  // Give this known full-height visual component a responsive standalone size.
  if (cssParts.some((css) => /\\.circular-carousel\\s*\\{/.test(css))) {
    cssParts.push(
      '.circular-carousel { width: 100%; min-height: 420px; height: min(70vh, 620px); }'
    );
  }

  return { css: cssParts.join('\n'), cssModules };
}

export interface CompiledPreviewBundle {
  html: string;
  compileErrors: string[];
}

function escapeScriptClose(str: string): string {
  return str.replace(/<\/script>/gi, '<\\/script>');
}

function buildDesignerBridgeScript(activeRoute: string, interactionMode: 'design' | 'interact'): string {
  return `
(function() {
  var CURRENT_MODE = ${JSON.stringify(interactionMode)};
  var ACTIVE_ROUTE = ${JSON.stringify(activeRoute)};
  var SELECTED_ID = null;
  var HOVER_ID = null;
  var EDITING_EL = null;
  var ACTIVE_PREVIEW_RECORDS = [];
  var LOGIC_RULES = [];
  var LOGIC_EXECUTING = false;

  function resolveLogicTarget(target) {
    if (!target || typeof target !== 'string') return null;
    var key = target.trim();
    if (!key) return null;
    if (key.charAt(0) === '#') key = key.slice(1);
    var byId = document.getElementById(key);
    if (byId) return byId;
    return findStudioElement(key);
  }

  function getEventValue(event) {
    var el = event && event.target;
    if (!el) return '';
    if (el.value !== undefined) return String(el.value);
    return String(el.textContent || '').trim();
  }
  function getEventText(event) {
    var el = event && event.target;
    return el ? String(el.textContent || '').trim() : '';
  }
  function conditionMatches(rule, event) {
    var op = rule.conditionOperator || 'always';
    if (op === 'always') return true;
    var actual = getEventValue(event);
    var expected = typeof rule.conditionValue === 'string' ? rule.conditionValue : '';
    if (op === 'isEmpty') return actual.trim() === '';
    if (op === 'isNotEmpty') return actual.trim() !== '';
    if (op === 'equals') return actual === expected;
    if (op === 'notEquals') return actual !== expected;
    if (op === 'contains') return actual.toLowerCase().indexOf(expected.toLowerCase()) !== -1;
    if (op === 'greaterThan') return actual.trim() !== '' && Number(actual) > Number(expected);
    if (op === 'lessThan') return actual.trim() !== '' && Number(actual) < Number(expected);
    return true;
  }
  function setControlValue(target, value) {
    var next = String(value == null ? '' : value);
    var proto = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : target.tagName === 'SELECT' ? HTMLSelectElement.prototype
      : target.tagName === 'INPUT' ? HTMLInputElement.prototype
      : null;
    if (proto) {
      var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) descriptor.set.call(target, next);
      else target.value = next;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    } else target.textContent = next;
  }
  function runLogicRule(rule, event) {
    if (!rule || rule.enabled === false || !conditionMatches(rule, event)) return;
    var needsTarget = ['toast', 'navigate'].indexOf(rule.action) === -1;
    var target = needsTarget ? resolveLogicTarget(rule.target) : null;
    if (needsTarget && !target) {
      window.parent.postMessage({ type: 'studio:logic-warning', message: 'Logic target not found: ' + (rule.target || '(empty)') }, '*');
      return;
    }
    var sourceValue = rule.valueSource === 'eventValue' ? getEventValue(event)
      : rule.valueSource === 'eventText' ? getEventText(event)
      : (typeof rule.value === 'string' ? rule.value : '');
    if (rule.action === 'show') {
      var showDisplay = target.dataset.studioLogicDisplay;
      target.hidden = false;
      target.style.display = showDisplay && showDisplay !== 'none' ? showDisplay : '';
      delete target.dataset.studioLogicDisplay;
      if (window.getComputedStyle(target).display === 'none') target.style.display = 'block';
    } else if (rule.action === 'hide') {
      if (target.dataset.studioLogicDisplay === undefined) target.dataset.studioLogicDisplay = target.style.display || '';
      target.style.display = 'none';
      target.hidden = true;
    } else if (rule.action === 'toggle') {
      var isHidden = target.hidden || window.getComputedStyle(target).display === 'none';
      if (isHidden) {
        var restoreDisplay = target.dataset.studioLogicDisplay;
        target.hidden = false;
        target.style.display = restoreDisplay && restoreDisplay !== 'none' ? restoreDisplay : '';
        delete target.dataset.studioLogicDisplay;
        if (window.getComputedStyle(target).display === 'none') target.style.display = 'block';
      } else {
        target.dataset.studioLogicDisplay = target.style.display || '';
        target.style.display = 'none';
        target.hidden = true;
      }
    } else if (rule.action === 'setText') {
      target.textContent = typeof rule.value === 'string' ? rule.value : '';
    } else if (rule.action === 'setTextFromValue') {
      target.textContent = sourceValue;
    } else if (rule.action === 'setValue') {
      setControlValue(target, sourceValue);
    } else if (rule.action === 'increment' || rule.action === 'decrement') {
      var current = Number(('value' in target ? target.value : target.textContent) || 0);
      var step = Number(rule.value || 1);
      if (!Number.isFinite(step)) step = 1;
      if (!Number.isFinite(current)) current = 0;
      setControlValue(target, String(current + (rule.action === 'increment' ? step : -step)));
    } else if (rule.action === 'navigate') {
      if (typeof rule.target === 'string' && rule.target) window.parent.postMessage({ type: 'studio:navigate', route: rule.target }, '*');
    } else if (rule.action === 'toast') {
      var toast = document.createElement('div');
      toast.textContent = typeof rule.value === 'string' ? rule.value : '';
      toast.setAttribute('role', 'status');
      toast.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483000;max-width:min(360px,calc(100vw - 40px));padding:12px 16px;border-radius:10px;background:#0f172a;color:#fff;font:500 13px/1.45 system-ui,sans-serif;box-shadow:0 12px 30px rgba(15,23,42,.25);';
      document.body.appendChild(toast);
      window.setTimeout(function() { toast.remove(); }, 2600);
    }
  }
  function runLogicForEvent(trigger, event) {
    if (CURRENT_MODE !== 'interact' || LOGIC_EXECUTING) return;
    var seeds = [event.target];
    if (trigger === 'onSubmit' && event.submitter) seeds.push(event.submitter);
    var matched = [];
    seeds.forEach(function(seed) {
      var node = seed && seed.closest ? seed.closest('[data-studio-id], [data-studio-instance]') : null;
      var cursor = node;
      while (cursor && cursor !== document.documentElement) {
        var id = cursor.getAttribute && cursor.getAttribute('data-studio-id');
        var instanceId = cursor.getAttribute && cursor.getAttribute('data-studio-instance');
        if (id && !matched.some(function(entry) { return entry.id === id; })) matched.push({ id: id, node: cursor });
        if (instanceId && !matched.some(function(entry) { return entry.id === instanceId; })) matched.push({ id: instanceId, node: cursor });
        cursor = cursor.parentElement;
      }
    });
    if (!matched.length) return;
    LOGIC_EXECUTING = true;
    try {
      LOGIC_RULES.forEach(function(rule) {
        if (!rule || rule.enabled === false || rule.trigger !== trigger) return;
        var owner = matched.find(function(entry) { return entry.id === rule.componentId; });
        if (!owner) return;
        if (trigger === 'onMouseEnter' && event.relatedTarget && owner.node.contains(event.relatedTarget)) return;
        runLogicRule(rule, event);
      });
    } finally {
      LOGIC_EXECUTING = false;
    }
  }
  // Receive layout blocks dragged from the parent builder palette into the preview iframe.
  document.addEventListener('dragover', function(event) {
    var types = event.dataTransfer && Array.from(event.dataTransfer.types || []);
    if (types && types.indexOf('application/x-webd-layout-block') !== -1) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }
  }, true);
  document.addEventListener('drop', function(event) {
    var transfer = event.dataTransfer;
    var snippet = transfer && (transfer.getData('application/x-webd-layout-block') || transfer.getData('text/plain'));
    if (!snippet || snippet.indexOf('<') === -1 || snippet.length > 12000) return;
    event.preventDefault();
    var target = event.target && event.target.closest ? event.target.closest('[data-studio-id]') : null;
    var studioId = target && target.getAttribute('data-studio-id');
    window.parent.postMessage({ type: 'studio:layout-drop', snippet: snippet, studioId: studioId || null }, '*');
  }, true);
  document.addEventListener('focusin', function(event) { runLogicForEvent('onFocus', event); }, true);
  document.addEventListener('focusout', function(event) { runLogicForEvent('onBlur', event); }, true);
  document.addEventListener('input', function(event) { runLogicForEvent('onInput', event); }, true);
  document.addEventListener('click', function(event) { runLogicForEvent('onClick', event); }, true);
  document.addEventListener('change', function(event) { runLogicForEvent('onChange', event); }, true);
  // Treat Enter in a standalone input as a submit action too. Search fields are
  // often not wrapped in a native <form>, so the regular submit event never fires.
  document.addEventListener('keydown', function(event) {
    var field = event.target;
    if (event.key !== 'Enter' || !field || !field.matches ||
        !field.matches('input:not([type="button"]):not([type="submit"]), select')) return;
    runLogicForEvent('onSubmit', event);
    if (CURRENT_MODE !== 'interact') return;
    var ids = [];
    var cursor = field;
    while (cursor && cursor !== document.documentElement) {
      var id = cursor.getAttribute && cursor.getAttribute('data-studio-id');
      var instanceId = cursor.getAttribute && cursor.getAttribute('data-studio-instance');
      if (id) ids.push(id);
      if (instanceId) ids.push(instanceId);
      cursor = cursor.parentElement;
    }
    if (LOGIC_RULES.some(function(rule) {
      return rule && rule.enabled !== false && rule.trigger === 'onSubmit' &&
        ids.indexOf(rule.componentId) !== -1 && conditionMatches(rule, event);
    })) event.preventDefault();
  }, true);
  document.addEventListener('submit', function(event) {
    var form = event.target;
    var sid = form && form.getAttribute ? form.getAttribute('data-studio-id') : null;
    runLogicForEvent('onSubmit', event);
    if (CURRENT_MODE === 'interact') {
      var formIds = [];
      var formCursor = form;
      while (formCursor && formCursor !== document.documentElement) {
        var formId = formCursor.getAttribute && formCursor.getAttribute('data-studio-id');
        var formInstanceId = formCursor.getAttribute && formCursor.getAttribute('data-studio-instance');
        if (formId) formIds.push(formId);
        if (formInstanceId) formIds.push(formInstanceId);
        formCursor = formCursor.parentElement;
      }
      if (LOGIC_RULES.some(function(rule) {
        return rule && rule.enabled !== false && rule.trigger === 'onSubmit' && formIds.indexOf(rule.componentId) !== -1 && conditionMatches(rule, event);
      })) event.preventDefault();
    }
  }, true);
  document.addEventListener('mouseover', function(event) {
    if (event.relatedTarget && event.target && event.target.contains && event.target.contains(event.relatedTarget)) return;
    runLogicForEvent('onMouseEnter', event);
  }, true);
  var LOCKED_IDS = {};
  var HIDDEN_IDS = {};
  var ACTIVE_PSEUDO_ID = null;
  var ACTIVE_PSEUDO_MODE = 'default';
  window.__STUDIO_REACT_OWNED_STYLES__ = window.__STUDIO_REACT_OWNED_STYLES__ || {};

  function getOrCreateStyleTag(id) {
    var existing = document.getElementById(id);
    if (existing) return existing;
    var el = document.createElement('style');
    el.id = id;
    (document.head || document.documentElement).appendChild(el);
    return el;
  }

  function applyLayerStateCss() {
    var rules = [];
    Object.keys(HIDDEN_IDS).forEach(function(sid) {
      if (HIDDEN_IDS[sid]) {
        rules.push('[data-studio-id="' + CSS.escape(sid) + '"] { visibility: hidden !important; pointer-events: none !important; }');
      }
    });
    var tag = getOrCreateStyleTag('studio-layer-state-css');
    tag.textContent = rules.join('\\n');
  }

  function applyPseudoPreview(sid, mode) {
    var prev = document.querySelectorAll('[data-studio-pseudo]');
    for (var i = 0; i < prev.length; i++) {
      prev[i].removeAttribute('data-studio-pseudo');
    }
    ACTIVE_PSEUDO_ID = sid || null;
    ACTIVE_PSEUDO_MODE = mode || 'default';
    var pseudoTag = getOrCreateStyleTag('studio-pseudo-css');
    if (!sid || !mode || mode === 'default') {
      pseudoTag.textContent = '';
      return;
    }
    var targetEl = findStudioElement(sid);
    if (targetEl) {
      targetEl.setAttribute('data-studio-pseudo', mode);
    }
    var twCss = (document.getElementById('studio-tailwind-css') || {}).textContent || '';
    var userCss = (document.getElementById('studio-user-css') || {}).textContent || '';
    var combined = twCss + '\\n' + userCss;
    var out = [];
    var re = new RegExp('([^{}\\\\n]+:' + mode + '(?:\\\\([^)]*\\\\))?[^{}]*)\\\\{([^}]+)\\\\}', 'g');
    var m;
    while ((m = re.exec(combined)) !== null && out.length < 180) {
      var rewrittenSel = m[1].replace(new RegExp(':' + mode + '(?!\\\\w)', 'g'), '[data-studio-pseudo="' + mode + '"]');
      out.push(rewrittenSel + ' {' + m[2] + '}');
    }
    pseudoTag.textContent = out.join('\\n');
  }

  function findSelectableTarget(node) {
    var cur = node && node.closest ? node.closest('[data-studio-id]') : null;
    while (cur) {
      var sid = cur.getAttribute('data-studio-id');
      if (sid && !LOCKED_IDS[sid] && !HIDDEN_IDS[sid]) {
        return cur;
      }
      cur = cur.parentElement ? cur.parentElement.closest('[data-studio-id]') : null;
    }
    return null;
  }

  function clearTrackedPreviewStyles() {
    if (!ACTIVE_PREVIEW_RECORDS.length) return;
    var ownedMap = window.__STUDIO_REACT_OWNED_STYLES__ || {};
    ACTIVE_PREVIEW_RECORDS.forEach(function(rec) {
      try {
        if (!rec.el || !rec.el.style) return;
        var sid = rec.el.getAttribute('data-studio-id');
        var owned = sid && ownedMap[sid];
        if (owned && Object.prototype.hasOwnProperty.call(owned, rec.key)) {
          rec.el.style[rec.key] = owned[rec.key];
          return;
        }
        if (rec.el.style[rec.key] === rec.val) {
          rec.el.style[rec.key] = rec.prevVal || '';
        }
      } catch (e) {}
    });
    ACTIVE_PREVIEW_RECORDS = [];
  }

  function parseStudioId(id) {
    if (!id) return null;
    var sep = id.lastIndexOf('::');
    if (sep === -1) return null;
    return { filePath: id.slice(0, sep), elementIndex: Number(id.slice(sep + 2)) };
  }

  function getFriendlyLabel(el) {
    var tag = el.tagName.toLowerCase();
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) {
        text += el.childNodes[i].textContent;
      }
    }
    text = text.trim().replace(/\\s+/g, ' ');
    if (text) return tag + ' "' + (text.length > 22 ? text.slice(0, 22) + '...' : text) + '"';
    if (el.id) return tag + '#' + el.id;
    var cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '';
    return cls ? tag + '.' + cls : tag;
  }

  function getDirectText(el) {
    var hasChildEl = false;
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 1) hasChildEl = true;
      else if (n.nodeType === 3) text += n.textContent;
    }
    return { text: text.trim(), isTextEditable: !hasChildEl || text.trim().length > 0 };
  }

  function buildLayerTree(rootEl) {
    var result = [];
    function walk(node) {
      if (!node || node.nodeType !== 1) return null;
      var sid = node.getAttribute('data-studio-id');
      var childLayers = [];
      for (var i = 0; i < node.children.length; i++) {
        var c = walk(node.children[i]);
        if (c) {
          if (Array.isArray(c)) childLayers = childLayers.concat(c);
          else childLayers.push(c);
        }
      }
      if (!sid) {
        return childLayers;
      }
      var parsed = parseStudioId(sid);
      return {
        studioId: sid,
        filePath: parsed ? parsed.filePath : '',
        elementIndex: parsed ? parsed.elementIndex : 0,
        tagName: node.tagName.toLowerCase(),
        label: getFriendlyLabel(node),
        children: childLayers
      };
    }
    var walked = walk(rootEl);
    if (Array.isArray(walked)) result = walked;
    else if (walked) result = [walked];
    return result;
  }

  function extractSnapshot(el) {
    var sid = el.getAttribute('data-studio-id');
    var parsed = parseStudioId(sid);
    var rect = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    var inlineObj = {};
    for (var i = 0; i < el.style.length; i++) {
      var prop = el.style[i];
      inlineObj[prop] = el.style.getPropertyValue(prop);
    }

    var parentEl = el.parentElement ? el.parentElement.closest('[data-studio-id]') : null;
    var parentSid = parentEl ? parentEl.getAttribute('data-studio-id') : null;
    var parentParsed = parseStudioId(parentSid);
    var ownInstanceSid = el.getAttribute('data-studio-instance') || undefined;
    var ownReorderId = ownInstanceSid || sid;
    var ownReorderParsed = parseStudioId(ownReorderId);
    var rawParentEl = el.parentElement;
    var parentRectRaw = rawParentEl ? rawParentEl.getBoundingClientRect() : null;
    var siblingEls = [];
    var siblingReorderIds = [];
    var seenReorderIds = {};
    var siblingRects = [];
    if (el.parentElement) {
      for (var k = 0; k < el.parentElement.children.length; k++) {
        var childNode = el.parentElement.children[k];
        var chReorderId = childNode.getAttribute('data-studio-instance') || childNode.getAttribute('data-studio-id');
        if (chReorderId) {
          var chParsed = parseStudioId(chReorderId);
          if (
            ownReorderParsed &&
            chParsed &&
            chParsed.filePath === ownReorderParsed.filePath &&
            !seenReorderIds[chReorderId]
          ) {
            seenReorderIds[chReorderId] = true;
            siblingEls.push(childNode);
            siblingReorderIds.push(chReorderId);
          }
          if (childNode !== el) {
            var sr = childNode.getBoundingClientRect();
            if (sr.width > 0 && sr.height > 0) {
              siblingRects.push({ x: sr.left, y: sr.top, width: sr.width, height: sr.height });
            }
          }
        }
      }
    }
    // Also collect major landmark sibling/section rects on the page for richer alignment guides
    var allBench = document.querySelectorAll('section[data-studio-id], article[data-studio-id], header[data-studio-id], footer[data-studio-id], main[data-studio-id]');
    for (var b = 0; b < allBench.length && siblingRects.length < 36; b++) {
      var bel = allBench[b];
      if (bel === el || bel.contains(el) || el.contains(bel)) continue;
      var br = bel.getBoundingClientRect();
      if (br.width > 0 && br.height > 0) {
        siblingRects.push({ x: br.left, y: br.top, width: br.width, height: br.height });
      }
    }
    var siblingIdx = siblingReorderIds.indexOf(ownReorderId);
    var textMeta = getDirectText(el);
    var ancestry = [];
    var ancNode = el;
    while (ancNode && ancNode.nodeType === 1) {
      var ancSid = ancNode.getAttribute && ancNode.getAttribute('data-studio-id');
      if (ancSid) {
        ancestry.unshift({
          studioId: ancSid,
          tagName: ancNode.tagName.toLowerCase(),
          label: getFriendlyLabel(ancNode)
        });
      }
      ancNode = ancNode.parentElement;
    }

    return {
      studioId: sid,
      instanceStudioId: ownInstanceSid,
      filePath: parsed ? parsed.filePath : '',
      elementIndex: parsed ? parsed.elementIndex : 0,
      tagName: el.tagName.toLowerCase(),
      label: getFriendlyLabel(el),
      textContent: textMeta.text,
      isTextEditable: textMeta.isTextEditable,
      className: typeof el.className === 'string' ? el.className : '',
      inlineStyles: inlineObj,
      computedStyles: {
        backgroundImage: cs.backgroundImage,
        backgroundColor: cs.backgroundColor,
        backgroundClip: cs.webkitBackgroundClip || cs.backgroundClip,
        color: cs.color,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textAlign: cs.textAlign,
        textWrap: cs.textWrap || '',
        width: cs.width,
        height: cs.height,
        minWidth: cs.minWidth,
        minHeight: cs.minHeight,
        maxWidth: cs.maxWidth,
        maxHeight: cs.maxHeight,
        boxSizing: cs.boxSizing,
        overflowWrap: cs.overflowWrap,
        whiteSpace: cs.whiteSpace,
        paddingTop: cs.paddingTop,
        paddingRight: cs.paddingRight,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        marginTop: cs.marginTop,
        marginRight: cs.marginRight,
        marginBottom: cs.marginBottom,
        marginLeft: cs.marginLeft,
        display: cs.display,
        flexDirection: cs.flexDirection,
        flexWrap: cs.flexWrap,
        flexGrow: cs.flexGrow,
        flexShrink: cs.flexShrink,
        alignSelf: cs.alignSelf,
        gap: cs.gap,
        rowGap: cs.rowGap,
        columnGap: cs.columnGap,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
        justifyItems: cs.justifyItems,
        gridTemplateColumns: cs.gridTemplateColumns,
        gridTemplateRows: cs.gridTemplateRows,
        position: cs.position,
        top: cs.top,
        right: cs.right,
        bottom: cs.bottom,
        left: cs.left,
        zIndex: cs.zIndex,
        overflow: cs.overflow,
        borderRadius: cs.borderRadius,
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderTopColor,
        boxShadow: cs.boxShadow,
        opacity: cs.opacity,
        transform: cs.transform,
        translate: cs.translate
      },
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      parentStudioId: parentSid,
      parentRect: parentRectRaw ? { x: parentRectRaw.left, y: parentRectRaw.top, width: parentRectRaw.width, height: parentRectRaw.height } : null,
      siblingRects: siblingRects,
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
      siblingIndex: siblingIdx,
      siblingCount: siblingEls.length,
      canReorderSiblings: Boolean(
        siblingEls.length > 1 &&
        siblingIdx !== -1 &&
        parentParsed &&
        ownReorderParsed &&
        parentParsed.filePath === ownReorderParsed.filePath
      ),
      ancestry: ancestry,
      href: el.getAttribute('href') || undefined,
      src: el.getAttribute('src') || undefined
    };
  }

  function findStudioElement(sid) {
    if (!sid) return null;
    try {
      return (
        document.querySelector('[data-studio-instance="' + CSS.escape(sid) + '"]') ||
        document.querySelector('[data-studio-id="' + CSS.escape(sid) + '"]')
      );
    } catch (e) {
      return null;
    }
  }

  function postTree() {
    var root = document.getElementById('root') || document.body;
    window.parent.postMessage({
      type: 'studio:tree',
      tree: buildLayerTree(root),
      activeRoute: ACTIVE_ROUTE
    }, '*');
  }

  function postSelectedRect() {
    if (!SELECTED_ID) return;
    var el = findStudioElement(SELECTED_ID);
    if (!el) return;
    var r = el.getBoundingClientRect();
    window.parent.postMessage({
      type: 'studio:selected-rect',
      studioId: SELECTED_ID,
      rect: { x: r.left, y: r.top, width: r.width, height: r.height }
    }, '*');
  }

  document.addEventListener('mouseover', function(e) {
    if (CURRENT_MODE !== 'design') return;
    var target = findSelectableTarget(e.target);
    if (!target) {
      if (HOVER_ID) {
        HOVER_ID = null;
        window.parent.postMessage({ type: 'studio:hover', studioId: null }, '*');
      }
      return;
    }
    var sid = target.getAttribute('data-studio-id');
    if (sid === SELECTED_ID) {
      window.parent.postMessage({ type: 'studio:hover', studioId: null }, '*');
      return;
    }
    HOVER_ID = sid;
    var r = target.getBoundingClientRect();
    window.parent.postMessage({
      type: 'studio:hover',
      studioId: sid,
      tagName: target.tagName.toLowerCase(),
      rect: { x: r.left, y: r.top, width: r.width, height: r.height }
    }, '*');
  }, true);

  document.addEventListener('mouseleave', function() {
    HOVER_ID = null;
    window.parent.postMessage({ type: 'studio:hover', studioId: null }, '*');
  });

  document.addEventListener('click', function(e) {
    if (CURRENT_MODE === 'interact') {
      var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (link) {
        var href = link.getAttribute('href');
        if (href && (href.startsWith('/') || href.endsWith('.html'))) {
          e.preventDefault();
          window.parent.postMessage({ type: 'studio:navigate', route: href }, '*');
        }
      }
      return;
    }

    if (EDITING_EL && EDITING_EL.contains(e.target)) {
      return;
    }

    var target = findSelectableTarget(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();

    SELECTED_ID = target.getAttribute('data-studio-id');
    window.parent.postMessage({
      type: 'studio:select',
      element: extractSnapshot(target),
      shiftKey: Boolean(e.shiftKey)
    }, '*');
  }, true);

  document.addEventListener('dblclick', function(e) {
    if (CURRENT_MODE !== 'design') return;
    var target = e.target && e.target.closest ? e.target.closest('[data-studio-id]') : null;
    if (!target) return;
    var textMeta = getDirectText(target);
    if (!textMeta.isTextEditable || target.children.length > 0) return;

    e.preventDefault();
    e.stopPropagation();
    EDITING_EL = target;
    var originalText = target.textContent;
    target.setAttribute('contenteditable', 'true');
    target.style.outline = '2px solid #2563EB';
    target.focus();

    function finishEdit(save) {
      target.removeAttribute('contenteditable');
      target.style.outline = '';
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('keydown', onKeyDown);
      EDITING_EL = null;
      if (save) {
        var nextText = target.textContent || '';
        if (nextText !== originalText) {
          window.parent.postMessage({
            type: 'studio:inline-text',
            studioId: target.getAttribute('data-studio-id'),
            textContent: nextText
          }, '*');
        }
      } else {
        target.textContent = originalText;
      }
    }
    function onBlur() { finishEdit(true); }
    function onKeyDown(ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        finishEdit(true);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        finishEdit(false);
      }
    }
    target.addEventListener('blur', onBlur);
    target.addEventListener('keydown', onKeyDown);
  }, true);

  window.addEventListener('scroll', postSelectedRect, true);
  window.addEventListener('resize', postSelectedRect);

  window.addEventListener('message', function(ev) {
    var msg = ev.data || {};
    if (msg.type === 'studio:set-mode') {
      CURRENT_MODE = msg.mode;
    } else if (msg.type === 'studio:set-logic-rules') {
      LOGIC_RULES = Array.isArray(msg.rules) ? msg.rules.filter(function(rule) {
        return rule && typeof rule.componentId === 'string' && typeof rule.trigger === 'string' && typeof rule.action === 'string';
      }) : [];
    } else if (msg.type === 'studio:update-css') {
      if (typeof msg.tailwindCss === 'string') {
        var twStyle = document.getElementById('studio-tailwind-css');
        if (twStyle) twStyle.textContent = msg.tailwindCss;
      }
      if (typeof msg.userCss === 'string') {
        var uStyle = document.getElementById('studio-user-css');
        if (uStyle) uStyle.textContent = msg.userCss;
      }
      clearTrackedPreviewStyles();
      postSelectedRect();
      if (SELECTED_ID) {
        var updatedSel = findStudioElement(SELECTED_ID);
        if (updatedSel) {
          window.parent.postMessage({
            type: 'studio:select',
            element: extractSnapshot(updatedSel),
            preserveMulti: true
          }, '*');
        }
      }
    } else if (msg.type === 'studio:select-by-id') {
      var el = findStudioElement(msg.studioId);
      if (el) {
        SELECTED_ID = el.getAttribute('data-studio-id') || msg.studioId;
        if (msg.scroll !== false) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        var preserveM = Boolean(msg.preserveMulti);
        setTimeout(function() {
          window.parent.postMessage({
            type: 'studio:select',
            element: extractSnapshot(el),
            preserveMulti: preserveM
          }, '*');
        }, 25);
      }
    } else if (msg.type === 'studio:preview-style') {
      var el2 = findStudioElement(msg.studioId);
      if (el2 && msg.styles) {
        Object.keys(msg.styles).forEach(function(k) {
          var v = msg.styles[k];
          var prevVal = el2.style[k] || '';
          if (v === null || v === '') {
            el2.style[k] = '';
          } else {
            el2.style[k] = v;
            ACTIVE_PREVIEW_RECORDS.push({ el: el2, key: k, val: el2.style[k], prevVal: prevVal });
          }
        });
        postSelectedRect();
      }
    } else if (msg.type === 'studio:drag-probe') {
      var dragEl = findStudioElement(msg.studioId);
      if (!dragEl || !dragEl.parentElement) return;
      var dragReorderId = dragEl.getAttribute('data-studio-instance') || dragEl.getAttribute('data-studio-id');
      var dragParsed = parseStudioId(dragReorderId);
      if (!dragParsed) return;
      var siblings = [];
      var seenProbeIds = {};
      for (var i = 0; i < dragEl.parentElement.children.length; i++) {
        var ch = dragEl.parentElement.children[i];
        var chId = ch.getAttribute('data-studio-instance') || ch.getAttribute('data-studio-id');
        if (!chId || seenProbeIds[chId]) continue;
        var chP = parseStudioId(chId);
        if (chP && chP.filePath === dragParsed.filePath) {
          seenProbeIds[chId] = true;
          siblings.push(ch);
        }
      }
      var fromPos = siblings.indexOf(dragEl);
      if (siblings.length < 2 || fromPos === -1) return;

      var parentCs = window.getComputedStyle(dragEl.parentElement);
      var isHorizontal = false;
      if (parentCs.display === 'flex' || parentCs.display === 'inline-flex') {
        isHorizontal = parentCs.flexDirection.startsWith('row');
      } else if (parentCs.display === 'grid' || parentCs.display === 'inline-grid') {
        var r0 = siblings[0].getBoundingClientRect();
        var r1 = siblings[1].getBoundingClientRect();
        isHorizontal = Math.abs(r0.top - r1.top) < Math.min(r0.height, r1.height) * 0.5;
      }

      var bestIdx = fromPos;
      var bestDist = Infinity;
      var bestAfter = false;
      var indicatorRect = null;

      siblings.forEach(function(sib, idx) {
        var r = sib.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var d = Math.hypot(msg.x - cx, msg.y - cy);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
          if (isHorizontal) {
            bestAfter = msg.x > cx;
            indicatorRect = {
              x: bestAfter ? r.right + 2 : r.left - 4,
              y: r.top,
              width: 3,
              height: r.height
            };
          } else {
            bestAfter = msg.y > cy;
            indicatorRect = {
              x: r.left,
              y: bestAfter ? r.bottom + 2 : r.top - 4,
              width: r.width,
              height: 3
            };
          }
        }
      });

      var slot = bestAfter ? (bestIdx + 1) : bestIdx;
      var rawTarget = slot > fromPos ? slot - 1 : slot;
      var targetIdx = Math.max(0, Math.min(siblings.length - 1, rawTarget));

      window.parent.postMessage({
        type: 'studio:drop-target',
        targetIndex: targetIdx,
        indicatorRect: indicatorRect
      }, '*');
    } else if (msg.type === 'studio:hot-update-html') {
      if (typeof msg.bodyHtml === 'string') {
        document.body.innerHTML = msg.bodyHtml;
      }
      if (typeof msg.tailwindCss === 'string') {
        var twHtmlStyle = document.getElementById('studio-tailwind-css');
        if (twHtmlStyle) twHtmlStyle.textContent = msg.tailwindCss;
      }
      if (typeof msg.userCss === 'string') {
        var uHtmlStyle = document.getElementById('studio-user-css');
        if (uHtmlStyle) uHtmlStyle.textContent = msg.userCss;
      }
      ACTIVE_PREVIEW_RECORDS = [];
      if (msg.selectStudioId) {
        SELECTED_ID = msg.selectStudioId;
      }
      postTree();
      if (SELECTED_ID) {
        var selHtml = findStudioElement(SELECTED_ID);
        if (selHtml) {
          SELECTED_ID = selHtml.getAttribute('data-studio-id') || SELECTED_ID;
          window.parent.postMessage({
            type: 'studio:select',
            element: extractSnapshot(selHtml),
            preserveMulti: true
          }, '*');
        }
      }
    } else if (msg.type === 'studio:set-layer-locks') {
      LOCKED_IDS = {};
      HIDDEN_IDS = {};
      if (Array.isArray(msg.lockedIds)) {
        msg.lockedIds.forEach(function(id) { LOCKED_IDS[id] = true; });
      }
      if (Array.isArray(msg.hiddenIds)) {
        msg.hiddenIds.forEach(function(id) { HIDDEN_IDS[id] = true; });
      }
      applyLayerStateCss();
    } else if (msg.type === 'studio:set-pseudo-state') {
      applyPseudoPreview(msg.studioId, msg.pseudo);
    } else if (msg.type === 'studio:multi-rects-request') {
      var reqIds = Array.isArray(msg.studioIds) ? msg.studioIds : [];
      var multiItems = [];
      reqIds.forEach(function(id) {
        var mel = findStudioElement(id);
        if (mel) multiItems.push(extractSnapshot(mel));
      });
      window.parent.postMessage({
        type: 'studio:multi-rects',
        elements: multiItems
      }, '*');
    } else if (msg.type === 'studio:query-marquee') {
      var mq = msg.rect || { x: 0, y: 0, width: 0, height: 0 };
      var mRight = mq.x + mq.width;
      var mBottom = mq.y + mq.height;
      var allNodes = document.querySelectorAll('[data-studio-id]');
      var matched = [];
      for (var mi = 0; mi < allNodes.length; mi++) {
        var node = allNodes[mi];
        var sid = node.getAttribute('data-studio-id');
        if (!sid || LOCKED_IDS[sid] || HIDDEN_IDS[sid]) continue;
        var nr = node.getBoundingClientRect();
        if (nr.width < 4 || nr.height < 4) continue;
        // Skip root wrapper that spans almost the entire viewport
        if (nr.width >= window.innerWidth - 8 && nr.height >= window.innerHeight - 8) continue;
        var intersects = !(nr.right < mq.x || nr.left > mRight || nr.bottom < mq.y || nr.top > mBottom);
        if (intersects) matched.push(node);
      }
      // Keep leaf-most intersecting nodes (drop parents whose intersecting child is also matched)
      var leafMatched = matched.filter(function(cand) {
        return !matched.some(function(other) {
          return other !== cand && cand.contains(other);
        });
      });
      var finalNodes = leafMatched.slice(0, 12);
      window.parent.postMessage({
        type: 'studio:marquee-result',
        elements: finalNodes.map(function(n) { return extractSnapshot(n); })
      }, '*');
    } else if (msg.type === 'studio:ping-tree') {
      if (msg.selectStudioId) {
        SELECTED_ID = msg.selectStudioId;
      }
      postTree();
      applyLayerStateCss();
      if (ACTIVE_PSEUDO_ID && ACTIVE_PSEUDO_MODE !== 'default') {
        applyPseudoPreview(ACTIVE_PSEUDO_ID, ACTIVE_PSEUDO_MODE);
      }
      if (SELECTED_ID) {
        var sel = findStudioElement(SELECTED_ID);
        if (sel) {
          SELECTED_ID = sel.getAttribute('data-studio-id') || SELECTED_ID;
          window.parent.postMessage({
            type: 'studio:select',
            element: extractSnapshot(sel),
            preserveMulti: true
          }, '*');
        }
      }
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(postTree, 50);
  } else {
    window.addEventListener('DOMContentLoaded', function() { setTimeout(postTree, 50); });
  }
})();
`;
}

export interface ReactPreviewPayload {
  modules: Record<string, string>;
  resMap: Record<string, Record<string, string>>;
  jsonFiles: Record<string, string>;
  cssModules: Record<string, Record<string, string>>;
  activeRoute: string;
  entryFile: string;
  layoutFile: string | null;
  isolateComponent: boolean;
  userCss: string;
  compileErrors: string[];
}

export function compileReactPreviewPayload(
  project: VirtualProject,
  activePage: ProjectPage,
  options?: { isolateComponent?: boolean }
): ReactPreviewPayload {
  const compileErrors: string[] = [];
  const isolateComponent = Boolean(options?.isolateComponent);
  const compiledModules: Record<string, string> = {};

  const sourceEntries = Object.entries(project.files).filter(([path]) =>
    /\.(tsx|ts|jsx|js)$/i.test(path)
  );
  const importedStyles = collectImportedStyles(project.files, sourceEntries);
  const globalCss = project.globalCssPaths
    .map((p) => {
      const css = project.files[p] || '';
      return css
        .replace(/@import\s+["']tailwindcss["']\s*;/g, '')
        .replace(/@tailwind\s+[^;]+;/g, '');
    })
    .join('\n');
  const userCss = [globalCss, importedStyles.css].filter(Boolean).join('\n');

  for (const [filePath, code] of sourceEntries) {
    const isJsx = /\.(tsx|jsx)$/i.test(filePath);
    const instrumented = isJsx
      ? instrumentSourceWithStudioIds(code, filePath, false)
      : code;

    try {
      const transformed = transform(instrumented, {
        transforms: ['typescript', 'jsx', 'imports'],
        jsxRuntime: 'classic',
        jsxPragma: 'React.createElement',
        jsxFragmentPragma: 'React.Fragment',
        filePath,
      });
      compiledModules[filePath] = transformed.code;
    } catch (err) {
      compileErrors.push(
        `${filePath}: ${err instanceof Error ? err.message : 'Transform failed'}`
      );
    }
  }

  const resolutionMap: Record<string, Record<string, string>> = {};
  for (const [filePath] of sourceEntries) {
    const code = project.files[filePath];
    const imports: Record<string, string> = {};
    const importRegex = /(?:from|require\()\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(code)) !== null) {
      const spec = m[1];
      if (spec.startsWith('.') || spec.startsWith('@/')) {
        const resolved = resolveVirtualModulePath(filePath, spec, project.files);
        if (resolved) imports[spec] = resolved;
      }
    }
    resolutionMap[filePath] = imports;
  }

  const jsonFiles = Object.fromEntries(
    Object.entries(project.files).filter(([p]) => p.endsWith('.json'))
  );

  const layoutFile = isolateComponent
    ? null
    : ['app/layout.tsx', 'app/layout.jsx', 'src/app/layout.tsx', 'src/app/layout.jsx'].find(
        (p) => Boolean(project.files[p])
      ) || null;

  return {
    modules: compiledModules,
    resMap: resolutionMap,
    jsonFiles,
    cssModules: importedStyles.cssModules,
    activeRoute: activePage.route,
    entryFile: activePage.filePath,
    layoutFile,
    isolateComponent,
    userCss,
    compileErrors,
  };
}

export function compileHtmlBodyPayload(project: VirtualProject, activePage: ProjectPage): {
  bodyHtml: string;
  userCss: string;
} {
  const rawHtml = project.files[activePage.filePath] || '<div>Empty HTML page</div>';
  const instrumentedHtml = instrumentSourceWithStudioIds(rawHtml, activePage.filePath, true);
  const bodyMatch = instrumentedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : instrumentedHtml;
  const userCss = project.globalCssPaths.map((p) => project.files[p] || '').join('\n');
  return { bodyHtml, userCss };
}

export function buildPreviewDocument(
  project: VirtualProject,
  activePage: ProjectPage,
  compiledTailwindCss: string,
  interactionMode: 'design' | 'interact',
  selectedStudioId: string | null,
  options?: { isolateComponent?: boolean }
): CompiledPreviewBundle {
  const isolateComponent = Boolean(options?.isolateComponent);

  // Pure HTML mode
  if (project.framework === 'html' || /\.html?$/i.test(activePage.filePath)) {
    const rawHtml = project.files[activePage.filePath] || '<div>Empty HTML page</div>';
    const instrumentedHtml = instrumentSourceWithStudioIds(rawHtml, activePage.filePath, true);
    const cssParts = project.globalCssPaths
      .map((p) => project.files[p] || '')
      .join('\n');
    const bridge = buildDesignerBridgeScript(activePage.route, interactionMode);
    const injection = `<style id="studio-tailwind-css">${compiledTailwindCss}</style><style id="studio-user-css">${cssParts}</style><script>${escapeScriptClose(
      bridge
    )}</script>`;

    let finalHtml = instrumentedHtml;
    if (/<\/head>/i.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<\/head>/i, `${injection}</head>`);
    } else {
      finalHtml = `<!doctype html><html><head>${injection}</head><body>${finalHtml}</body></html>`;
    }
    if (selectedStudioId) {
      finalHtml = finalHtml.replace(
        /<\/body>/i,
        `<script>setTimeout(function(){window.postMessage({type:'studio:select-by-id',studioId:${JSON.stringify(
          selectedStudioId
        )},scroll:false},'*')},120);</script></body>`
      );
    }
    return { html: finalHtml, compileErrors: [] };
  }

  // React / Next.js TSX/JSX bundle mode
  const payload = compileReactPreviewPayload(project, activePage, { isolateComponent });

  const runtimeScript = `
(function bootStudioRuntime() {
  var RT = window.parent && window.parent.__STUDIO_RUNTIME__;
  if (!RT || !RT.React || !RT.ReactDOMClient) {
    setTimeout(bootStudioRuntime, 16);
    return;
  }
  var React = RT.React;
  var ReactDOMClient = RT.ReactDOMClient;
  var LucideIcons = RT.LucideIcons || {};
  var ExternalLibs = RT.ExternalLibs || {};
  var REQUESTED_LIBS = {};
  var MODULES = ${escapeScriptClose(JSON.stringify(payload.modules))};
  var RES_MAP = ${escapeScriptClose(JSON.stringify(payload.resMap))};
  var JSON_FILES = ${escapeScriptClose(JSON.stringify(payload.jsonFiles))};
  var CSS_MODULES = ${escapeScriptClose(JSON.stringify(payload.cssModules))};
  var ACTIVE_ROUTE = ${JSON.stringify(payload.activeRoute)};
  var ENTRY_FILE = ${JSON.stringify(payload.entryFile)};
  var ISOLATE_COMPONENT = ${JSON.stringify(payload.isolateComponent)};
  var LAYOUT_FILE = ${JSON.stringify(payload.layoutFile)};
  var CACHE = {};
  var PROJECT_MODULE_FNS = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  var WRAPPED_COMP_MAP = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var studioRoot = null;

  function getWrappedComponent(Comp) {
    if (!WRAPPED_COMP_MAP) return Comp;
    var existing = WRAPPED_COMP_MAP.get(Comp);
    if (existing) return existing;
    var Wrapped = function StudioComponentHost(props) {
      var instId = props && props['data-studio-id'];
      var cleanProps = props;
      if (instId) {
        cleanProps = Object.assign({}, props);
        delete cleanProps['data-studio-id'];
      }
      // Render project components through React rather than invoking them as plain
      // functions. Components such as ReactBits often use hooks; giving them their
      // own React fiber keeps hook state, effects and error handling isolated.
      var rendered = React.createElement(Comp, cleanProps);
      if (instId && React.isValidElement(rendered)) {
        return React.cloneElement(rendered, {
          'data-studio-instance': instId
        });
      }
      return rendered;
    };
    Wrapped.displayName = Comp.displayName || Comp.name || 'StudioComponent';
    WRAPPED_COMP_MAP.set(Comp, Wrapped);
    return Wrapped;
  }

  // Wrap React.createElement so Next.js RootLayout <html> and <body> render safely inside #root
  // and project component callsites preserve data-studio-instance for parent-level reordering
  var StudioReact = Object.assign({}, React, {
    createElement: function(type, props) {
      var args = Array.prototype.slice.call(arguments, 2);
      if (typeof type === 'string' && props && props['data-studio-id']) {
        var ownedMap = window.__STUDIO_REACT_OWNED_STYLES__ || (window.__STUDIO_REACT_OWNED_STYLES__ = {});
        if (props.style && typeof props.style === 'object') {
          ownedMap[props['data-studio-id']] = Object.assign({}, props.style);
        } else {
          delete ownedMap[props['data-studio-id']];
        }
      }
      if (type === 'html' || type === 'body') {
        var nextProps = props ? Object.assign({}, props) : {};
        delete nextProps.lang;
        delete nextProps.suppressHydrationWarning;
        return React.createElement.apply(React, ['div', nextProps].concat(args));
      }
      if (
        typeof type === 'function' &&
        PROJECT_MODULE_FNS &&
        PROJECT_MODULE_FNS.has(type) &&
        props &&
        props['data-studio-id'] &&
        !(type.prototype && type.prototype.isReactComponent)
      ) {
        var wrapped = getWrappedComponent(type);
        return React.createElement.apply(React, [wrapped, props].concat(args));
      }
      return React.createElement.apply(React, [type, props].concat(args));
    }
  });

  function createFallbackProxy(label) {
    var fn = function FallbackComponent(props) {
      return props && props.children ? React.createElement('div', { 'data-fallback': label }, props.children) : null;
    };
    return new Proxy(fn, {
      get: function(target, prop) {
        if (prop === '__esModule') return true;
        if (prop === 'default') return fn;
        if (prop === 'then') return undefined;
        return createFallbackProxy(String(prop));
      },
      apply: function() {
        return createFallbackProxy(label);
      }
    });
  }

  function createStudioMotionValue(initial) {
    var current = initial;
    var listeners = new Set();
    return {
      get: function() { return current; },
      set: function(next) { current = next; listeners.forEach(function(fn) { try { fn(current); } catch (e) {} }); },
      jump: function(next) { current = next; listeners.forEach(function(fn) { try { fn(current); } catch (e) {} }); },
      onChange: function(fn) { listeners.add(fn); return function() { listeners.delete(fn); }; }
    };
  }
  function useStudioMotionValue(initial) { var ref = React.useRef(null); if (!ref.current) ref.current = createStudioMotionValue(initial); return ref.current; }
  function useStudioTransform(inputs, transform) {
    var ref = React.useRef(null); var list = Array.isArray(inputs) ? inputs : [inputs];
    var read = function() { var values = list.map(function(v) { return v && typeof v.get === 'function' ? v.get() : v; }); return Array.isArray(inputs) ? transform(values) : transform(values[0]); };
    if (!ref.current) ref.current = createStudioMotionValue(read());
    React.useEffect(function() { var update = function() { ref.current.set(read()); };
      var cleanups = list.map(function(v) { return v && typeof v.onChange === 'function' ? v.onChange(update) : function() {}; });
      update(); return function() { cleanups.forEach(function(fn) { fn(); }); };
    }, list); return ref.current;
  }
  function studioAnimate(value, target) { if (value && typeof value.set === 'function') value.set(target); return { stop: function() {} }; }
  var MotionProxy = new Proxy({}, {
    get: function(_, tag) { if (tag === '__esModule') return true; var elTag = typeof tag === 'string' ? tag : 'div';
      return function StudioMotionElement(props) {
        var tick = React.useState(0); var style = props && props.style ? props.style : {}; var cleanStyle = {}; var values = [];
        Object.keys(style).forEach(function(key) { var value = style[key];
          if (value && typeof value.get === 'function') { cleanStyle[key] = value.get(); if (typeof value.onChange === 'function') values.push(value); } else cleanStyle[key] = value;
        });
        React.useEffect(function() { var cleanups = values.map(function(value) { return value.onChange(function() { tick[1](function(n) { return n + 1; }); }); });
          return function() { cleanups.forEach(function(fn) { fn(); }); };
        }, values);
        var clean = Object.assign({}, props, { style: cleanStyle });
        ['initial','animate','exit','transition','whileHover','whileTap','whileInView','variants','viewport','layout','layoutId'].forEach(function(key) { delete clean[key]; });
        return React.createElement(elTag, clean);
      };
    }
  });

  var LucideProxy = new Proxy({}, {
    get: function(_, name) {
      if (name === '__esModule') return true;
      if (LucideIcons[name]) return LucideIcons[name];
      if (LucideIcons.Box) return LucideIcons.Box;
      return function IconStub() { return React.createElement('span', { className: 'inline-block w-4 h-4' }); };
    }
  });

  var LinkStub = function Link(props) {
    var href = typeof props.href === 'string' ? props.href : '#';
    var clean = Object.assign({}, props, {
      href: href,
      onClick: function(e) {
        if (props.onClick) props.onClick(e);
      }
    });
    return React.createElement('a', clean, props.children);
  };

  function createSupabaseStub() {
    var emptyResult = { data: [], error: null };
    var singleResult = { data: null, error: null };
    var chainTarget = function() {};
    var chain = new Proxy(chainTarget, {
      get: function(_, prop) {
        if (prop === 'then') {
          return function(res, rej) { return Promise.resolve(emptyResult).then(res, rej); };
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return function() { return Promise.resolve(singleResult); };
        }
        return function() { return chain; };
      }
    });
    return {
      from: function() { return chain; },
      rpc: function() { return Promise.resolve(emptyResult); },
      storage: {
        from: function() {
          return {
            getPublicUrl: function() { return { data: { publicUrl: '' } }; },
            upload: function() { return Promise.resolve(singleResult); },
            list: function() { return Promise.resolve(emptyResult); }
          };
        }
      },
      channel: function() {
        return { on: function() { return this; }, subscribe: function() { return { unsubscribe: function(){} }; } };
      },
      removeChannel: function() {},
      auth: {
        getSession: function() { return Promise.resolve({ data: { session: null }, error: null }); },
        getUser: function() { return Promise.resolve({ data: { user: null }, error: null }); },
        signOut: function() { return Promise.resolve({ error: null }); },
        onAuthStateChange: function() { return { data: { subscription: { unsubscribe: function(){} } } }; }
      }
    };
  }

  function createZustandStub(initializer) {
    var state;
    var listeners = new Set();
    var setState = function(partial) {
      var next = typeof partial === 'function' ? partial(state) : partial;
      state = Object.assign({}, state, next);
      listeners.forEach(function(l) { l(state); });
    };
    var getState = function() { return state; };
    state = typeof initializer === 'function' ? initializer(setState, getState, {}) : {};
    return function useStore(selector) {
      var snap = React.useState(0);
      React.useEffect(function() {
        var l = function() { snap[1](function(n) { return n + 1; }); };
        listeners.add(l);
        return function() { listeners.delete(l); };
      }, []);
      return selector ? selector(state) : state;
    };
  }

  function resolveBuiltIn(spec) {
    if (spec === 'react') return StudioReact;
    if (spec === 'react-dom') return ReactDOMClient;
    if (spec === 'react-dom/client') return ReactDOMClient;
    if (spec === 'lucide-react') return LucideProxy;
    if (spec === 'motion/react' || spec === 'framer-motion') {
      return { animate: studioAnimate, motion: MotionProxy, m: MotionProxy,
        AnimatePresence: function(p) { return p.children || null; }, MotionConfig: function(p) { return p.children || null; },
        useMotionValue: useStudioMotionValue, useReducedMotion: function() { return false; }, useTransform: useStudioTransform,
        useSpring: function(v) { return v && typeof v.get === 'function' ? v : useStudioMotionValue(v); }, useInView: function() { return true; },
        useScroll: function() { return { scrollY: useStudioMotionValue(0), scrollYProgress: useStudioMotionValue(0) }; }
      };
    }
    if (spec === '@hugeicons/react') return { HugeiconsIcon: function(props) {
      return React.createElement('svg', { width: props.size || 20, height: props.size || 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: props.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, React.createElement('path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4' }));
    } };
    if (spec === '@hugeicons/core-free-icons') return { Notification03Icon: { name: 'Notification03Icon' } };
    if (spec === 'next/link') return { __esModule: true, default: LinkStub };
    if (spec === 'next/image') {
      return {
        __esModule: true,
        default: function NextImage(p) {
          var clean = Object.assign({}, p);
          delete clean.fill; delete clean.priority; delete clean.unoptimized; delete clean.quality;
          return React.createElement('img', clean);
        }
      };
    }
    if (spec === 'next/navigation') {
      return {
        useRouter: function() {
          return {
            push: function(r) { window.parent.postMessage({ type: 'studio:navigate', route: r }, '*'); },
            replace: function(r) { window.parent.postMessage({ type: 'studio:navigate', route: r }, '*'); },
            back: function() {},
            refresh: function() {}
          };
        },
        usePathname: function() { return ACTIVE_ROUTE; },
        useSearchParams: function() { return new URLSearchParams(); },
        useParams: function() { return {}; },
        redirect: function() {},
        notFound: function() {}
      };
    }
    if (spec.startsWith('next/font')) {
      return new Proxy({}, {
        get: function() {
          return function() { return { className: '', variable: '', style: {} }; };
        }
      });
    }
    if (spec === 'clsx') {
      return {
        __esModule: true,
        default: function clsx() {
          return Array.from(arguments).flat().filter(Boolean).join(' ');
        },
        clsx: function clsx() {
          return Array.from(arguments).flat().filter(Boolean).join(' ');
        }
      };
    }
    if (spec === 'tailwind-merge') {
      return {
        twMerge: function() { return Array.from(arguments).filter(Boolean).join(' '); }
      };
    }
    if (spec === 'class-variance-authority') {
      return {
        cva: function(base) { return function() { return base || ''; }; }
      };
    }
    if (spec === 'sonner') {
      var noopToast = Object.assign(function() {}, {
        success: function() {},
        error: function() {},
        info: function() {},
        warning: function() {}
      });
      return {
        Toaster: function() { return null; },
        toast: noopToast
      };
    }
    if (spec === 'canvas-confetti') {
      return { __esModule: true, default: function() {} };
    }
    if (spec === 'zustand') {
      return {
        __esModule: true,
        create: function(init) { return init ? createZustandStub(init) : function(i) { return createZustandStub(i); }; }
      };
    }
    if (spec === 'zustand/middleware') {
      return { persist: function(fn) { return fn; } };
    }
    if (spec === '@supabase/supabase-js') {
      return { createClient: createSupabaseStub };
    }
    if (/\\.(css|scss|sass|less)$/i.test(spec)) {
      return {};
    }
    return null;
  }

  function loadModule(filePath) {
    if (CACHE[filePath]) return CACHE[filePath].exports;
    if (JSON_FILES[filePath]) {
      var parsed = JSON.parse(JSON_FILES[filePath]);
      CACHE[filePath] = { exports: parsed };
      return parsed;
    }
    var code = MODULES[filePath];
    if (!code) return createFallbackProxy(filePath);

    var mod = { exports: {} };
    CACHE[filePath] = mod;
    var localRequire = function(spec) {
      var resolved = RES_MAP[filePath] && RES_MAP[filePath][spec];
      if (resolved && /\\.module\\.css$/i.test(resolved)) {
        return CSS_MODULES[resolved]
          ? Object.assign({ __esModule: true, default: CSS_MODULES[resolved] }, CSS_MODULES[resolved])
          : { __esModule: true, default: {} };
      }
      var builtIn = resolveBuiltIn(spec);
      if (builtIn) return builtIn;
      if (ExternalLibs[spec]) return ExternalLibs[spec];
      if (resolved) return loadModule(resolved);
      if (!spec.startsWith('.') && !spec.startsWith('@/') && !REQUESTED_LIBS[spec]) {
        REQUESTED_LIBS[spec] = true;
        try {
          window.parent.postMessage({ type: 'studio:request-lib', packageName: spec }, '*');
        } catch (e) {}
      }
      return createFallbackProxy(spec);
    };

    try {
      var fn = new Function('require', 'module', 'exports', 'React', 'process', code);
      fn(localRequire, mod, mod.exports, StudioReact, { env: {} });
      if (PROJECT_MODULE_FNS) {
        if (typeof mod.exports === 'function') {
          PROJECT_MODULE_FNS.add(mod.exports);
        } else if (mod.exports && typeof mod.exports === 'object') {
          Object.keys(mod.exports).forEach(function(ek) {
            if (typeof mod.exports[ek] === 'function') {
              PROJECT_MODULE_FNS.add(mod.exports[ek]);
            }
          });
        }
      }
    } catch (err) {
      console.error('Module error in ' + filePath + ':', err);
      mod.exports = {
        __esModule: true,
        default: function ErrorView() {
          return React.createElement('div', {
            style: { padding: '24px', margin: '24px', border: '1px solid #fecaca', borderRadius: '12px', background: '#fef2f2', color: '#991b1b', fontFamily: 'sans-serif' }
          }, 'Preview render notice in ' + filePath + ': ' + (err && err.message ? err.message : String(err)));
        }
      };
    }
    return mod.exports;
  }

  function AsyncBridge(props) {
    var Comp = props.Comp;
    var state = React.useState(null);
    React.useEffect(function() {
      var mounted = true;
      Promise.resolve(Comp({ params: {}, searchParams: {} })).then(function(el) {
        if (mounted) state[1](el);
      }).catch(function(e) {
        if (mounted) state[1](React.createElement('div', { style: { padding: 24, color: '#991b1b' } }, String(e)));
      });
      return function() { mounted = false; };
    }, [Comp]);
    return state[0] || React.createElement('div', { style: { padding: 32, color: '#64748b' } }, 'Rendering page...');
  }

  class StudioErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error: error };
    }
    render() {
      if (this.state.error) {
        return React.createElement('div', {
          style: { padding: '24px', margin: '24px', border: '1px solid #fecaca', borderRadius: '12px', background: '#fef2f2', color: '#991b1b', fontFamily: 'sans-serif', fontSize: '14px' }
        }, 'Component preview fallback: ' + (this.state.error.message || String(this.state.error)));
      }
      return this.props.children;
    }
  }

  function StudioRoot() {
    var pageMod = loadModule(ENTRY_FILE);
    var PageComp = pageMod.default || pageMod;
    if (typeof PageComp !== 'function') {
      var firstFn = Object.values(pageMod).find(function(v) { return typeof v === 'function'; });
      PageComp = firstFn || function() { return React.createElement('div', { style: { padding: 32 } }, 'No default React component exported by ' + ENTRY_FILE); };
    }
    var pageNode = (PageComp.constructor && PageComp.constructor.name === 'AsyncFunction')
      ? React.createElement(AsyncBridge, { Comp: PageComp })
      : React.createElement(PageComp, { params: {}, searchParams: {} });

    if (ISOLATE_COMPONENT) {
      return React.createElement(
        StudioErrorBoundary,
        null,
        React.createElement(
          'div',
          { className: 'min-h-screen bg-slate-50 p-8' },
          pageNode
        )
      );
    }

    if (LAYOUT_FILE && ENTRY_FILE !== LAYOUT_FILE) {
      var layoutMod = loadModule(LAYOUT_FILE);
      var LayoutComp = layoutMod && (layoutMod.default || Object.values(layoutMod).find(function(v) { return typeof v === 'function'; }));
      if (typeof LayoutComp === 'function') {
        return React.createElement(
          StudioErrorBoundary,
          null,
          React.createElement(LayoutComp, { children: pageNode })
        );
      }
    }
    return React.createElement(StudioErrorBoundary, null, pageNode);
  }

  var rootNode = document.getElementById('root');
  if (rootNode) {
    studioRoot = ReactDOMClient.createRoot(rootNode);
    studioRoot.render(React.createElement(StudioRoot));
    setTimeout(function() {
      window.postMessage({ type: 'studio:ping-tree' }, '*');
      if (${JSON.stringify(Boolean(selectedStudioId))}) {
        window.postMessage({ type: 'studio:select-by-id', studioId: ${JSON.stringify(selectedStudioId)}, scroll: false }, '*');
      }
    }, 80);

    window.addEventListener('message', function(ev) {
      var msg = ev.data || {};
      if (msg.type === 'studio:hot-update' && msg.payload) {
        var p = msg.payload;
        MODULES = p.modules || MODULES;
        RES_MAP = p.resMap || RES_MAP;
        JSON_FILES = p.jsonFiles || JSON_FILES;
        CSS_MODULES = p.cssModules || CSS_MODULES;
        ACTIVE_ROUTE = p.activeRoute || ACTIVE_ROUTE;
        ENTRY_FILE = p.entryFile || ENTRY_FILE;
        LAYOUT_FILE = p.layoutFile !== undefined ? p.layoutFile : LAYOUT_FILE;
        ISOLATE_COMPONENT = p.isolateComponent !== undefined ? p.isolateComponent : ISOLATE_COMPONENT;
        CACHE = {};
        if (typeof msg.tailwindCss === 'string') {
          var twEl = document.getElementById('studio-tailwind-css');
          if (twEl) twEl.textContent = msg.tailwindCss;
        }
        if (typeof p.userCss === 'string') {
          var uEl = document.getElementById('studio-user-css');
          if (uEl) uEl.textContent = p.userCss;
        }
        studioRoot.render(React.createElement(StudioRoot));
        setTimeout(function() {
          window.postMessage({
            type: 'studio:ping-tree',
            selectStudioId: msg.selectStudioId || null
          }, '*');
        }, 45);
      } else if (msg.type === 'studio:refresh-runtime') {
        var nextRT = window.parent && window.parent.__STUDIO_RUNTIME__;
        if (nextRT) {
          LucideIcons = nextRT.LucideIcons || LucideIcons;
          ExternalLibs = nextRT.ExternalLibs || ExternalLibs;
        }
        CACHE = {};
        studioRoot.render(React.createElement(StudioRoot));
        setTimeout(function() {
          window.postMessage({ type: 'studio:ping-tree' }, '*');
        }, 30);
      }
    });
  }
})();
`;

  const bridgeScript = buildDesignerBridgeScript(activePage.route, interactionMode);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style id="studio-tailwind-css">${compiledTailwindCss}</style>
  <style id="studio-user-css">${payload.userCss}</style>
</head>
<body>
  <div id="root"></div>
  <script>${escapeScriptClose(runtimeScript)}</script>
  <script>${escapeScriptClose(bridgeScript)}</script>
</body>
</html>`;

  return { html, compileErrors: payload.compileErrors };
}
