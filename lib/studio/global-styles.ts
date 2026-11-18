import { ProjectFramework } from './types';

export type CssVarScope = ':root' | '@theme' | '.dark';

export interface GlobalCssVariable {
  id: string;
  name: string;
  value: string;
  scope: CssVarScope;
}

export interface GlobalBaseStyles {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  backgroundColor: string;
  color: string;
  headingFontFamily: string;
  headingColor: string;
  linkColor: string;
}

export interface GlobalCssDeclaration {
  property: string;
  value: string;
}

export interface GlobalCssRule {
  id: string;
  selector: string;
  declarations: GlobalCssDeclaration[];
}

export interface ParsedGlobalStyles {
  hasTailwindImport: boolean;
  hasDarkVariant: boolean;
  variables: GlobalCssVariable[];
  base: GlobalBaseStyles;
  customRules: GlobalCssRule[];
}

export interface GlobalThemePreset {
  id: string;
  name: string;
  description: string;
  fontFamily: string;
  backgroundColor: string;
  color: string;
  variables: Array<{ name: string; value: string; scope?: CssVarScope }>;
}

export const FONT_FAMILY_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" },
  { label: 'DM Sans', value: "'DM Sans', system-ui, -apple-system, sans-serif" },
  { label: 'Manrope', value: "'Manrope', system-ui, -apple-system, sans-serif" },
  { label: 'Outfit', value: "'Outfit', system-ui, -apple-system, sans-serif" },
  { label: 'Bricolage Grotesque', value: "'Bricolage Grotesque', system-ui, sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', Georgia, serif" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: 'System UI', value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
];

export const GLOBAL_THEME_PRESETS: GlobalThemePreset[] = [
  {
    id: 'nordic-crisp',
    name: 'Nordic Crisp',
    description: 'Clean alabaster canvas, slate ink, cobalt accent',
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    variables: [
      { name: '--bg-canvas', value: '#F8FAFC', scope: ':root' },
      { name: '--bg-surface', value: '#FFFFFF', scope: ':root' },
      { name: '--text-primary', value: '#0F172A', scope: ':root' },
      { name: '--text-muted', value: '#475569', scope: ':root' },
      { name: '--accent-primary', value: '#2563EB', scope: ':root' },
      { name: '--border-subtle', value: '#E2E8F0', scope: ':root' },
      { name: '--radius-base', value: '12px', scope: ':root' },
    ],
  },
  {
    id: 'midnight-studio',
    name: 'Midnight Slate',
    description: 'Deep obsidian surface with electric sky highlight',
    fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
    backgroundColor: '#0F172A',
    color: '#F1F5F9',
    variables: [
      { name: '--bg-canvas', value: '#0F172A', scope: ':root' },
      { name: '--bg-surface', value: '#1E293B', scope: ':root' },
      { name: '--text-primary', value: '#F1F5F9', scope: ':root' },
      { name: '--text-muted', value: '#94A3B8', scope: ':root' },
      { name: '--accent-primary', value: '#38BDF8', scope: ':root' },
      { name: '--border-subtle', value: '#334155', scope: ':root' },
      { name: '--radius-base', value: '12px', scope: ':root' },
    ],
  },
  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    description: 'Stone paper surface, charcoal ink, terracotta CTA',
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
    backgroundColor: '#FAF8F5',
    color: '#1C1917',
    variables: [
      { name: '--bg-canvas', value: '#FAF8F5', scope: ':root' },
      { name: '--bg-surface', value: '#FFFFFF', scope: ':root' },
      { name: '--text-primary', value: '#1C1917', scope: ':root' },
      { name: '--text-muted', value: '#57534E', scope: ':root' },
      { name: '--accent-primary', value: '#C2410C', scope: ':root' },
      { name: '--border-subtle', value: '#E7E5E4', scope: ':root' },
      { name: '--radius-base', value: '8px', scope: ':root' },
    ],
  },
  {
    id: 'emerald-precision',
    name: 'Forest Signal',
    description: 'Crisp mint-neutral surface with deep emerald focus',
    fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
    backgroundColor: '#F9FAFB',
    color: '#111827',
    variables: [
      { name: '--bg-canvas', value: '#F9FAFB', scope: ':root' },
      { name: '--bg-surface', value: '#FFFFFF', scope: ':root' },
      { name: '--text-primary', value: '#111827', scope: ':root' },
      { name: '--text-muted', value: '#4B5563', scope: ':root' },
      { name: '--accent-primary', value: '#059669', scope: ':root' },
      { name: '--border-subtle', value: '#E5E7EB', scope: ':root' },
      { name: '--radius-base', value: '10px', scope: ':root' },
    ],
  },
];

export const STARTER_CLASS_TEMPLATES: Array<{
  label: string;
  selector: string;
  declarations: GlobalCssDeclaration[];
}> = [
  {
    label: '.surface-card',
    selector: '.surface-card',
    declarations: [
      { property: 'background-color', value: 'var(--bg-surface, #ffffff)' },
      { property: 'border', value: '1px solid var(--border-subtle, #e2e8f0)' },
      { property: 'border-radius', value: 'var(--radius-base, 12px)' },
      { property: 'padding', value: '24px' },
    ],
  },
  {
    label: '.btn-primary',
    selector: '.btn-primary',
    declarations: [
      { property: 'background-color', value: 'var(--accent-primary, #2563eb)' },
      { property: 'color', value: '#ffffff' },
      { property: 'border-radius', value: '8px' },
      { property: 'padding', value: '10px 18px' },
      { property: 'font-weight', value: '600' },
    ],
  },
  {
    label: '.glass-panel',
    selector: '.glass-panel',
    declarations: [
      { property: 'background', value: 'rgba(255, 255, 255, 0.72)' },
      { property: 'backdrop-filter', value: 'blur(12px)' },
      { property: 'border', value: '1px solid rgba(226, 232, 240, 0.8)' },
      { property: 'border-radius', value: '14px' },
    ],
  },
];

export function getRecommendedCssFileName(framework: ProjectFramework): string {
  switch (framework) {
    case 'nextjs-app':
      return 'app/globals.css';
    case 'nextjs-pages':
      return 'styles/globals.css';
    case 'react-vite':
      return 'src/index.css';
    case 'html':
    default:
      return 'styles.css';
  }
}

export function resolveDefaultGlobalCssPath(
  files: Record<string, string>,
  globalCssPaths: string[],
  framework: ProjectFramework
): { activePath: string; exists: boolean } {
  const priority = [
    'app/globals.css',
    'src/app/globals.css',
    'styles/globals.css',
    'src/index.css',
    'src/styles/globals.css',
    'styles.css',
    'style.css',
  ];
  for (const candidate of priority) {
    if (files[candidate] !== undefined) {
      return { activePath: candidate, exists: true };
    }
  }
  const firstFound = globalCssPaths.find((p) => files[p] !== undefined);
  if (firstFound) {
    return { activePath: firstFound, exists: true };
  }
  return { activePath: getRecommendedCssFileName(framework), exists: false };
}

export function createStarterGlobalCss(framework: ProjectFramework): string {
  const tailwindHeader = framework === 'html' ? '' : '@import "tailwindcss";\n\n';
  return `${tailwindHeader}:root {
  --bg-canvas: #F8FAFC;
  --bg-surface: #FFFFFF;
  --text-primary: #0F172A;
  --accent-primary: #2563EB;
  --border-subtle: #E2E8F0;
  --radius-base: 12px;
}

body {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  background-color: #f8fafc;
  color: #0f172a;
}
`;
}

export function normalizeCssVariableName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^--+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned ? `--${cleaned}` : '';
}

export function isColorLikeValue(value: string): boolean {
  const v = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return true;
  if (/^(rgb|rgba|hsl|hsla|oklch)\(/i.test(v)) return true;
  return false;
}

export function toPickerHex(value: string, fallback = '#2563EB'): string {
  const v = value.trim();
  const hex3 = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hex3) {
    return `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`.toUpperCase();
  }
  const hex6 = v.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (hex6) {
    return `#${hex6[1]}`.toUpperCase();
  }
  return fallback;
}

interface RawCssBlock {
  header: string;
  body: string;
  openBraceIndex: number;
  closeBraceIndex: number;
  startIndex: number;
}

function findTopLevelCssBlocks(css: string): RawCssBlock[] {
  const blocks: RawCssBlock[] = [];
  let i = 0;
  let statementStart = 0;
  const len = css.length;

  while (i < len) {
    const ch = css[i];
    // Skip comments
    if (ch === '/' && css[i + 1] === '*') {
      const endComment = css.indexOf('*/', i + 2);
      i = endComment === -1 ? len : endComment + 2;
      continue;
    }
    // Skip quoted strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < len) {
        if (css[i] === '\\') {
          i += 2;
          continue;
        }
        if (css[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === ';') {
      statementStart = i + 1;
      i += 1;
      continue;
    }
    if (ch === '{') {
      const openBrace = i;
      let depth = 1;
      i += 1;
      while (i < len && depth > 0) {
        if (css[i] === '/' && css[i + 1] === '*') {
          const endComment = css.indexOf('*/', i + 2);
          i = endComment === -1 ? len : endComment + 2;
          continue;
        }
        if (css[i] === '"' || css[i] === "'") {
          const q = css[i];
          i += 1;
          while (i < len) {
            if (css[i] === '\\') {
              i += 2;
              continue;
            }
            if (css[i] === q) {
              i += 1;
              break;
            }
            i += 1;
          }
          continue;
        }
        if (css[i] === '{') depth += 1;
        else if (css[i] === '}') depth -= 1;
        i += 1;
      }
      if (depth === 0) {
        const closeBrace = i - 1;
        let effectiveStart = statementStart;
        const segment = css.slice(statementStart, openBrace);
        // Handle directive lines (e.g. @import "tailwindcss") lacking a trailing semicolon
        const directivePrefixMatch = segment.match(
          /^(?:\s*(?:\/\*[\s\S]*?\*\/\s*)*@(?:import|tailwind|custom-variant|charset|namespace)\b[^\n]*\n+)+/i
        );
        if (directivePrefixMatch) {
          effectiveStart += directivePrefixMatch[0].length;
        }
        const rawHeader = css
          .slice(effectiveStart, openBrace)
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .trim();
        const body = css.slice(openBrace + 1, closeBrace);
        if (rawHeader) {
          blocks.push({
            header: rawHeader,
            body,
            openBraceIndex: openBrace,
            closeBraceIndex: closeBrace,
            startIndex: effectiveStart,
          });
        }
        statementStart = i;
      }
      continue;
    }
    i += 1;
  }

  return blocks;
}

function parseDeclarations(body: string): GlobalCssDeclaration[] {
  const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, '');
  const decls: GlobalCssDeclaration[] = [];
  let current = '';
  let parenDepth = 0;
  let quote: string | null = null;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && i + 1 < cleaned.length) {
        current += cleaned[i + 1];
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') parenDepth += 1;
    else if (ch === ')' && parenDepth > 0) parenDepth -= 1;

    if (ch === ';' && parenDepth === 0) {
      const colonIdx = current.indexOf(':');
      if (colonIdx > 0) {
        const property = current.slice(0, colonIdx).trim();
        const value = current.slice(colonIdx + 1).trim();
        if (property && value) {
          decls.push({ property, value });
        }
      }
      current = '';
    } else {
      current += ch;
    }
  }
  const tail = current.trim();
  if (tail) {
    const colonIdx = tail.indexOf(':');
    if (colonIdx > 0) {
      const property = tail.slice(0, colonIdx).trim();
      const value = tail.slice(colonIdx + 1).trim();
      if (property && value) {
        decls.push({ property, value });
      }
    }
  }

  return decls;
}

function formatDeclarations(decls: GlobalCssDeclaration[]): string {
  if (decls.length === 0) return '';
  return `\n${decls.map((d) => `  ${d.property}: ${d.value};`).join('\n')}\n`;
}

function normalizeScopeHeader(header: string): CssVarScope | null {
  const norm = header.replace(/\s+/g, ' ').trim();
  if (norm === ':root') return ':root';
  if (/^@theme(?:\s+inline)?$/i.test(norm)) return '@theme';
  if (norm === '.dark' || norm === ':root.dark') return '.dark';
  return null;
}

export function parseGlobalStyles(css: string): ParsedGlobalStyles {
  const hasTailwindImport = /@import\s+["']tailwindcss["']|@tailwind\s+utilities/i.test(css);
  const hasDarkVariant = /@custom-variant\s+dark\s+/i.test(css);

  const blocks = findTopLevelCssBlocks(css);
  const variables: GlobalCssVariable[] = [];
  const customRules: GlobalCssRule[] = [];
  const base: GlobalBaseStyles = {
    fontFamily: '',
    fontSize: '',
    lineHeight: '',
    backgroundColor: '',
    color: '',
    headingFontFamily: '',
    headingColor: '',
    linkColor: '',
  };

  const varIndexByKey = new Map<string, number>();

  for (const block of blocks) {
    const scope = normalizeScopeHeader(block.header);
    const decls = parseDeclarations(block.body);

    if (scope) {
      for (const d of decls) {
        if (d.property.startsWith('--')) {
          const id = `${scope}::${d.property}`;
          const existingIdx = varIndexByKey.get(id);
          if (existingIdx !== undefined) {
            variables[existingIdx] = {
              id,
              name: d.property,
              value: d.value,
              scope,
            };
          } else {
            varIndexByKey.set(id, variables.length);
            variables.push({
              id,
              name: d.property,
              value: d.value,
              scope,
            });
          }
        }
      }
      continue;
    }

    if (block.header === 'body') {
      for (const d of decls) {
        const prop = d.property.toLowerCase();
        if (prop === 'font-family') base.fontFamily = d.value;
        else if (prop === 'font-size') base.fontSize = d.value;
        else if (prop === 'line-height') base.lineHeight = d.value;
        else if (prop === 'background-color' || prop === 'background') {
          base.backgroundColor = d.value;
        } else if (prop === 'color') base.color = d.value;
      }
      continue;
    }

    if (/^h1(?:\s*,\s*h[2-6])*$/i.test(block.header)) {
      for (const d of decls) {
        const prop = d.property.toLowerCase();
        if (prop === 'font-family') base.headingFontFamily = d.value;
        else if (prop === 'color') base.headingColor = d.value;
      }
      continue;
    }

    if (block.header === 'a') {
      for (const d of decls) {
        if (d.property.toLowerCase() === 'color') base.linkColor = d.value;
      }
      continue;
    }

    if (block.header.startsWith('@') || block.header === '*') {
      continue;
    }

    customRules.push({
      id: `${block.header}::${customRules.length}`,
      selector: block.header,
      declarations: decls,
    });
  }

  return {
    hasTailwindImport,
    hasDarkVariant,
    variables,
    base,
    customRules,
  };
}

function replaceBlockBody(
  css: string,
  matchesHeader: (header: string) => boolean,
  defaultHeader: string,
  mutateDecls: (existing: GlobalCssDeclaration[]) => GlobalCssDeclaration[],
  insertAnchor: 'top-vars' | 'after-root' | 'end' = 'end'
): string {
  const blocks = findTopLevelCssBlocks(css);
  const target = blocks.find((b) => matchesHeader(b.header.replace(/\s+/g, ' ').trim()));

  if (target) {
    const existing = parseDeclarations(target.body);
    const nextDecls = mutateDecls(existing);
    if (nextDecls.length === 0) {
      // Remove empty block cleanly
      const before = css.slice(0, target.startIndex).replace(/\n+$/, '');
      const after = css.slice(target.closeBraceIndex + 1).replace(/^\n+/, '');
      if (!before) return after ? `${after}\n` : '';
      if (!after) return `${before}\n`;
      return `${before}\n\n${after}`;
    }
    const formatted = formatDeclarations(nextDecls);
    return (
      css.slice(0, target.openBraceIndex + 1) +
      formatted +
      css.slice(target.closeBraceIndex)
    );
  }

  const nextDecls = mutateDecls([]);
  if (nextDecls.length === 0) return css;
  const newBlock = `${defaultHeader} {${formatDeclarations(nextDecls)}}`;

  if (insertAnchor === 'top-vars') {
    const headerDirectiveMatch = css.match(
      /^(?:@(?:import|tailwind|custom-variant)[^\n]*\n+)+/i
    );
    if (headerDirectiveMatch) {
      const idx = headerDirectiveMatch[0].length;
      const head = css.slice(0, idx).replace(/\n+$/, '');
      const tail = css.slice(idx).replace(/^\n+/, '');
      return tail ? `${head}\n\n${newBlock}\n\n${tail}` : `${head}\n\n${newBlock}\n`;
    }
    const trimmed = css.trimStart();
    return trimmed ? `${newBlock}\n\n${trimmed}` : `${newBlock}\n`;
  }

  const trimmedEnd = css.replace(/\s+$/, '');
  return trimmedEnd ? `${trimmedEnd}\n\n${newBlock}\n` : `${newBlock}\n`;
}

function applyScopedBlocksMutation(
  css: string,
  scope: CssVarScope,
  mutateBlock: (
    existing: GlobalCssDeclaration[],
    blockIndex: number,
    matchingCount: number
  ) => GlobalCssDeclaration[]
): string {
  const blocks = findTopLevelCssBlocks(css);
  const matchingBlocks = blocks.filter((b) => normalizeScopeHeader(b.header) === scope);
  if (matchingBlocks.length === 0) return css;

  let next = css;
  // Apply from back to front so earlier character offsets remain valid
  for (let idx = matchingBlocks.length - 1; idx >= 0; idx--) {
    const target = matchingBlocks[idx];
    const existing = parseDeclarations(target.body);
    const nextDecls = mutateBlock(existing, idx, matchingBlocks.length);
    if (nextDecls.length === 0) {
      const before = next.slice(0, target.startIndex).replace(/\n+$/, '');
      const after = next.slice(target.closeBraceIndex + 1).replace(/^\n+/, '');
      if (!before) next = after ? `${after}\n` : '';
      else if (!after) next = `${before}\n`;
      else next = `${before}\n\n${after}`;
    } else {
      const formatted = formatDeclarations(nextDecls);
      next =
        next.slice(0, target.openBraceIndex + 1) +
        formatted +
        next.slice(target.closeBraceIndex);
    }
  }
  return next;
}

export function setGlobalCssVariable(
  css: string,
  rawName: string,
  value: string,
  scope: CssVarScope = ':root'
): string {
  const name = normalizeCssVariableName(rawName);
  const cleanVal = value.trim();
  if (!name || !cleanVal) return css;

  const blocks = findTopLevelCssBlocks(css);
  const matchingBlocks = blocks.filter((b) => normalizeScopeHeader(b.header) === scope);
  if (matchingBlocks.length === 0) {
    return replaceBlockBody(
      css,
      (h) => normalizeScopeHeader(h) === scope,
      scope,
      () => [{ property: name, value: cleanVal }],
      'top-vars'
    );
  }

  // Keep/update the variable in the first matching block that defines it (or block 0),
  // and strip stale duplicate definitions of `name` inside that block or sibling blocks of `scope`.
  const firstDefiningIdx = matchingBlocks.findIndex((b) =>
    parseDeclarations(b.body).some((d) => d.property === name)
  );
  const keeperBlockIdx = firstDefiningIdx >= 0 ? firstDefiningIdx : 0;

  return applyScopedBlocksMutation(css, scope, (existing, blockIndex) => {
    if (blockIndex !== keeperBlockIdx) {
      return existing.filter((d) => d.property !== name);
    }
    const firstDeclIdx = existing.findIndex((d) => d.property === name);
    if (firstDeclIdx >= 0) {
      return existing
        .filter((d, i) => d.property !== name || i === firstDeclIdx)
        .map((d, i) => (i === firstDeclIdx ? { property: name, value: cleanVal } : d));
    }
    return [...existing, { property: name, value: cleanVal }];
  });
}

export function removeGlobalCssVariable(
  css: string,
  name: string,
  scope: CssVarScope = ':root'
): string {
  const cleanName = normalizeCssVariableName(name);
  if (!cleanName) return css;

  return applyScopedBlocksMutation(css, scope, (existing) =>
    existing.filter((d) => d.property !== cleanName)
  );
}

function setOrDeleteProperty(
  decls: GlobalCssDeclaration[],
  property: string,
  value: string | undefined,
  aliases: string[] = []
): GlobalCssDeclaration[] {
  if (value === undefined) return decls;
  const trimmed = value.trim();
  const matchNames = new Set([property, ...aliases].map((p) => p.toLowerCase()));
  const filtered = decls.filter((d) => !matchNames.has(d.property.toLowerCase()));
  if (!trimmed) return filtered;
  return [...filtered, { property, value: trimmed }];
}

export function updateGlobalBaseStyles(
  css: string,
  patch: Partial<GlobalBaseStyles>
): string {
  let next = css;

  if (
    patch.fontFamily !== undefined ||
    patch.fontSize !== undefined ||
    patch.lineHeight !== undefined ||
    patch.backgroundColor !== undefined ||
    patch.color !== undefined
  ) {
    next = replaceBlockBody(
      next,
      (h) => h === 'body',
      'body',
      (existing) => {
        let updated = [...existing];
        updated = setOrDeleteProperty(updated, 'font-family', patch.fontFamily);
        updated = setOrDeleteProperty(updated, 'font-size', patch.fontSize);
        updated = setOrDeleteProperty(updated, 'line-height', patch.lineHeight);
        updated = setOrDeleteProperty(updated, 'background-color', patch.backgroundColor, [
          'background',
        ]);
        updated = setOrDeleteProperty(updated, 'color', patch.color);
        return updated;
      },
      'end'
    );
  }

  if (patch.headingFontFamily !== undefined || patch.headingColor !== undefined) {
    next = replaceBlockBody(
      next,
      (h) => /^h1(?:\s*,\s*h[2-6])*$/i.test(h),
      'h1, h2, h3, h4',
      (existing) => {
        let updated = [...existing];
        updated = setOrDeleteProperty(updated, 'font-family', patch.headingFontFamily);
        updated = setOrDeleteProperty(updated, 'color', patch.headingColor);
        return updated;
      },
      'end'
    );
  }

  if (patch.linkColor !== undefined) {
    next = replaceBlockBody(
      next,
      (h) => h === 'a',
      'a',
      (existing) => setOrDeleteProperty([...existing], 'color', patch.linkColor),
      'end'
    );
  }

  return next;
}

export function upsertGlobalCustomRule(
  css: string,
  rawSelector: string,
  declarations: GlobalCssDeclaration[]
): string {
  const selector = rawSelector.trim();
  if (!selector) return css;
  const cleanDecls = declarations
    .map((d) => ({ property: d.property.trim(), value: d.value.trim() }))
    .filter((d) => d.property && d.value);

  return replaceBlockBody(
    css,
    (h) => h === selector,
    selector,
    () => cleanDecls,
    'end'
  );
}

export function removeGlobalCustomRule(css: string, selector: string): string {
  const cleanSelector = selector.trim();
  if (!cleanSelector) return css;
  return replaceBlockBody(
    css,
    (h) => h === cleanSelector,
    cleanSelector,
    () => [],
    'end'
  );
}

export function setDarkCustomVariant(css: string, enabled: boolean): string {
  const directive = '@custom-variant dark (&:where(.dark, .dark *));';
  const hasVariant = /@custom-variant\s+dark\s+[^;\n]+;?/i.test(css);
  if (enabled) {
    if (hasVariant) return css;
    const twImport = css.match(/^@import\s+["']tailwindcss["']\s*;?\s*/i);
    if (twImport) {
      const idx = twImport[0].length;
      const tail = css.slice(idx).replace(/^\n+/, '');
      return `${twImport[0].trimEnd()}\n${directive}\n\n${tail}`;
    }
    return `${directive}\n\n${css.replace(/^\n+/, '')}`;
  }
  if (!hasVariant) return css;
  return css
    .replace(/@custom-variant\s+dark\s+[^;\n]+;?\n*/gi, '')
    .replace(/^\n+/, '');
}

export function applyGlobalThemePreset(css: string, presetId: string): string {
  const preset = GLOBAL_THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return css;
  let next = css;
  for (const v of preset.variables) {
    next = setGlobalCssVariable(next, v.name, v.value, v.scope || ':root');
  }
  next = updateGlobalBaseStyles(next, {
    fontFamily: preset.fontFamily,
    backgroundColor: preset.backgroundColor,
    color: preset.color,
  });
  return next;
}
