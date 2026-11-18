import { ElementSourcePatch } from './types';

export interface ParsedElement {
  index: number;
  tagName: string;
  openStart: number;
  tagNameEnd: number;
  openEnd: number;
  selfClosing: boolean;
  closeStart: number;
  closeEnd: number;
  parentIndex: number;
  childIndices: number[];
}

const HTML_VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const KNOWN_HTML_SVG_TAGS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
  'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label',
  'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noscript',
  'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'picture', 'pre', 'progress',
  'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'slot',
  'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody',
  'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u',
  'ul', 'var', 'video', 'wbr', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'g', 'defs', 'linearGradient', 'radialGradient', 'stop',
]);

function isIdentChar(ch: string): boolean {
  return /[a-zA-Z0-9_$.]/.test(ch);
}

function skipQuoted(code: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (quote === '`' && ch === '$' && code[i + 1] === '{') {
      i += 2;
      let depth = 1;
      while (i < code.length && depth > 0) {
        const c = code[i];
        if (c === "'" || c === '"' || c === '`') {
          i = skipQuoted(code, i, c);
          continue;
        }
        if (c === '/' && code[i + 1] === '/') {
          i = skipLineComment(code, i);
          continue;
        }
        if (c === '/' && code[i + 1] === '*') {
          i = skipBlockComment(code, i);
          continue;
        }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        i++;
      }
      continue;
    }
    if (ch === quote) return i + 1;
    i++;
  }
  return code.length;
}

function skipLineComment(code: string, start: number): number {
  const nl = code.indexOf('\n', start);
  return nl === -1 ? code.length : nl + 1;
}

function skipBlockComment(code: string, start: number): number {
  const end = code.indexOf('*/', start + 2);
  return end === -1 ? code.length : end + 2;
}

function isLikelyJsxTagStart(code: string, ltPos: number, isHtml: boolean): boolean {
  const next = code[ltPos + 1];
  if (!next || !/[A-Za-z>]/.test(next)) return false;
  if (isHtml) return true;

  // Fragment <>
  if (next === '>') return true;

  // Read tag identifier
  let j = ltPos + 1;
  while (j < code.length && /[A-Za-z0-9_$.]/.test(code[j])) j++;
  const tagName = code.slice(ltPos + 1, j);
  const afterTag = code[j] || '';

  // Must be followed by whitespace, >, or /
  if (!/[\s>/]/.test(afterTag)) return false;

  // Check character immediately before < (skipping horizontal spaces)
  let p = ltPos - 1;
  while (p >= 0 && (code[p] === ' ' || code[p] === '\t')) p--;
  const prevChar = p >= 0 ? code[p] : '';

  // Direct identifier<Type> or fn<Type>() or arr)<T> is TS generic
  if (p === ltPos - 1 && prevChar && /[A-Za-z0-9_$)\]]/.test(prevChar)) {
    return false;
  }
  // Check preceding word for TS keywords/types like `as <T>`, `type X = <T>` etc.
  if (/[a-z]/.test(tagName[0]) && !KNOWN_HTML_SVG_TAGS.has(tagName)) {
    return false;
  }

  // If uppercase tag, verify it's not a TS generic like `<T,>` or `<T extends Foo>`
  if (/^[A-Z]/.test(tagName)) {
    const lookahead = code.slice(j, j + 32);
    if (/^\s*(,|extends\b)/.test(lookahead)) return false;
    // If preceded by `:` (return type annotation) and no `=>` or `?`
    if (prevChar === ':') {
      // Could be ternary `cond ? <A /> : <B />` — only reject if not ternary
      const prevLine = code.slice(Math.max(0, ltPos - 60), ltPos);
      if (!prevLine.includes('?')) return false;
    }
  }

  return true;
}

function findTagOpenEnd(
  code: string,
  startAfterName: number,
  isHtml: boolean
): { openEnd: number; selfClosing: boolean } | null {
  let i = startAfterName;
  let braceDepth = 0;

  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      i = skipQuoted(code, i, ch);
      continue;
    }
    if (!isHtml && braceDepth > 0 && ch === '`') {
      i = skipQuoted(code, i, '`');
      continue;
    }
    if (!isHtml && ch === '{') {
      braceDepth++;
      i++;
      continue;
    }
    if (!isHtml && ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      i++;
      continue;
    }
    if (braceDepth === 0) {
      if (ch === '/' && code[i + 1] === '>') {
        return { openEnd: i + 2, selfClosing: true };
      }
      if (ch === '>') {
        return { openEnd: i + 1, selfClosing: false };
      }
      // Bail if we hit an unclosed semicolon or obvious JS syntax error before >
      if (!isHtml && ch === ';') return null;
    }
    i++;
  }
  return null;
}

export function scanElements(code: string, isHtml: boolean): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const stack: Array<{
    elementIndex: number; // -1 for fragment <>
    tagName: string;
    braceDepthAtOpen: number;
  }> = [];

  let i = 0;
  let braceDepth = 0;

  while (i < code.length) {
    const top = stack[stack.length - 1];
    const inChildrenMode = Boolean(top && braceDepth === top.braceDepthAtOpen);

    // HTML comments
    if (isHtml && code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4);
      i = end === -1 ? code.length : end + 3;
      continue;
    }

    // HTML script / style raw blocks
    if (isHtml && top && (top.tagName.toLowerCase() === 'script' || top.tagName.toLowerCase() === 'style')) {
      const closeTag = `</${top.tagName}`;
      const closePos = code.toLowerCase().indexOf(closeTag.toLowerCase(), i);
      if (closePos === -1) break;
      i = closePos;
    }

    // In JS/TS mode (not inside JSX text children)
    if (!isHtml && !inChildrenMode) {
      const ch = code[i];
      if (ch === '"' || ch === "'" || ch === '`') {
        i = skipQuoted(code, i, ch);
        continue;
      }
      if (ch === '/' && code[i + 1] === '/') {
        i = skipLineComment(code, i);
        continue;
      }
      if (ch === '/' && code[i + 1] === '*') {
        i = skipBlockComment(code, i);
        continue;
      }
      if (ch === '{') {
        braceDepth++;
        i++;
        continue;
      }
      if (ch === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        i++;
        continue;
      }
    }

    // In JSX children mode, { opens a JS expression (including {/* comment */})
    if (!isHtml && inChildrenMode && code[i] === '{') {
      braceDepth++;
      i++;
      continue;
    }

    // Closing tag `</Tag>` or `</>`
    if (code[i] === '<' && code[i + 1] === '/') {
      const closeGt = code.indexOf('>', i + 2);
      if (closeGt !== -1) {
        const closeName = code.slice(i + 2, closeGt).trim();
        // Pop matching tag from stack
        for (let s = stack.length - 1; s >= 0; s--) {
          if (
            stack[s].tagName === closeName ||
            (isHtml && stack[s].tagName.toLowerCase() === closeName.toLowerCase())
          ) {
            // Unwind any unclosed void/implicit tags above it
            while (stack.length - 1 > s) {
              const unclosed = stack.pop()!;
              if (unclosed.elementIndex >= 0) {
                elements[unclosed.elementIndex].closeStart = i;
                elements[unclosed.elementIndex].closeEnd = i;
              }
            }
            const popped = stack.pop()!;
            if (popped.elementIndex >= 0) {
              elements[popped.elementIndex].closeStart = i;
              elements[popped.elementIndex].closeEnd = closeGt + 1;
            }
            braceDepth = popped.braceDepthAtOpen;
            break;
          }
        }
        i = closeGt + 1;
        continue;
      }
    }

    // Opening tag `<Tag ...>` or `<>`
    if (code[i] === '<' && isLikelyJsxTagStart(code, i, isHtml)) {
      if (!isHtml && code[i + 1] === '>') {
        stack.push({ elementIndex: -1, tagName: '', braceDepthAtOpen: braceDepth });
        i += 2;
        continue;
      }

      let nameEnd = i + 1;
      while (nameEnd < code.length && isIdentChar(code[nameEnd])) nameEnd++;
      const tagName = code.slice(i + 1, nameEnd);
      const endInfo = findTagOpenEnd(code, nameEnd, isHtml);

      if (endInfo) {
        const isVoid = HTML_VOID_TAGS.has(tagName.toLowerCase());
        const selfClosing = endInfo.selfClosing || isVoid;

        // Find nearest non-fragment parent
        let parentIndex = -1;
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s].elementIndex >= 0) {
            parentIndex = stack[s].elementIndex;
            break;
          }
        }

        const elIndex = elements.length;
        const parsed: ParsedElement = {
          index: elIndex,
          tagName,
          openStart: i,
          tagNameEnd: nameEnd,
          openEnd: endInfo.openEnd,
          selfClosing,
          closeStart: selfClosing ? endInfo.openEnd : endInfo.openEnd,
          closeEnd: selfClosing ? endInfo.openEnd : endInfo.openEnd,
          parentIndex,
          childIndices: [],
        };
        elements.push(parsed);
        if (parentIndex >= 0) {
          elements[parentIndex].childIndices.push(elIndex);
        }

        if (!selfClosing) {
          stack.push({
            elementIndex: elIndex,
            tagName,
            braceDepthAtOpen: braceDepth,
          });
        }
        i = endInfo.openEnd;
        continue;
      }
    }

    i++;
  }

  return elements;
}

export function instrumentSourceWithStudioIds(
  code: string,
  filePath: string,
  isHtml: boolean
): string {
  const elements = scanElements(code, isHtml);
  if (elements.length === 0) return code;

  // Insert from right to left so offsets stay valid
  let result = code;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const openTagText = result.slice(el.openStart, el.openEnd);
    if (openTagText.includes('data-studio-id')) continue;
    // Skip html/head/script/style/meta/link tags for cleaner DOM tree
    const lower = el.tagName.toLowerCase();
    if (['html', 'head', 'meta', 'link', 'script', 'style', 'title'].includes(lower)) {
      continue;
    }
    const attr = ` data-studio-id="${filePath}::${el.index}"`;
    result =
      result.slice(0, el.tagNameEnd) +
      attr +
      result.slice(el.tagNameEnd);
  }
  return result;
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

function findAttributeRange(
  openTag: string,
  attrName: string,
  isHtml: boolean
): { start: number; end: number; valueStart: number; valueEnd: number; kind: 'string' | 'expr' } | null {
  // Scan attributes after `<tagName`
  let i = 1;
  while (i < openTag.length && isIdentChar(openTag[i])) i++;

  while (i < openTag.length) {
    // Skip whitespace
    while (i < openTag.length && /\s/.test(openTag[i])) i++;
    if (i >= openTag.length || openTag[i] === '>' || (openTag[i] === '/' && openTag[i + 1] === '>')) {
      break;
    }
    // JSX spread `{...props}`
    if (!isHtml && openTag[i] === '{') {
      let depth = 1;
      i++;
      while (i < openTag.length && depth > 0) {
        if (openTag[i] === '"' || openTag[i] === "'" || openTag[i] === '`') {
          i = skipQuoted(openTag, i, openTag[i]);
          continue;
        }
        if (openTag[i] === '{') depth++;
        else if (openTag[i] === '}') depth--;
        i++;
      }
      continue;
    }

    const attrStart = i;
    while (i < openTag.length && /[A-Za-z0-9_:-]/.test(openTag[i])) i++;
    const name = openTag.slice(attrStart, i);

    while (i < openTag.length && /\s/.test(openTag[i])) i++;
    if (openTag[i] !== '=') {
      // Boolean attribute
      continue;
    }
    i++; // skip '='
    while (i < openTag.length && /\s/.test(openTag[i])) i++;

    const valueStart = i;
    let valueEnd = i;
    let kind: 'string' | 'expr' = 'string';

    if (openTag[i] === '"' || openTag[i] === "'") {
      valueEnd = skipQuoted(openTag, i, openTag[i]);
      kind = 'string';
    } else if (!isHtml && openTag[i] === '{') {
      let depth = 1;
      i++;
      while (i < openTag.length && depth > 0) {
        if (openTag[i] === '"' || openTag[i] === "'" || openTag[i] === '`') {
          i = skipQuoted(openTag, i, openTag[i]);
          continue;
        }
        if (openTag[i] === '{') depth++;
        else if (openTag[i] === '}') depth--;
        i++;
      }
      valueEnd = i;
      kind = 'expr';
    } else {
      while (i < openTag.length && !/[\s>]/.test(openTag[i])) i++;
      valueEnd = i;
    }

    if (name === attrName) {
      return { start: attrStart, end: valueEnd, valueStart, valueEnd, kind };
    }
    i = valueEnd;
  }
  return null;
}

function parseJsxStyleObject(exprText: string): { entries: Record<string, string>; spreadPrefix?: string } {
  // exprText is like `{{ color: '#fff', paddingTop: '12px' }}` or `{existingVar}`
  const trimmed = exprText.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return { entries: {} };
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner.startsWith('{') || !inner.endsWith('}')) {
    // Dynamic expression like `style={myStyle}`
    return { entries: {}, spreadPrefix: inner };
  }
  const objBody = inner.slice(1, -1).trim();
  const entries: Record<string, string> = {};
  if (!objBody) return { entries };

  // Split top-level commas
  const pairs: string[] = [];
  let cur = '';
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < objBody.length; i++) {
    const ch = objBody[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && i + 1 < objBody.length) {
        cur += objBody[++i];
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (cur.trim()) pairs.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) pairs.push(cur.trim());

  const spreads: string[] = [];
  for (const pair of pairs) {
    if (pair.startsWith('...')) {
      spreads.push(pair);
      continue;
    }
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) continue;
    const rawKey = pair.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
    const rawVal = pair.slice(colonIdx + 1).trim();
    const unquoted =
      (rawVal.startsWith("'") && rawVal.endsWith("'")) ||
      (rawVal.startsWith('"') && rawVal.endsWith('"'))
        ? rawVal.slice(1, -1)
        : rawVal;
    if (rawKey) entries[rawKey] = unquoted;
  }

  return { entries, spreadPrefix: spreads.length > 0 ? spreads.join(', ') : undefined };
}

function formatJsxStyleAttr(entries: Record<string, string>, spreadPrefix?: string): string {
  const parts: string[] = [];
  if (spreadPrefix) {
    parts.push(spreadPrefix.startsWith('...') ? spreadPrefix : `...${spreadPrefix}`);
  }
  for (const [k, v] of Object.entries(entries)) {
    const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${k}'`;
    const escapedVal = v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    parts.push(`${safeKey}: '${escapedVal}'`);
  }
  if (parts.length === 0) return '';
  return `style={{ ${parts.join(', ')} }}`;
}

function parseHtmlStyleAttr(raw: string): Record<string, string> {
  const inner = raw.replace(/^['"]|['"]$/g, '');
  const entries: Record<string, string> = {};
  const parts = inner.split(';');
  for (const part of parts) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const k = kebabToCamel(part.slice(0, colon).trim().toLowerCase());
    const v = part.slice(colon + 1).trim();
    if (k && v) entries[k] = v;
  }
  return entries;
}

function formatHtmlStyleAttr(entries: Record<string, string>): string {
  const pairs = Object.entries(entries)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`);
  if (pairs.length === 0) return '';
  return `style="${pairs.join('; ').replace(/"/g, '&quot;')}"`;
}

export function applyElementPatchToSource(
  code: string,
  elementIndex: number,
  isHtml: boolean,
  patch: ElementSourcePatch
): string {
  const elements = scanElements(code, isHtml);
  const el = elements[elementIndex];
  if (!el) return code;

  let updated = code;

  // 1. Update text content first (after openEnd, so openTag offsets stay unchanged!)
  if (patch.textContent !== undefined && !el.selfClosing && el.closeStart >= el.openEnd) {
    const inner = updated.slice(el.openEnd, el.closeStart);
    if (el.childIndices.length === 0) {
      // Pure text element: preserve leading/trailing whitespace if multiline
      const leadingWs = inner.match(/^\s*/)?.[0] ?? '';
      const trailingWs = inner.match(/\s*$/)?.[0] ?? '';
      const safeText = isHtml
        ? patch.textContent
        : patch.textContent.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
      const replacement = inner.includes('\n')
        ? `${leadingWs}${safeText}${trailingWs}`
        : safeText;
      updated = updated.slice(0, el.openEnd) + replacement + updated.slice(el.closeStart);
    } else {
      // Mixed element: replace only the leading text node before the first child element
      const firstChild = elements[el.childIndices[0]];
      const prefixSlice = updated.slice(el.openEnd, firstChild.openStart);
      if (prefixSlice.trim().length > 0) {
        const leadingWs = prefixSlice.match(/^\s*/)?.[0] ?? '';
        const trailingWs = prefixSlice.match(/\s*$/)?.[0] ?? ' ';
        updated =
          updated.slice(0, el.openEnd) +
          `${leadingWs}${patch.textContent}${trailingWs}` +
          updated.slice(firstChild.openStart);
      }
    }
  }

  // Re-read opening tag slice after any text edit
  let openTag = updated.slice(el.openStart, el.openEnd);

  // 2. Update string attributes (className / class, href, src)
  const attrUpdates: Array<[string, string | undefined]> = [
    [isHtml ? 'class' : 'className', patch.className],
    ['href', patch.href],
    ['src', patch.src],
  ];

  for (const [attrName, val] of attrUpdates) {
    if (val === undefined) continue;
    const found = findAttributeRange(openTag, attrName, isHtml);
    const escaped = val.replace(/"/g, '&quot;');
    if (found) {
      openTag =
        openTag.slice(0, found.valueStart) +
        `"${escaped}"` +
        openTag.slice(found.valueEnd);
    } else {
      const insertAt = openTag.endsWith('/>') ? openTag.length - 2 : openTag.length - 1;
      const spacer = /\s/.test(openTag[insertAt - 1]) ? '' : ' ';
      openTag =
        openTag.slice(0, insertAt) +
        `${spacer}${attrName}="${escaped}"` +
        openTag.slice(insertAt);
    }
  }

  // 3. Update styles (`style={{ ... }}` or `style="..."`)
  if (patch.styles && Object.keys(patch.styles).length > 0) {
    const foundStyle = findAttributeRange(openTag, 'style', isHtml);
    if (isHtml) {
      const current = foundStyle
        ? parseHtmlStyleAttr(openTag.slice(foundStyle.valueStart, foundStyle.valueEnd))
        : {};
      for (const [k, v] of Object.entries(patch.styles)) {
        const camel = kebabToCamel(k);
        if (v === null || v === '') delete current[camel];
        else current[camel] = v;
      }
      const nextAttr = formatHtmlStyleAttr(current);
      if (foundStyle) {
        if (nextAttr) {
          openTag = openTag.slice(0, foundStyle.start) + nextAttr + openTag.slice(foundStyle.end);
        } else {
          openTag =
            openTag.slice(0, foundStyle.start).replace(/\s+$/, '') +
            openTag.slice(foundStyle.end);
        }
      } else if (nextAttr) {
        const insertAt = openTag.endsWith('/>') ? openTag.length - 2 : openTag.length - 1;
        const spacer = /\s/.test(openTag[insertAt - 1]) ? '' : ' ';
        openTag = openTag.slice(0, insertAt) + spacer + nextAttr + openTag.slice(insertAt);
      }
    } else {
      const parsed = foundStyle
        ? parseJsxStyleObject(openTag.slice(foundStyle.valueStart, foundStyle.valueEnd))
        : { entries: {} };
      for (const [k, v] of Object.entries(patch.styles)) {
        const camel = kebabToCamel(k);
        if (v === null || v === '') delete parsed.entries[camel];
        else parsed.entries[camel] = v;
      }
      const nextAttr = formatJsxStyleAttr(parsed.entries, parsed.spreadPrefix);
      if (foundStyle) {
        if (nextAttr) {
          openTag = openTag.slice(0, foundStyle.start) + nextAttr + openTag.slice(foundStyle.end);
        } else {
          openTag =
            openTag.slice(0, foundStyle.start).replace(/\s+$/, '') +
            openTag.slice(foundStyle.end);
        }
      } else if (nextAttr) {
        const insertAt = openTag.endsWith('/>') ? openTag.length - 2 : openTag.length - 1;
        const spacer = /\s/.test(openTag[insertAt - 1]) ? '' : ' ';
        openTag = openTag.slice(0, insertAt) + spacer + nextAttr + openTag.slice(insertAt);
      }
    }
  }

  return updated.slice(0, el.openStart) + openTag + updated.slice(el.openEnd);
}

export function moveElementSiblingInSource(
  code: string,
  elementIndex: number,
  targetSiblingIndex: number,
  isHtml: boolean
): string {
  const elements = scanElements(code, isHtml);
  const el = elements[elementIndex];
  if (!el || el.parentIndex < 0) return code;

  const parent = elements[el.parentIndex];
  const siblingIds = parent.childIndices;
  const fromPos = siblingIds.indexOf(elementIndex);
  if (fromPos === -1 || targetSiblingIndex < 0 || targetSiblingIndex >= siblingIds.length || fromPos === targetSiblingIndex) {
    return code;
  }

  const siblingNodes = siblingIds.map((id) => elements[id]);
  // Verify non-overlapping sequential slices
  for (let i = 0; i < siblingNodes.length; i++) {
    if (siblingNodes[i].closeEnd <= siblingNodes[i].openStart) return code;
    if (i > 0 && siblingNodes[i].openStart < siblingNodes[i - 1].closeEnd) return code;
  }

  const slices = siblingNodes.map((n) => code.slice(n.openStart, n.closeEnd));
  const separators: string[] = [];
  const prefix = code.slice(parent.openEnd, siblingNodes[0].openStart);
  for (let i = 0; i < siblingNodes.length - 1; i++) {
    separators.push(code.slice(siblingNodes[i].closeEnd, siblingNodes[i + 1].openStart));
  }
  const suffix = code.slice(siblingNodes[siblingNodes.length - 1].closeEnd, parent.closeStart);

  const reordered = [...slices];
  const [moved] = reordered.splice(fromPos, 1);
  reordered.splice(targetSiblingIndex, 0, moved);

  let inner = prefix;
  for (let i = 0; i < reordered.length; i++) {
    inner += reordered[i];
    if (i < separators.length) inner += separators[i];
  }
  inner += suffix;

  return code.slice(0, parent.openEnd) + inner + code.slice(parent.closeStart);
}

export function deleteElementInSource(
  code: string,
  elementIndex: number,
  isHtml: boolean
): string {
  const elements = scanElements(code, isHtml);
  const el = elements[elementIndex];
  if (!el || el.parentIndex < 0) return code;
  return code.slice(0, el.openStart) + code.slice(el.closeEnd);
}

export function duplicateElementInSource(
  code: string,
  elementIndex: number,
  isHtml: boolean
): string {
  const elements = scanElements(code, isHtml);
  const el = elements[elementIndex];
  if (!el || el.parentIndex < 0) return code;
  const block = code.slice(el.openStart, el.closeEnd);
  return code.slice(0, el.closeEnd) + '\n' + block + code.slice(el.closeEnd);
}

export interface ElementSourceMeta {
  index: number;
  tagName: string;
  className: string;
  isDynamicClassName: boolean;
  inlineStyles: Record<string, string>;
  parentIndex: number;
  childIndices: number[];
}

export function readElementMeta(
  code: string,
  elementIndex: number,
  isHtml: boolean
): ElementSourceMeta | null {
  const elements = scanElements(code, isHtml);
  const el = elements[elementIndex];
  if (!el) return null;

  const openTag = code.slice(el.openStart, el.openEnd);
  const classAttrName = isHtml ? 'class' : 'className';
  const foundClass = findAttributeRange(openTag, classAttrName, isHtml);
  let className = '';
  let isDynamicClassName = false;
  if (foundClass) {
    if (foundClass.kind === 'expr') {
      isDynamicClassName = true;
    } else {
      const raw = openTag.slice(foundClass.valueStart, foundClass.valueEnd);
      className = raw.replace(/^['"]|['"]$/g, '');
    }
  }

  const foundStyle = findAttributeRange(openTag, 'style', isHtml);
  let inlineStyles: Record<string, string> = {};
  if (foundStyle) {
    const rawStyle = openTag.slice(foundStyle.valueStart, foundStyle.valueEnd);
    inlineStyles = isHtml
      ? parseHtmlStyleAttr(rawStyle)
      : parseJsxStyleObject(rawStyle).entries;
  }

  return {
    index: el.index,
    tagName: el.tagName,
    className,
    isDynamicClassName,
    inlineStyles,
    parentIndex: el.parentIndex,
    childIndices: el.childIndices,
  };
}

export function applyBatchElementPatches(
  code: string,
  isHtml: boolean,
  updates: Array<{ elementIndex: number; patch: ElementSourcePatch }>
): string {
  if (updates.length === 0) return code;
  const elements = scanElements(code, isHtml);
  const valid = updates
    .filter((u) => elements[u.elementIndex])
    .map((u) => ({ ...u, openStart: elements[u.elementIndex].openStart }))
    .sort((a, b) => b.openStart - a.openStart);

  let next = code;
  for (const item of valid) {
    next = applyElementPatchToSource(next, item.elementIndex, isHtml, item.patch);
  }
  return next;
}

export type WrapContainerLayout = 'row' | 'col' | 'grid-2' | 'grid-3';

export function wrapElementsInContainer(
  code: string,
  isHtml: boolean,
  elementIndices: number[],
  layout: WrapContainerLayout
): string {
  const uniqueIndices = Array.from(new Set(elementIndices));
  if (uniqueIndices.length === 0) return code;
  const elements = scanElements(code, isHtml);
  const targets = uniqueIndices
    .map((idx) => elements[idx])
    .filter((el): el is ParsedElement => Boolean(el && el.parentIndex >= 0))
    .sort((a, b) => a.openStart - b.openStart);

  if (targets.length === 0) return code;
  const parentIdx = targets[0].parentIndex;
  if (!targets.every((t) => t.parentIndex === parentIdx)) {
    return code;
  }

  const jsxStyleByLayout: Record<WrapContainerLayout, string> = {
    row: "style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}",
    col: "style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}",
    'grid-2': "style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}",
    'grid-3': "style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}",
  };
  const htmlStyleByLayout: Record<WrapContainerLayout, string> = {
    row: 'style="display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 16px;"',
    col: 'style="display: flex; flex-direction: column; gap: 16px;"',
    'grid-2': 'style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;"',
    'grid-3': 'style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;"',
  };

  const parent = elements[parentIdx];
  const siblingPositions = targets.map((t) => parent.childIndices.indexOf(t.index));
  const isContiguous =
    siblingPositions.every((pos) => pos >= 0) &&
    siblingPositions.every((pos, i) => i === 0 || pos === siblingPositions[i - 1] + 1);

  const openTag = `<div ${isHtml ? htmlStyleByLayout[layout] : jsxStyleByLayout[layout]}>`;

  if (isContiguous) {
    const first = targets[0];
    const last = targets[targets.length - 1];
    const inner = code.slice(first.openStart, last.closeEnd);
    return (
      code.slice(0, first.openStart) +
      `${openTag}\n${inner}\n</div>` +
      code.slice(last.closeEnd)
    );
  }

  const slices = targets.map((t) => code.slice(t.openStart, t.closeEnd));
  let updated = code;
  for (let i = targets.length - 1; i >= 1; i--) {
    updated = updated.slice(0, targets[i].openStart) + updated.slice(targets[i].closeEnd);
  }
  const first = targets[0];
  return (
    updated.slice(0, first.openStart) +
    `${openTag}\n${slices.join('\n')}\n</div>` +
    updated.slice(first.closeEnd)
  );
}


