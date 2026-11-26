import {
  ParsedElement,
  applyElementPatchToSource,
  deleteElementInSource,
  duplicateElementInSource,
  moveElementSiblingInSource,
  scanElements,
} from './source-editor';

export type RepeaterSlotRole = 'heading' | 'body' | 'cta' | 'badge';

export interface RepeaterItemSlot {
  elementIndex: number;
  tagName: string;
  role: RepeaterSlotRole;
  text: string;
}

export interface RepeaterItem {
  elementIndex: number;
  tagName: string;
  title: string;
  subtitle: string;
  slots: RepeaterItemSlot[];
}

export interface RepeaterGroup {
  containerElementIndex: number;
  containerTagName: string;
  containerLabel: string;
  filePath: string;
  items: RepeaterItem[];
}

const CARD_ITEM_TAGS = new Set(['div', 'article', 'li', 'section', 'a']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const CTA_TAGS = new Set(['button', 'a']);
const TEXT_LEAF_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'button',
  'a',
  'li',
  'strong',
  'label',
  'div',
]);

function isHtmlPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.html') || filePath.toLowerCase().endsWith('.htm');
}

function extractDirectText(code: string, el: ParsedElement): string {
  if (el.selfClosing || el.closeStart <= el.openEnd) return '';
  if (el.childIndices.length > 0) return '';
  const inner = code.slice(el.openEnd, el.closeStart).trim();
  if (!inner) return '';
  // Skip pure JSX expression blocks like {item.title}
  if (inner.startsWith('{') && inner.endsWith('}')) return '';
  return inner.replace(/\s+/g, ' ').trim();
}

function collectEditableSlots(
  code: string,
  elements: ParsedElement[],
  rootIndex: number
): RepeaterItemSlot[] {
  const slots: RepeaterItemSlot[] = [];
  const queue: number[] = [rootIndex];

  while (queue.length > 0 && slots.length < 6) {
    const idx = queue.shift()!;
    const node = elements[idx];
    if (!node) continue;

    if (TEXT_LEAF_TAGS.has(node.tagName.toLowerCase()) && node.childIndices.length === 0) {
      const text = extractDirectText(code, node);
      if (text.length > 0) {
        const lower = node.tagName.toLowerCase();
        const role: RepeaterSlotRole = HEADING_TAGS.has(lower)
          ? 'heading'
          : CTA_TAGS.has(lower)
          ? 'cta'
          : lower === 'span' && text.length <= 28
          ? 'badge'
          : 'body';
        slots.push({
          elementIndex: node.index,
          tagName: node.tagName,
          role,
          text,
        });
      }
    }

    for (const childIdx of node.childIndices) {
      queue.push(childIdx);
    }
  }

  return slots;
}

export function detectRepeaterGroups(code: string, filePath: string): RepeaterGroup[] {
  const elements = scanElements(code, isHtmlPath(filePath));
  if (elements.length === 0) return [];

  const scoredGroups: Array<{ group: RepeaterGroup; score: number }> = [];

  for (const parent of elements) {
    if (parent.childIndices.length < 2) continue;
    const directChildren = parent.childIndices
      .map((i) => elements[i])
      .filter((el): el is ParsedElement => Boolean(el));

    // Count dominant repeating card/item tag among direct children
    const tagCounts = new Map<string, ParsedElement[]>();
    for (const child of directChildren) {
      const lower = child.tagName.toLowerCase();
      if (!CARD_ITEM_TAGS.has(lower)) continue;
      const list = tagCounts.get(lower) || [];
      list.push(child);
      tagCounts.set(lower, list);
    }

    let bestGroup: ParsedElement[] | null = null;
    for (const [, list] of tagCounts.entries()) {
      if (list.length >= 2 && (!bestGroup || list.length > bestGroup.length)) {
        bestGroup = list;
      }
    }

    if (!bestGroup || bestGroup.length < 2) continue;

    // Require at least 2 items to contain meaningful editable text slots (e.g. cards, pricing tiers, list items)
    const items: RepeaterItem[] = bestGroup.map((child, idx) => {
      const slots = collectEditableSlots(code, elements, child.index);
      const headingSlot = slots.find((s) => s.role === 'heading') || slots[0];
      const bodySlot =
        slots.find((s) => s.role === 'body' && s !== headingSlot) || slots[1];
      return {
        elementIndex: child.index,
        tagName: child.tagName,
        title: headingSlot?.text || `Item ${idx + 1}`,
        subtitle: bodySlot?.text || '',
        slots,
      };
    });

    const itemsWithSlots = items.filter((item) => item.slots.length > 0);
    // Avoid catching page-level root wrappers (e.g. header/main/footer siblings) by requiring
    // repeating homogeneous children (>= 2 items with slots and all direct children are mostly same tag)
    if (itemsWithSlots.length < 2) continue;
    if (bestGroup.length < Math.ceil(directChildren.length * 0.6)) continue;
    // Skip top-level body/min-h-screen page shell where children are entire page sections
    const parentTag = parent.tagName.toLowerCase();
    if (parentTag === 'body' || parentTag === 'main') continue;

    const firstTag = bestGroup[0].tagName;
    const openMarkup = code.slice(parent.openStart, parent.openEnd);
    const isGridLike = /\b(grid|flex)\b/i.test(openMarkup);
    const kindWord =
      firstTag === 'li'
        ? 'List Items'
        : firstTag === 'a'
        ? 'Link Items'
        : isGridLike
        ? 'Cards'
        : 'Items';

    const avgSlots =
      items.reduce((sum, item) => sum + item.slots.length, 0) / Math.max(1, items.length);
    const score =
      (isGridLike ? 35 : 0) +
      (parentTag === 'section' ? -15 : 15) +
      (bestGroup.length === directChildren.length ? 15 : 0) +
      (items.length >= 3 ? 10 : 0) +
      (avgSlots >= 2 ? 12 : 0) +
      Math.min(items.length, 6);

    scoredGroups.push({
      score,
      group: {
        containerElementIndex: parent.index,
        containerTagName: parent.tagName,
        containerLabel: `<${parent.tagName}> ${items.length} ${kindWord}`,
        filePath,
        items,
      },
    });
  }

  return scoredGroups
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.group);
}

export function findRepeaterForElement(
  code: string,
  filePath: string,
  elementIndex: number
): RepeaterGroup | null {
  const groups = detectRepeaterGroups(code, filePath);
  if (groups.length === 0) return null;

  // 1. Exact container match
  const exactContainer = groups.find((g) => g.containerElementIndex === elementIndex);
  if (exactContainer) return exactContainer;

  // 2. Walk up ancestors from elementIndex to find nearest enclosing repeater group
  const elements = scanElements(code, isHtmlPath(filePath));
  let cursor = elementIndex;
  const visited = new Set<number>();
  while (cursor >= 0 && cursor < elements.length && !visited.has(cursor)) {
    visited.add(cursor);
    const match = groups.find(
      (g) =>
        g.containerElementIndex === cursor ||
        g.items.some((item) => item.elementIndex === cursor)
    );
    if (match) return match;
    cursor = elements[cursor].parentIndex;
  }

  return null;
}

export function addRepeaterItemFromLast(
  code: string,
  filePath: string,
  group: RepeaterGroup
): string {
  const lastItem = group.items[group.items.length - 1];
  if (!lastItem) return code;
  return duplicateElementInSource(code, lastItem.elementIndex, isHtmlPath(filePath));
}

export function duplicateRepeaterItem(
  code: string,
  filePath: string,
  itemElementIndex: number
): string {
  return duplicateElementInSource(code, itemElementIndex, isHtmlPath(filePath));
}

export function removeRepeaterItem(
  code: string,
  filePath: string,
  itemElementIndex: number
): string {
  return deleteElementInSource(code, itemElementIndex, isHtmlPath(filePath));
}

export function moveRepeaterItem(
  code: string,
  filePath: string,
  itemElementIndex: number,
  targetSiblingIndex: number
): string {
  return moveElementSiblingInSource(
    code,
    itemElementIndex,
    targetSiblingIndex,
    isHtmlPath(filePath)
  );
}

export function updateRepeaterSlotText(
  code: string,
  filePath: string,
  slotElementIndex: number,
  nextText: string
): string {
  return applyElementPatchToSource(code, slotElementIndex, isHtmlPath(filePath), {
    textContent: nextText,
  });
}
