import { scanElements } from './source-editor';

export interface ProjectComponentInfo {
  name: string;
  filePath: string;
  props: Array<{ name: string; defaultValue?: string }>;
  usageCount: number;
}

export interface ComponentInstanceUsage {
  componentName: string;
  filePath: string;
  elementIndex: number;
  occurrenceIndex: number;
  props: Record<string, string>;
}

function toPascalCase(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) return 'CustomComponent';
  const joined = cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return /^[A-Z]/.test(joined) ? joined : `Comp${joined}`;
}

export function extractComponentExportName(filePath: string, code: string): string {
  // Resolve the actual exported component before scanning helper constants.
  // ReactBits sources often declare uppercase data arrays (e.g. TILES) before
  // the component and finish with "export default CircularCarousel;".
  const defaultIdentifier = code.match(/\bexport\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?/);
  if (defaultIdentifier) return defaultIdentifier[1];

  const exportedFunction = code.match(/\bexport\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)/);
  if (exportedFunction) return exportedFunction[1];

  const exportedConst = code.match(/\bexport\s+(?:default\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=/);
  if (exportedConst) return exportedConst[1];

  const componentFunction = code.match(/\bfunction\s+([A-Z][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^={]+)?\s*\{/);
  if (componentFunction) return componentFunction[1];

  const componentArrow = code.match(/\bconst\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=>/);
  if (componentArrow) return componentArrow[1];

  const base = (filePath.split('/').pop() || 'Component').replace(/\.(tsx|jsx|ts|js)$/i, '');
  return toPascalCase(base);
}

export function extractComponentPropDefinitions(
  code: string
): Array<{ name: string; defaultValue?: string }> {
  const props: Array<{ name: string; defaultValue?: string }> = [];
  const destructMatch = code.match(
    /(?:function\s+[A-Z][A-Za-z0-9_]*|const\s+[A-Z][A-Za-z0-9_]*\s*=)\s*\(\s*\{([^}]*)\}/
  );
  if (destructMatch) {
    const rawParams = destructMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const param of rawParams) {
      const [left, def] = param.split('=').map((s) => s.trim());
      const name = left.replace(/:.*$/, '').trim();
      if (!name || name === 'children') continue;
      props.push({
        name,
        defaultValue: def ? def.replace(/^['"]|['"]$/g, '') : undefined,
      });
    }
  }
  return props;
}

function isPageOrLayoutFile(path: string): boolean {
  return (
    /^(src\/)?app\/(.*\/)?(page|layout|loading|error|not-found)\.(tsx|jsx|ts|js)$/.test(path) ||
    /^(src\/)?pages\/.+\.(tsx|jsx)$/.test(path) ||
    /^src\/App\.(tsx|jsx)$/.test(path)
  );
}

export function scanProjectComponents(files: Record<string, string>): ProjectComponentInfo[] {
  const componentFiles = Object.keys(files)
    .filter((p) => /\.(tsx|jsx)$/i.test(p) && !isPageOrLayoutFile(p))
    .sort();

  const allSourceText = Object.entries(files)
    .filter(([p]) => /\.(tsx|jsx)$/i.test(p))
    .map(([p, code]) => ({ p, code }));

  return componentFiles.map((filePath) => {
    const code = files[filePath] || '';
    const name = extractComponentExportName(filePath, code);
    const props = extractComponentPropDefinitions(code);
    const usageRegex = new RegExp(`<${name}(?:\\s|\\/?>)`, 'g');
    let usageCount = 0;
    for (const entry of allSourceText) {
      if (entry.p === filePath) continue;
      const matches = entry.code.match(usageRegex);
      if (matches) usageCount += matches.length;
    }
    return {
      name,
      filePath,
      props,
      usageCount,
    };
  });
}

function parseOpeningTagAttributes(openTag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(openTag)) !== null) {
    const key = m[1];
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    attrs[key] = val;
  }
  return attrs;
}

export function scanComponentUsagesInFile(
  code: string,
  filePath: string,
  componentNames: string[]
): ComponentInstanceUsage[] {
  if (!code || componentNames.length === 0) return [];
  const nameSet = new Set(componentNames);
  const elements = scanElements(code, false);
  const counts: Record<string, number> = {};
  const usages: ComponentInstanceUsage[] = [];

  for (const el of elements) {
    if (!nameSet.has(el.tagName)) continue;
    const occ = counts[el.tagName] || 0;
    counts[el.tagName] = occ + 1;
    const openTag = code.slice(el.openStart, el.openEnd);
    usages.push({
      componentName: el.tagName,
      filePath,
      elementIndex: el.index,
      occurrenceIndex: occ,
      props: parseOpeningTagAttributes(openTag),
    });
  }

  return usages;
}

export function patchJsxPropInSource(
  code: string,
  elementIndex: number,
  propName: string,
  propValue: string | null
): string {
  const elements = scanElements(code, false);
  const el = elements[elementIndex];
  if (!el) return code;

  const openTag = code.slice(el.openStart, el.openEnd);
  const cleanVal = propValue === null ? null : propValue.replace(/"/g, '&quot;');
  const propPattern = new RegExp(
    `(\\s+${propName}\\s*=\\s*)(?:"[^"]*"|'[^']*'|\\{[^}]*\\})`
  );
  const match = propPattern.exec(openTag);

  let nextOpenTag = openTag;
  if (match) {
    if (cleanVal === null) {
      nextOpenTag = openTag.slice(0, match.index) + openTag.slice(match.index + match[0].length);
    } else {
      nextOpenTag =
        openTag.slice(0, match.index) +
        `${match[1]}"${cleanVal}"` +
        openTag.slice(match.index + match[0].length);
    }
  } else if (cleanVal !== null) {
    const insertAt = openTag.endsWith('/>') ? openTag.length - 2 : openTag.length - 1;
    const spacer = /\s/.test(openTag[insertAt - 1]) ? '' : ' ';
    nextOpenTag =
      openTag.slice(0, insertAt) +
      `${spacer}${propName}="${cleanVal}"` +
      openTag.slice(insertAt);
  }

  return code.slice(0, el.openStart) + nextOpenTag + code.slice(el.openEnd);
}

export type ComponentTemplatePreset = 'card' | 'hero' | 'cta' | 'stats';

export function createComponentFileTemplate(
  rawName: string,
  preset: ComponentTemplatePreset = 'card'
): {
  componentName: string;
  filePath: string;
  code: string;
} {
  const componentName = toPascalCase(rawName);
  const filePath = `components/${componentName}.tsx`;

  if (preset === 'hero') {
    const code = `'use client';
import React from 'react';

export default function ${componentName}({
  badge = 'Featured Component',
  heading = '${componentName}',
  description = 'Redesign typography, gradients, spacing, and constraints visually, then insert anywhere on a page.',
  ctaLabel = 'Get Started',
}: {
  badge?: string;
  heading?: string;
  description?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 p-8 text-white shadow-lg">
      <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-sky-200">
        {badge}
      </span>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">{heading}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-200">{description}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-xs"
        >
          {ctaLabel}
        </button>
      </div>
    </section>
  );
}
`;
    return { componentName, filePath, code };
  }

  if (preset === 'cta') {
    const code = `'use client';
import React from 'react';

export default function ${componentName}({
  title = 'Ready to deploy ${componentName}?',
  subtitle = 'Configure layout, colors, and props visually before placing on your page.',
  buttonText = 'Launch Now',
}: {
  title?: string;
  subtitle?: string;
  buttonText?: string;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-6 sm:flex-row sm:items-center">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs"
      >
        {buttonText}
      </button>
    </div>
  );
}
`;
    return { componentName, filePath, code };
  }

  if (preset === 'stats') {
    const code = `'use client';
import React from 'react';

export default function ${componentName}({
  metric = '99.98%',
  label = 'System Uptime',
  delta = '+0.4% this quarter',
}: {
  metric?: string;
  label?: string;
  delta?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1.5 text-2xl font-bold text-slate-900">{metric}</p>
        <p className="mt-1 text-[11px] font-medium text-emerald-600">{delta}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <p className="text-xs font-medium text-slate-500">Active Nodes</p>
        <p className="mt-1.5 text-2xl font-bold text-slate-900">1,284</p>
        <p className="mt-1 text-[11px] font-medium text-blue-600">Across 14 regions</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <p className="text-xs font-medium text-slate-500">Median Latency</p>
        <p className="mt-1.5 text-2xl font-bold text-slate-900">18ms</p>
        <p className="mt-1 text-[11px] font-medium text-indigo-600">Edge cached</p>
      </div>
    </div>
  );
}
`;
    return { componentName, filePath, code };
  }

  const code = `'use client';
import React from 'react';

export default function ${componentName}({
  title = '${componentName}',
  subtitle = 'Reusable component ready for visual styling and layout edits.',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>
    </section>
  );
}
`;
  return { componentName, filePath, code };
}

export function extractSelectionToComponent(params: {
  pageCode: string;
  pagePath: string;
  elementIndex: number;
  rawComponentName: string;
}): {
  componentName: string;
  componentPath: string;
  componentCode: string;
  updatedPageCode: string;
} | null {
  const { pageCode, pagePath, elementIndex, rawComponentName } = params;
  const elements = scanElements(pageCode, false);
  const el = elements[elementIndex];
  if (!el || el.closeEnd <= el.openStart) return null;

  const componentName = toPascalCase(rawComponentName);
  const componentPath = pagePath.startsWith('src/')
    ? `src/components/${componentName}.tsx`
    : `components/${componentName}.tsx`;

  const snippet = pageCode.slice(el.openStart, el.closeEnd);
  const indentedSnippet = snippet
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

  // Preserve used imports (Link, lucide-react icons, child components, etc.) from pageCode
  const carriedImports: string[] = [];
  const importRegex = /^import\s+(.+?)\s+from\s+(['"][^'"]+['"]);?\s*$/gm;
  let impMatch: RegExpExecArray | null;
  while ((impMatch = importRegex.exec(pageCode)) !== null) {
    const clause = impMatch[1].trim();
    const sourceSpec = impMatch[2];
    if (/^['"]react['"]$/.test(sourceSpec)) continue;
    if (clause.startsWith('* as ')) {
      const ns = clause.replace(/^\*\s+as\s+/, '').trim();
      if (new RegExp(`\\b${ns}\\b`).test(snippet)) {
        carriedImports.push(`import ${clause} from ${sourceSpec};`);
      }
      continue;
    }

    let defaultId = '';
    let namedBlock = '';
    const braceIdx = clause.indexOf('{');
    if (braceIdx !== -1) {
      defaultId = clause.slice(0, braceIdx).replace(/,\s*$/, '').trim();
      const closeBrace = clause.lastIndexOf('}');
      if (closeBrace > braceIdx) {
        namedBlock = clause.slice(braceIdx + 1, closeBrace);
      }
    } else {
      defaultId = clause;
    }

    const usedDefault =
      defaultId && new RegExp(`\\b${defaultId}\\b`).test(snippet) ? defaultId : '';
    const usedNamed = namedBlock
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((spec) => {
        const alias = spec.includes(' as ')
          ? spec.split(/\s+as\s+/)[1].trim()
          : spec;
        return alias && new RegExp(`\\b${alias}\\b`).test(snippet);
      });

    if (usedDefault && usedNamed.length > 0) {
      carriedImports.push(
        `import ${usedDefault}, { ${usedNamed.join(', ')} } from ${sourceSpec};`
      );
    } else if (usedDefault) {
      carriedImports.push(`import ${usedDefault} from ${sourceSpec};`);
    } else if (usedNamed.length > 0) {
      carriedImports.push(`import { ${usedNamed.join(', ')} } from ${sourceSpec};`);
    }
  }

  const importsHeader =
    carriedImports.length > 0 ? `\n${carriedImports.join('\n')}` : '';

  const componentCode = `'use client';
import React from 'react';${importsHeader}

export default function ${componentName}() {
  return (
${indentedSnippet}
  );
}
`;

  let updatedPageCode =
    pageCode.slice(0, el.openStart) + `<${componentName} />` + pageCode.slice(el.closeEnd);

  const importLine = `import ${componentName} from '@/components/${componentName}';\n`;
  if (!updatedPageCode.includes(`@/components/${componentName}`)) {
    const reactImportMatch = updatedPageCode.match(/import\s+React[^\n]*\n/);
    if (reactImportMatch && reactImportMatch.index !== undefined) {
      const insertPos = reactImportMatch.index + reactImportMatch[0].length;
      updatedPageCode =
        updatedPageCode.slice(0, insertPos) + importLine + updatedPageCode.slice(insertPos);
    } else {
      updatedPageCode = importLine + updatedPageCode;
    }
  }

  return {
    componentName,
    componentPath,
    componentCode,
    updatedPageCode,
  };
}

export type ComponentInsertPosition = 'before' | 'after' | 'inside-start' | 'inside-end';

export function computeComponentImportSpecifier(componentFilePath: string): string {
  const withoutExt = componentFilePath.replace(/\.(tsx|jsx|ts|js)$/i, '');
  const withoutIndex = withoutExt.replace(/\/index$/i, '');
  const normalized = withoutIndex.replace(/^src\//, '');
  return `@/${normalized}`;
}

export function ensureComponentImportInSource(params: {
  code: string;
  componentName: string;
  componentFilePath: string;
  componentCode?: string;
}): string {
  const { code, componentName, componentFilePath, componentCode } = params;
  const specifier = computeComponentImportSpecifier(componentFilePath);
  const existingImportRegex = new RegExp(
    `import\\s+[^;\\n]*\\b${componentName}\\b[^;\\n]*from\\s+['"][^'"]+['"]`
  );
  if (existingImportRegex.test(code)) return code;

  const isNamedOnly =
    Boolean(componentCode) &&
    !/export\s+default\b/.test(componentCode || '') &&
    new RegExp(`export\\s+(?:function|const|class)\\s+${componentName}\\b`).test(
      componentCode || ''
    );

  const importLine = isNamedOnly
    ? `import { ${componentName} } from '${specifier}';`
    : `import ${componentName} from '${specifier}';`;

  const importLines = [...code.matchAll(/^import\s+[^\n]+\n?/gm)];
  if (importLines.length > 0) {
    const last = importLines[importLines.length - 1];
    const insertPos = (last.index ?? 0) + last[0].length;
    const sep = last[0].endsWith('\n') ? '' : '\n';
    return code.slice(0, insertPos) + sep + importLine + '\n' + code.slice(insertPos);
  }

  const useClientMatch = code.match(/^['"]use client['"];?\s*\n?/);
  if (useClientMatch) {
    const insertPos = useClientMatch[0].length;
    return code.slice(0, insertPos) + importLine + '\n' + code.slice(insertPos);
  }

  return `${importLine}\n${code}`;
}

export function formatComponentJsxTag(
  componentName: string,
  props?: Record<string, string>
): string {
  const entries = Object.entries(props || {}).filter(
    ([k, v]) => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(k) && v !== undefined && v !== ''
  );
  if (entries.length === 0) return `<${componentName} />`;
  const attrs = entries
    .map(([k, v]) => `${k}="${v.replace(/"/g, '&quot;')}"`)
    .join(' ');
  return `<${componentName} ${attrs} />`;
}

export function replaceElementWithComponentInSource(params: {
  targetCode: string;
  targetFilePath: string;
  elementIndex: number;
  componentName: string;
  componentFilePath: string;
  componentCode?: string;
  props?: Record<string, string>;
}): string | null {
  const {
    targetCode,
    targetFilePath,
    elementIndex,
    componentName,
    componentFilePath,
    componentCode,
    props,
  } = params;
  if (targetFilePath === componentFilePath) return null;
  if (/\.html?$/i.test(targetFilePath)) return null;

  const elements = scanElements(targetCode, false);
  const el = elements[elementIndex];
  if (!el || el.closeEnd <= el.openStart) return null;

  const jsxTag = formatComponentJsxTag(componentName, props);
  const replaced =
    targetCode.slice(0, el.openStart) + jsxTag + targetCode.slice(el.closeEnd);

  return ensureComponentImportInSource({
    code: replaced,
    componentName,
    componentFilePath,
    componentCode,
  });
}

export function insertJsxSnippetIntoSource(params: {
  targetCode: string;
  targetElementIndex: number;
  position: ComponentInsertPosition;
  jsxSnippet: string;
}): string | null {
  const { targetCode, targetElementIndex, position, jsxSnippet } = params;
  const elements = scanElements(targetCode, false);
  if (elements.length === 0) return null;

  const el = elements[targetElementIndex] ?? elements[0];
  if (!el) return null;

  let insertPos = el.closeEnd;
  let effectivePos = position;
  if ((effectivePos === 'inside-start' || effectivePos === 'inside-end') && el.selfClosing) {
    effectivePos = 'after';
  }

  // Never insert before/after top-level return root element when it has no parent; insert inside instead
  if (el.parentIndex < 0 && (effectivePos === 'before' || effectivePos === 'after')) {
    if (!el.selfClosing) {
      effectivePos = effectivePos === 'before' ? 'inside-start' : 'inside-end';
    } else {
      return null;
    }
  }

  if (effectivePos === 'before') insertPos = el.openStart;
  else if (effectivePos === 'after') insertPos = el.closeEnd;
  else if (effectivePos === 'inside-start') insertPos = el.openEnd;
  else insertPos = el.closeStart;

  const block =
    effectivePos === 'before' || effectivePos === 'inside-end'
      ? `\n${jsxSnippet}\n`
      : `\n${jsxSnippet}`;

  return targetCode.slice(0, insertPos) + block + targetCode.slice(insertPos);
}

export function insertComponentIntoSource(params: {
  targetCode: string;
  targetFilePath: string;
  targetElementIndex: number;
  position: ComponentInsertPosition;
  componentName: string;
  componentFilePath: string;
  componentCode?: string;
  props?: Record<string, string>;
}): string | null {
  const {
    targetCode,
    targetFilePath,
    targetElementIndex,
    position,
    componentName,
    componentFilePath,
    componentCode,
    props,
  } = params;
  if (targetFilePath === componentFilePath) return null;
  if (/\.html?$/i.test(targetFilePath)) return null;

  const jsxTag = formatComponentJsxTag(componentName, props);
  const withTag = insertJsxSnippetIntoSource({
    targetCode,
    targetElementIndex,
    position,
    jsxSnippet: jsxTag,
  });
  if (!withTag) return null;

  return ensureComponentImportInSource({
    code: withTag,
    componentName,
    componentFilePath,
    componentCode,
  });
}

