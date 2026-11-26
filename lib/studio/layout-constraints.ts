import { ElementRect } from './types';

export type PositionMode = 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
export type HorizontalConstraint = 'left' | 'right' | 'left-right' | 'center' | 'scale';
export type VerticalConstraint = 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';
export type SizeConstraintMode = 'fixed' | 'fill' | 'hug';

export interface ConstraintDetection {
  horizontal: HorizontalConstraint;
  vertical: VerticalConstraint;
}

export function detectConstraintState(
  inlineStyles: Record<string, string>,
  computedStyles: Record<string, string>
): ConstraintDetection {
  const left = inlineStyles.left || '';
  const right = inlineStyles.right || '';
  const top = inlineStyles.top || '';
  const bottom = inlineStyles.bottom || '';
  const width = inlineStyles.width || computedStyles.width || '';
  const height = inlineStyles.height || computedStyles.height || '';
  const transform = inlineStyles.transform || computedStyles.transform || '';

  let horizontal: HorizontalConstraint = 'left';
  if (left && right && left !== 'auto' && right !== 'auto') {
    horizontal = 'left-right';
  } else if (left === '50%' && transform.includes('translateX(-50%)')) {
    horizontal = 'center';
  } else if (width.endsWith('%')) {
    horizontal = 'scale';
  } else if (right && right !== 'auto' && (!left || left === 'auto')) {
    horizontal = 'right';
  }

  let vertical: VerticalConstraint = 'top';
  if (top && bottom && top !== 'auto' && bottom !== 'auto') {
    vertical = 'top-bottom';
  } else if (top === '50%' && transform.includes('translateY(-50%)')) {
    vertical = 'center';
  } else if (height.endsWith('%')) {
    vertical = 'scale';
  } else if (bottom && bottom !== 'auto' && (!top || top === 'auto')) {
    vertical = 'bottom';
  }

  return { horizontal, vertical };
}

export function applyHorizontalConstraintPatch(
  constraint: HorizontalConstraint,
  elementRect: ElementRect,
  parentRect: ElementRect | null,
  currentPosition: string
): Record<string, string | null> {
  const p = parentRect || { x: 0, y: 0, width: Math.max(elementRect.width, 320), height: Math.max(elementRect.height, 240) };
  const relLeft = Math.round(elementRect.x - p.x);
  const relRight = Math.round(p.x + p.width - (elementRect.x + elementRect.width));
  const ensurePos = currentPosition === 'static' ? 'relative' : null;

  const patch: Record<string, string | null> = {};
  if (ensurePos && constraint !== 'scale') {
    patch.position = ensurePos;
  }

  if (constraint === 'left') {
    patch.left = `${relLeft}px`;
    patch.right = null;
    patch.transform = null;
  } else if (constraint === 'right') {
    patch.right = `${relRight}px`;
    patch.left = null;
    patch.transform = null;
  } else if (constraint === 'left-right') {
    patch.position = currentPosition === 'static' ? 'absolute' : currentPosition;
    patch.left = `${Math.max(0, relLeft)}px`;
    patch.right = `${Math.max(0, relRight)}px`;
    patch.width = 'auto';
    patch.transform = null;
  } else if (constraint === 'center') {
    patch.position = currentPosition === 'static' ? 'relative' : currentPosition;
    patch.left = '50%';
    patch.right = null;
    patch.transform = 'translateX(-50%)';
  } else if (constraint === 'scale') {
    const pct = p.width > 0 ? Math.min(100, Math.max(5, Math.round((elementRect.width / p.width) * 100))) : 100;
    patch.left = null;
    patch.right = null;
    patch.width = `${pct}%`;
  }

  return patch;
}

export function applyVerticalConstraintPatch(
  constraint: VerticalConstraint,
  elementRect: ElementRect,
  parentRect: ElementRect | null,
  currentPosition: string
): Record<string, string | null> {
  const p = parentRect || { x: 0, y: 0, width: Math.max(elementRect.width, 320), height: Math.max(elementRect.height, 240) };
  const relTop = Math.round(elementRect.y - p.y);
  const relBottom = Math.round(p.y + p.height - (elementRect.y + elementRect.height));
  const ensurePos = currentPosition === 'static' ? 'relative' : null;

  const patch: Record<string, string | null> = {};
  if (ensurePos && constraint !== 'scale') {
    patch.position = ensurePos;
  }

  if (constraint === 'top') {
    patch.top = `${relTop}px`;
    patch.bottom = null;
  } else if (constraint === 'bottom') {
    patch.bottom = `${relBottom}px`;
    patch.top = null;
  } else if (constraint === 'top-bottom') {
    patch.position = currentPosition === 'static' ? 'absolute' : currentPosition;
    patch.top = `${Math.max(0, relTop)}px`;
    patch.bottom = `${Math.max(0, relBottom)}px`;
    patch.height = 'auto';
  } else if (constraint === 'center') {
    patch.position = currentPosition === 'static' ? 'relative' : currentPosition;
    patch.top = '50%';
    patch.bottom = null;
    patch.transform = 'translateY(-50%)';
  } else if (constraint === 'scale') {
    const pct = p.height > 0 ? Math.min(100, Math.max(5, Math.round((elementRect.height / p.height) * 100))) : 100;
    patch.top = null;
    patch.bottom = null;
    patch.height = `${pct}%`;
  }

  return patch;
}

export function applySizeConstraintMode(
  axis: 'width' | 'height',
  mode: SizeConstraintMode,
  fallbackPx: number
): Record<string, string | null> {
  if (mode === 'fill') {
    return { [axis]: '100%' };
  }
  if (mode === 'hug') {
    return { [axis]: 'auto' };
  }
  return { [axis]: `${Math.max(20, Math.round(fallbackPx))}px` };
}

export function parseGridColumnCount(gridTemplateColumns?: string): number {
  if (!gridTemplateColumns || gridTemplateColumns === 'none') return 1;
  const repeatMatch = gridTemplateColumns.match(/repeat\(\s*(\d+)/i);
  if (repeatMatch) return Math.min(12, Math.max(1, Number(repeatMatch[1])));
  const tracks = gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
  return Math.min(12, Math.max(1, tracks.length));
}

export interface ResizeContainmentInput {
  width?: string;
  height?: string;
  inlineStyles?: Record<string, string>;
  computedStyles?: Record<string, string>;
  currentRect?: { width: number; height: number } | null;
}

function parsePxValue(val?: string): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!/^-?\d+(?:\.\d+)?px$/i.test(trimmed)) return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Produces CSS style patches for resized boxes so inner text, flex items, and
 * child blocks wrap or clip cleanly inside the resized bounds instead of leaking.
 */
export function buildResizeContainmentStyles({
  width,
  height,
  inlineStyles = {},
  computedStyles = {},
  currentRect = null,
}: ResizeContainmentInput): Record<string, string> {
  const styles: Record<string, string> = {};
  const hasWidth = Boolean(width && width !== 'auto');
  const hasHeight = Boolean(height && height !== 'auto');

  if (width) styles.width = width;
  if (height) styles.height = height;
  if (!hasWidth && !hasHeight) return styles;

  styles.boxSizing = 'border-box';
  styles.overflowWrap = 'anywhere';

  const currentOverflow = (inlineStyles.overflow || computedStyles.overflow || 'visible').trim().toLowerCase();
  if (!currentOverflow || currentOverflow === 'visible') {
    styles.overflow = 'hidden';
  }

  const currentDisplay = (inlineStyles.display || computedStyles.display || '').trim().toLowerCase();
  if (currentDisplay === 'inline') {
    styles.display = 'inline-block';
  }

  if (hasWidth) {
    styles.minWidth = '0px';

    const targetWidthPx = parsePxValue(width);
    const computedMaxW = parsePxValue(computedStyles.maxWidth);
    if (targetWidthPx !== null && computedMaxW !== null && targetWidthPx > computedMaxW) {
      styles.maxWidth = 'none';
    }

    const isFlex = currentDisplay === 'flex' || currentDisplay === 'inline-flex';
    const flexDir = (inlineStyles['flex-direction'] || inlineStyles.flexDirection || computedStyles.flexDirection || 'row')
      .trim()
      .toLowerCase();
    const flexWrap = (inlineStyles['flex-wrap'] || inlineStyles.flexWrap || computedStyles.flexWrap || 'nowrap')
      .trim()
      .toLowerCase();
    if (isFlex && flexDir.startsWith('row') && flexWrap === 'nowrap') {
      styles.flexWrap = 'wrap';
    }

    const whiteSpace = (inlineStyles['white-space'] || inlineStyles.whiteSpace || computedStyles.whiteSpace || 'normal')
      .trim()
      .toLowerCase();
    if (
      whiteSpace === 'nowrap' &&
      (targetWidthPx === null || !currentRect || targetWidthPx < currentRect.width)
    ) {
      styles.whiteSpace = 'normal';
    }
  }

  if (hasHeight) {
    styles.minHeight = '0px';

    const targetHeightPx = parsePxValue(height);
    const computedMaxH = parsePxValue(computedStyles.maxHeight);
    if (targetHeightPx !== null && computedMaxH !== null && targetHeightPx > computedMaxH) {
      styles.maxHeight = 'none';
    }
  }

  return styles;
}

/**
 * Parses visual X/Y translation offsets from both CSS `translate` (used by
 * Tailwind v4 `translate-x-[...]` / `translate-y-[...]`) and CSS `transform`
 * (`translate(...)` / `matrix(...)`).
 */
export function parseElementTranslateOffsets(
  inlineStyles: Record<string, string> = {},
  computedStyles: Record<string, string> = {}
): { x: number; y: number } {
  let x = 0;
  let y = 0;

  const translateCss = (inlineStyles.translate || computedStyles.translate || '').trim();
  if (translateCss && translateCss !== 'none') {
    const parts = translateCss.split(/\s+/);
    const px0 = parsePxValue(parts[0]);
    const px1 = parts[1] ? parsePxValue(parts[1]) : 0;
    if (px0 !== null) x += px0;
    if (px1 !== null) y += px1;
  }

  const transformCss = (inlineStyles.transform || computedStyles.transform || '').trim();
  if (transformCss && transformCss !== 'none') {
    const tMatch = transformCss.match(
      /translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/
    );
    if (tMatch) {
      x += parseFloat(tMatch[1]);
      y += parseFloat(tMatch[2]);
    } else {
      const mMatch = transformCss.match(/^matrix\(([^)]+)\)$/);
      if (mMatch) {
        const nums = mMatch[1].split(',').map((s) => parseFloat(s.trim()));
        if (nums.length === 6 && Number.isFinite(nums[4]) && Number.isFinite(nums[5])) {
          x += nums[4];
          y += nums[5];
        }
      } else {
        const tx = transformCss.match(/translateX\(\s*(-?\d+(?:\.\d+)?)px\s*\)/);
        const ty = transformCss.match(/translateY\(\s*(-?\d+(?:\.\d+)?)px\s*\)/);
        if (tx) x += parseFloat(tx[1]);
        if (ty) y += parseFloat(ty[1]);
      }
    }
  }

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Computes the exact post-splice sibling targetIndex and visual drop indicator
 * rectangle from pointer coordinates and sibling bounding rects.
 */
export function computeReorderDropTarget(params: {
  itemRects: ElementRect[];
  dragIndex: number;
  pointerX: number;
  pointerY: number;
  isHorizontal: boolean;
}): { targetIndex: number; indicatorRect: ElementRect | null } {
  const { itemRects, dragIndex, pointerX, pointerY, isHorizontal } = params;
  if (itemRects.length < 2 || dragIndex < 0 || dragIndex >= itemRects.length) {
    return { targetIndex: Math.max(0, dragIndex), indicatorRect: null };
  }

  let bestIdx = dragIndex;
  let bestDist = Infinity;
  let bestAfter = false;
  let indicatorRect: ElementRect | null = null;

  for (let i = 0; i < itemRects.length; i++) {
    const r = itemRects[i];
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const dist = Math.hypot(pointerX - cx, pointerY - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
      bestAfter = isHorizontal ? pointerX > cx : pointerY > cy;
      if (isHorizontal) {
        indicatorRect = {
          x: bestAfter ? r.x + r.width + 2 : r.x - 4,
          y: r.y,
          width: 3,
          height: r.height,
        };
      } else {
        indicatorRect = {
          x: r.x,
          y: bestAfter ? r.y + r.height + 2 : r.y - 4,
          width: r.width,
          height: 3,
        };
      }
    }
  }

  const slot = bestAfter ? bestIdx + 1 : bestIdx;
  const rawTarget = slot > dragIndex ? slot - 1 : slot;
  const targetIndex = Math.max(0, Math.min(itemRects.length - 1, rawTarget));
  return { targetIndex, indicatorRect };
}


