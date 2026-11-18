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
