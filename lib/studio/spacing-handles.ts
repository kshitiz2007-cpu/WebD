export type SpacingKind = 'padding' | 'margin';
export type SpacingSide = 'top' | 'right' | 'bottom' | 'left';
export type SpacingSymmetricMode = 'single' | 'axis' | 'all';

export interface BoxSideValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ComputedBoxSpacing {
  padding: BoxSideValues;
  margin: BoxSideValues;
}

function parsePxNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export function parseComputedBoxSpacing(
  computedStyles: Record<string, string> | undefined
): ComputedBoxSpacing {
  const s = computedStyles || {};
  return {
    padding: {
      top: Math.max(0, parsePxNumber(s.paddingTop)),
      right: Math.max(0, parsePxNumber(s.paddingRight)),
      bottom: Math.max(0, parsePxNumber(s.paddingBottom)),
      left: Math.max(0, parsePxNumber(s.paddingLeft)),
    },
    margin: {
      top: parsePxNumber(s.marginTop),
      right: parsePxNumber(s.marginRight),
      bottom: parsePxNumber(s.marginBottom),
      left: parsePxNumber(s.marginLeft),
    },
  };
}

export interface SpacingDragInput {
  kind: SpacingKind;
  side: SpacingSide;
  initialValues: BoxSideValues;
  deltaX: number;
  deltaY: number;
  scale: number;
  symmetricMode?: SpacingSymmetricMode;
  snapStep?: number;
}

export interface SpacingDragResult {
  nextValues: BoxSideValues;
  affectedSides: SpacingSide[];
  primaryValue: number;
  stylePatch: Record<string, string>;
  badgeLabel: string;
}

function clampSpacingValue(kind: SpacingKind, value: number): number {
  if (kind === 'padding') {
    return Math.max(0, Math.min(240, value));
  }
  return Math.max(0, Math.min(240, value));
}

function snapValue(value: number, step: number): number {
  if (step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

export function computeSpacingDragResult(input: SpacingDragInput): SpacingDragResult {
  const safeScale = input.scale > 0.05 ? input.scale : 1;
  const dx = input.deltaX / safeScale;
  const dy = input.deltaY / safeScale;
  const symmetricMode = input.symmetricMode || 'single';
  const snapStep = input.snapStep ?? 4;

  // Padding increases when dragging INWARD toward the element center.
  // Margin increases when dragging OUTWARD away from the element border.
  let rawDelta = 0;
  if (input.kind === 'padding') {
    switch (input.side) {
      case 'top':
        rawDelta = dy;
        break;
      case 'bottom':
        rawDelta = -dy;
        break;
      case 'left':
        rawDelta = dx;
        break;
      case 'right':
        rawDelta = -dx;
        break;
    }
  } else {
    switch (input.side) {
      case 'top':
        rawDelta = -dy;
        break;
      case 'bottom':
        rawDelta = dy;
        break;
      case 'left':
        rawDelta = -dx;
        break;
      case 'right':
        rawDelta = dx;
        break;
    }
  }

  const baseInitial = input.initialValues[input.side];
  const nextPrimary = clampSpacingValue(
    input.kind,
    snapValue(baseInitial + rawDelta, snapStep)
  );

  const affectedSides: SpacingSide[] =
    symmetricMode === 'all'
      ? ['top', 'right', 'bottom', 'left']
      : symmetricMode === 'axis'
      ? input.side === 'top' || input.side === 'bottom'
        ? ['top', 'bottom']
        : ['left', 'right']
      : [input.side];

  const nextValues: BoxSideValues = { ...input.initialValues };
  const stylePatch: Record<string, string> = {};
  const propPrefix = input.kind === 'padding' ? 'padding' : 'margin';

  for (const s of affectedSides) {
    nextValues[s] = nextPrimary;
    const capSide = s.charAt(0).toUpperCase() + s.slice(1);
    stylePatch[`${propPrefix}${capSide}`] = `${nextPrimary}px`;
  }

  const shortPrefix = input.kind === 'padding' ? 'P' : 'M';
  const sideLabel =
    symmetricMode === 'all'
      ? 'All'
      : symmetricMode === 'axis'
      ? input.side === 'top' || input.side === 'bottom'
        ? 'Y'
        : 'X'
      : input.side.charAt(0).toUpperCase();

  return {
    nextValues,
    affectedSides,
    primaryValue: nextPrimary,
    stylePatch,
    badgeLabel: `${shortPrefix}${sideLabel} ${nextPrimary}px`,
  };
}
