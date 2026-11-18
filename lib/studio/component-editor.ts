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
  const fnMatch =
    code.match(/export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)/) ||
    code.match(/export\s+function\s+([A-Z][A-Za-z0-9_]*)/) ||
    code.match(/const\s+([A-Z][A-Za-z0-9_]*)\s*=/) ||
    code.match(/function\s+([A-Z][A-Za-z0-9_]*)/);
  if (fnMatch) return fnMatch[1];
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

export function createComponentFileTemplate(rawName: string): {
  componentName: string;
  filePath: string;
  code: string;
} {
  const componentName = toPascalCase(rawName);
  const filePath = `components/${componentName}.tsx`;
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
