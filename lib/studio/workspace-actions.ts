import { ElementSourcePatch, StudioElementSnapshot } from './types';

export interface CopiedStyleClipboard {
  sourceTagName: string;
  sourceStudioId: string;
  className: string;
  inlineStyles: Record<string, string>;
  copiedAt: number;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

const SKIPPED_COPY_STYLE_KEYS = new Set([
  'transform',
  'translate',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'zIndex',
  'z-index',
]);

/**
 * Extracts a reusable style payload from a selected element snapshot.
 * Excludes positional offsets (translate/transform/inset) so pasting styles onto
 * another element copies visual styling without teleporting it out of place.
 */
export function buildCopiedStylePayload(
  snapshot: Pick<StudioElementSnapshot, 'tagName' | 'studioId' | 'className' | 'inlineStyles'>,
  now: number = Date.now()
): CopiedStyleClipboard {
  const cleanInline: Record<string, string> = {};
  for (const [key, value] of Object.entries(snapshot.inlineStyles || {})) {
    if (!key || SKIPPED_COPY_STYLE_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.trim() !== '') {
      cleanInline[key] = value.trim();
    }
  }

  return {
    sourceTagName: snapshot.tagName,
    sourceStudioId: snapshot.studioId,
    className: (snapshot.className || '').trim(),
    inlineStyles: cleanInline,
    copiedAt: now,
  };
}

/**
 * Builds an ElementSourcePatch that applies a copied style clipboard onto a target element.
 * Removes stale inline style keys on the target (except positional offsets) when replacing styles.
 */
export function buildPasteStylePatch(
  clipboard: CopiedStyleClipboard,
  targetInlineStyles: Record<string, string> = {}
): ElementSourcePatch {
  const mergedStyles: Record<string, string | null> = {};

  for (const existingKey of Object.keys(targetInlineStyles)) {
    if (SKIPPED_COPY_STYLE_KEYS.has(existingKey)) continue;
    if (!(existingKey in clipboard.inlineStyles)) {
      mergedStyles[existingKey] = null;
    }
  }

  for (const [key, val] of Object.entries(clipboard.inlineStyles)) {
    mergedStyles[key] = val;
  }

  const patch: ElementSourcePatch = {};
  if (clipboard.className) {
    patch.className = clipboard.className;
  }
  if (Object.keys(mergedStyles).length > 0) {
    patch.styles = mergedStyles;
  }
  return patch;
}

/**
 * Clamps a floating desktop context menu so it never overflows outside the viewport.
 */
export function clampContextMenuPosition(params: {
  x: number;
  y: number;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}): ContextMenuPosition {
  const { x, y, menuWidth, menuHeight, viewportWidth, viewportHeight, margin = 12 } = params;
  const maxX = Math.max(margin, viewportWidth - menuWidth - margin);
  const maxY = Math.max(margin, viewportHeight - menuHeight - margin);
  return {
    x: Math.round(Math.min(Math.max(margin, x), maxX)),
    y: Math.round(Math.min(Math.max(margin, y), maxY)),
  };
}

/**
 * Suggests a clean PascalCase component name from an element's tag name and text preview.
 */
export function suggestExtractedComponentName(
  tagName: string,
  textPreview?: string
): string {
  const words = (textPreview || '')
    .replace(/[^a-zA-Z0-9\s]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length > 0) {
    const pascal = words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
    if (/^[A-Z][A-Za-z0-9]{2,}$/.test(pascal)) {
      return `${pascal}Block`;
    }
  }

  const cleanTag = (tagName || 'Section').replace(/[^a-zA-Z0-9]/g, '');
  const capitalized =
    cleanTag.length > 0
      ? cleanTag.charAt(0).toUpperCase() + cleanTag.slice(1).toLowerCase()
      : 'Custom';
  return `${capitalized}Component`;
}
