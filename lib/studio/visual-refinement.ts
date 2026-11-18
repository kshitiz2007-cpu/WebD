import { ElementRect, ElementSourcePatch } from './types';

export interface RedlineSegment {
  id: string;
  orientation: 'horizontal' | 'vertical';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distance: number;
  label: string;
  kind: 'gap' | 'inset';
}

export interface BoxSpacingValues {
  padding: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };
}

export type MultiAlignAction =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'distribute-h'
  | 'distribute-v'
  | 'match-width'
  | 'match-height';

export interface MultiSelectAlignItem {
  studioId: string;
  filePath: string;
  elementIndex: number;
  rect: ElementRect;
  baseX: number;
  baseY: number;
}

export interface MultiAlignPatchResult {
  studioId: string;
  filePath: string;
  elementIndex: number;
  patch: ElementSourcePatch;
  previewStyles: Record<string, string>;
}

export interface ContrastReport {
  ratio: number;
  ratioLabel: string;
  grade: 'AAA' | 'AA' | 'AA Large' | 'Fail';
  passesAA: boolean;
  passesAAA: boolean;
  passesAALarge: boolean;
}

export const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const NUDGE_GRID_STEPS = [1, 4, 8, 10] as const;

export function clampZoomScale(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(2, Math.max(0.5, Math.round(zoom * 100) / 100));
}

export function stepZoomScale(current: number, direction: 'in' | 'out'): number {
  const cur = clampZoomScale(current);
  if (direction === 'in') {
    const next = ZOOM_PRESETS.find((z) => z > cur + 0.02);
    return next ?? 2;
  }
  const reversed = [...ZOOM_PRESETS].reverse();
  const prev = reversed.find((z) => z < cur - 0.02);
  return prev ?? 0.5;
}

function parsePx(raw: string | undefined): number {
  if (!raw) return 0;
  const m = raw.match(/-?\d+(?:\.\d+)?/);
  return m ? Math.max(0, Math.round(parseFloat(m[0]))) : 0;
}

export function parseBoxSpacingPx(computedStyles: Record<string, string>): BoxSpacingValues {
  return {
    padding: {
      top: parsePx(computedStyles.paddingTop),
      right: parsePx(computedStyles.paddingRight),
      bottom: parsePx(computedStyles.paddingBottom),
      left: parsePx(computedStyles.paddingLeft),
    },
    margin: {
      top: parsePx(computedStyles.marginTop),
      right: parsePx(computedStyles.marginRight),
      bottom: parsePx(computedStyles.marginBottom),
      left: parsePx(computedStyles.marginLeft),
    },
  };
}

function isRectContained(inner: ElementRect, outer: ElementRect): boolean {
  return (
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1
  );
}

/**
 * Computes Figma-style redline distance lines between the selected element and
 * another hovered element (sibling gap or parent/child inset distances).
 */
export function computeRedlineMeasurements(
  selectedRect: ElementRect,
  targetRect: ElementRect
): RedlineSegment[] {
  const segments: RedlineSegment[] = [];
  const sLeft = selectedRect.x;
  const sRight = selectedRect.x + selectedRect.width;
  const sTop = selectedRect.y;
  const sBottom = selectedRect.y + selectedRect.height;
  const sMidX = selectedRect.x + selectedRect.width / 2;
  const sMidY = selectedRect.y + selectedRect.height / 2;

  const tLeft = targetRect.x;
  const tRight = targetRect.x + targetRect.width;
  const tTop = targetRect.y;
  const tBottom = targetRect.y + targetRect.height;
  const tMidX = targetRect.x + targetRect.width / 2;
  const tMidY = targetRect.y + targetRect.height / 2;

  // Case 1: Selected is inside target (e.g., parent container) OR target is inside selected
  if (isRectContained(selectedRect, targetRect) || isRectContained(targetRect, selectedRect)) {
    const inner = isRectContained(selectedRect, targetRect) ? selectedRect : targetRect;
    const outer = isRectContained(selectedRect, targetRect) ? targetRect : selectedRect;
    const iLeft = inner.x;
    const iRight = inner.x + inner.width;
    const iTop = inner.y;
    const iBottom = inner.y + inner.height;
    const iMidX = inner.x + inner.width / 2;
    const iMidY = inner.y + inner.height / 2;

    const dLeft = Math.round(iLeft - outer.x);
    const dRight = Math.round(outer.x + outer.width - iRight);
    const dTop = Math.round(iTop - outer.y);
    const dBottom = Math.round(outer.y + outer.height - iBottom);

    if (dLeft >= 1) {
      segments.push({
        id: 'inset-left',
        orientation: 'horizontal',
        x1: outer.x,
        y1: iMidY,
        x2: iLeft,
        y2: iMidY,
        distance: dLeft,
        label: `${dLeft}px`,
        kind: 'inset',
      });
    }
    if (dRight >= 1) {
      segments.push({
        id: 'inset-right',
        orientation: 'horizontal',
        x1: iRight,
        y1: iMidY,
        x2: outer.x + outer.width,
        y2: iMidY,
        distance: dRight,
        label: `${dRight}px`,
        kind: 'inset',
      });
    }
    if (dTop >= 1) {
      segments.push({
        id: 'inset-top',
        orientation: 'vertical',
        x1: iMidX,
        y1: outer.y,
        x2: iMidX,
        y2: iTop,
        distance: dTop,
        label: `${dTop}px`,
        kind: 'inset',
      });
    }
    if (dBottom >= 1) {
      segments.push({
        id: 'inset-bottom',
        orientation: 'vertical',
        x1: iMidX,
        y1: iBottom,
        x2: iMidX,
        y2: outer.y + outer.height,
        distance: dBottom,
        label: `${dBottom}px`,
        kind: 'inset',
      });
    }
    return segments;
  }

  // Case 2: Disjoint or side-by-side elements — measure horizontal & vertical gaps
  if (sRight <= tLeft) {
    const dist = Math.round(tLeft - sRight);
    if (dist >= 1) {
      const overlapY =
        Math.min(sBottom, tBottom) > Math.max(sTop, tTop)
          ? (Math.max(sTop, tTop) + Math.min(sBottom, tBottom)) / 2
          : sMidY;
      segments.push({
        id: 'gap-right',
        orientation: 'horizontal',
        x1: sRight,
        y1: overlapY,
        x2: tLeft,
        y2: overlapY,
        distance: dist,
        label: `${dist}px`,
        kind: 'gap',
      });
    }
  } else if (tRight <= sLeft) {
    const dist = Math.round(sLeft - tRight);
    if (dist >= 1) {
      const overlapY =
        Math.min(sBottom, tBottom) > Math.max(sTop, tTop)
          ? (Math.max(sTop, tTop) + Math.min(sBottom, tBottom)) / 2
          : sMidY;
      segments.push({
        id: 'gap-left',
        orientation: 'horizontal',
        x1: tRight,
        y1: overlapY,
        x2: sLeft,
        y2: overlapY,
        distance: dist,
        label: `${dist}px`,
        kind: 'gap',
      });
    }
  } else {
    // Horizontal edge-to-edge offset when columns partially overlap
    const leftDiff = Math.round(Math.abs(sLeft - tLeft));
    if (leftDiff >= 1) {
      const yAnchor = Math.min(sTop, tTop) + 8;
      segments.push({
        id: 'align-left-diff',
        orientation: 'horizontal',
        x1: Math.min(sLeft, tLeft),
        y1: yAnchor,
        x2: Math.max(sLeft, tLeft),
        y2: yAnchor,
        distance: leftDiff,
        label: `${leftDiff}px`,
        kind: 'gap',
      });
    }
  }

  if (sBottom <= tTop) {
    const dist = Math.round(tTop - sBottom);
    if (dist >= 1) {
      const overlapX =
        Math.min(sRight, tRight) > Math.max(sLeft, tLeft)
          ? (Math.max(sLeft, tLeft) + Math.min(sRight, tRight)) / 2
          : (sMidX + tMidX) / 2;
      segments.push({
        id: 'gap-bottom',
        orientation: 'vertical',
        x1: overlapX,
        y1: sBottom,
        x2: overlapX,
        y2: tTop,
        distance: dist,
        label: `${dist}px`,
        kind: 'gap',
      });
    }
  } else if (tBottom <= sTop) {
    const dist = Math.round(sTop - tBottom);
    if (dist >= 1) {
      const overlapX =
        Math.min(sRight, tRight) > Math.max(sLeft, tLeft)
          ? (Math.max(sLeft, tLeft) + Math.min(sRight, tRight)) / 2
          : (sMidX + tMidX) / 2;
      segments.push({
        id: 'gap-top',
        orientation: 'vertical',
        x1: overlapX,
        y1: tBottom,
        x2: overlapX,
        y2: sTop,
        distance: dist,
        label: `${dist}px`,
        kind: 'gap',
      });
    }
  }

  return segments;
}

export function computeNudgeOffsets(opts: {
  baseX: number;
  baseY: number;
  key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
  step: number;
}): { nextX: number; nextY: number; dx: number; dy: number } {
  const step = Math.max(1, Math.round(opts.step));
  let dx = 0;
  let dy = 0;
  if (opts.key === 'ArrowLeft') dx = -step;
  else if (opts.key === 'ArrowRight') dx = step;
  else if (opts.key === 'ArrowUp') dy = -step;
  else if (opts.key === 'ArrowDown') dy = step;

  return {
    nextX: Math.round(opts.baseX + dx),
    nextY: Math.round(opts.baseY + dy),
    dx,
    dy,
  };
}

export function computeMultiAlignPatches(
  items: MultiSelectAlignItem[],
  action: MultiAlignAction
): MultiAlignPatchResult[] {
  if (items.length < 2) return [];

  const minX = Math.min(...items.map((it) => it.rect.x));
  const maxX = Math.max(...items.map((it) => it.rect.x + it.rect.width));
  const minY = Math.min(...items.map((it) => it.rect.y));
  const maxY = Math.max(...items.map((it) => it.rect.y + it.rect.height));
  const groupCenterX = (minX + maxX) / 2;
  const groupCenterY = (minY + maxY) / 2;

  if (action === 'match-width') {
    const targetWidth = Math.round(items[0].rect.width);
    return items.map((it) => ({
      studioId: it.studioId,
      filePath: it.filePath,
      elementIndex: it.elementIndex,
      patch: { styles: { width: `${targetWidth}px` } },
      previewStyles: { width: `${targetWidth}px` },
    }));
  }

  if (action === 'match-height') {
    const targetHeight = Math.round(items[0].rect.height);
    return items.map((it) => ({
      studioId: it.studioId,
      filePath: it.filePath,
      elementIndex: it.elementIndex,
      patch: { styles: { height: `${targetHeight}px` } },
      previewStyles: { height: `${targetHeight}px` },
    }));
  }

  if (action === 'distribute-h') {
    if (items.length < 3) return [];
    const sorted = [...items].sort((a, b) => a.rect.x - b.rect.x);
    const totalWidths = sorted.reduce((acc, it) => acc + it.rect.width, 0);
    const span = sorted[sorted.length - 1].rect.x + sorted[sorted.length - 1].rect.width - sorted[0].rect.x;
    const gap = (span - totalWidths) / (sorted.length - 1);
    let cursorX = sorted[0].rect.x;
    return sorted.map((it) => {
      const deltaX = Math.round(cursorX - it.rect.x);
      cursorX += it.rect.width + gap;
      const nextX = Math.round(it.baseX + deltaX);
      const nextY = Math.round(it.baseY);
      return {
        studioId: it.studioId,
        filePath: it.filePath,
        elementIndex: it.elementIndex,
        patch: { styles: { transform: `translate(${nextX}px, ${nextY}px)` } },
        previewStyles: { translate: `${nextX}px ${nextY}px`, transform: 'none' },
      };
    });
  }

  if (action === 'distribute-v') {
    if (items.length < 3) return [];
    const sorted = [...items].sort((a, b) => a.rect.y - b.rect.y);
    const totalHeights = sorted.reduce((acc, it) => acc + it.rect.height, 0);
    const span = sorted[sorted.length - 1].rect.y + sorted[sorted.length - 1].rect.height - sorted[0].rect.y;
    const gap = (span - totalHeights) / (sorted.length - 1);
    let cursorY = sorted[0].rect.y;
    return sorted.map((it) => {
      const deltaY = Math.round(cursorY - it.rect.y);
      cursorY += it.rect.height + gap;
      const nextX = Math.round(it.baseX);
      const nextY = Math.round(it.baseY + deltaY);
      return {
        studioId: it.studioId,
        filePath: it.filePath,
        elementIndex: it.elementIndex,
        patch: { styles: { transform: `translate(${nextX}px, ${nextY}px)` } },
        previewStyles: { translate: `${nextX}px ${nextY}px`, transform: 'none' },
      };
    });
  }

  return items.map((it) => {
    let deltaX = 0;
    let deltaY = 0;
    if (action === 'left') deltaX = Math.round(minX - it.rect.x);
    else if (action === 'center') deltaX = Math.round(groupCenterX - (it.rect.x + it.rect.width / 2));
    else if (action === 'right') deltaX = Math.round(maxX - (it.rect.x + it.rect.width));
    else if (action === 'top') deltaY = Math.round(minY - it.rect.y);
    else if (action === 'middle') deltaY = Math.round(groupCenterY - (it.rect.y + it.rect.height / 2));
    else if (action === 'bottom') deltaY = Math.round(maxY - (it.rect.y + it.rect.height));

    const nextX = Math.round(it.baseX + deltaX);
    const nextY = Math.round(it.baseY + deltaY);
    return {
      studioId: it.studioId,
      filePath: it.filePath,
      elementIndex: it.elementIndex,
      patch: { styles: { transform: `translate(${nextX}px, ${nextY}px)` } },
      previewStyles: { translate: `${nextX}px ${nextY}px`, transform: 'none' },
    };
  });
}

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseRgbaColor(raw: string | undefined): RgbaColor | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex3 = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hex3) {
    return {
      r: parseInt(hex3[1] + hex3[1], 16),
      g: parseInt(hex3[2] + hex3[2], 16),
      b: parseInt(hex3[3] + hex3[3], 16),
      a: 1,
    };
  }
  const hex6 = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:([0-9a-f]{2}))?$/i);
  if (hex6) {
    return {
      r: parseInt(hex6[1], 16),
      g: parseInt(hex6[2], 16),
      b: parseInt(hex6[3], 16),
      a: hex6[4] ? parseInt(hex6[4], 16) / 255 : 1,
    };
  }
  const rgbMatch = v.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/i
  );
  if (rgbMatch) {
    return {
      r: Math.min(255, Math.max(0, Math.round(parseFloat(rgbMatch[1])))),
      g: Math.min(255, Math.max(0, Math.round(parseFloat(rgbMatch[2])))),
      b: Math.min(255, Math.max(0, Math.round(parseFloat(rgbMatch[3])))),
      a: rgbMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(rgbMatch[4]))) : 1,
    };
  }
  return null;
}

function compositeOver(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

function relativeLuminance(c: RgbaColor): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function resolveEffectiveBgColor(
  computedStyles: Record<string, string>,
  fallbackBg = '#FFFFFF'
): string {
  const bgRaw = computedStyles.backgroundColor;
  const parsed = parseRgbaColor(bgRaw);
  if (!parsed || parsed.a === 0) return fallbackBg;
  if (parsed.a < 1) {
    const base = parseRgbaColor(fallbackBg) || { r: 255, g: 255, b: 255, a: 1 };
    const composited = compositeOver(parsed, base);
    return `rgb(${composited.r}, ${composited.g}, ${composited.b})`;
  }
  return bgRaw;
}

export function computeContrastReport(fgRaw: string, bgRaw: string): ContrastReport {
  const white: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };
  const bgParsed = parseRgbaColor(bgRaw);
  const effectiveBg = bgParsed ? (bgParsed.a < 1 ? compositeOver(bgParsed, white) : bgParsed) : white;
  const fgParsed = parseRgbaColor(fgRaw) || { r: 15, g: 23, b: 42, a: 1 };
  const effectiveFg = fgParsed.a < 1 ? compositeOver(fgParsed, effectiveBg) : fgParsed;

  const l1 = relativeLuminance(effectiveFg);
  const l2 = relativeLuminance(effectiveBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));

  const passesAAA = ratio >= 7;
  const passesAA = ratio >= 4.5;
  const passesAALarge = ratio >= 3;
  const grade: ContrastReport['grade'] = passesAAA
    ? 'AAA'
    : passesAA
      ? 'AA'
      : passesAALarge
        ? 'AA Large'
        : 'Fail';

  return {
    ratio,
    ratioLabel: `${ratio.toFixed(1)}:1`,
    grade,
    passesAA,
    passesAAA,
    passesAALarge,
  };
}
