import { ElementRect } from './types';

export interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  kind: 'edge' | 'center';
}

export interface SnapCandidate extends ElementRect {
  kind?: 'sibling' | 'parent' | 'viewport';
}

export interface DragSnapInput {
  originRect: ElementRect;
  rawOffsetX: number;
  rawOffsetY: number;
  candidates: SnapCandidate[];
  threshold?: number;
}

export interface DragSnapResult {
  snappedX: number;
  snappedY: number;
  guides: AlignmentGuide[];
}

export type ResizeDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface ResizeSnapInput {
  initRect: ElementRect;
  dir: ResizeDir;
  rawDx: number;
  rawDy: number;
  candidates: SnapCandidate[];
  threshold?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface ResizeSnapResult {
  width: number;
  height: number;
  guides: AlignmentGuide[];
}

interface AxisTarget {
  pos: number;
  start: number;
  end: number;
  kind: 'edge' | 'center';
}

function getVerticalTargets(candidates: SnapCandidate[]): AxisTarget[] {
  const targets: AxisTarget[] = [];
  for (const c of candidates) {
    targets.push({ pos: c.x, start: c.y, end: c.y + c.height, kind: 'edge' });
    targets.push({ pos: c.x + c.width / 2, start: c.y, end: c.y + c.height, kind: 'center' });
    targets.push({ pos: c.x + c.width, start: c.y, end: c.y + c.height, kind: 'edge' });
  }
  return targets;
}

function getHorizontalTargets(candidates: SnapCandidate[]): AxisTarget[] {
  const targets: AxisTarget[] = [];
  for (const c of candidates) {
    targets.push({ pos: c.y, start: c.x, end: c.x + c.width, kind: 'edge' });
    targets.push({ pos: c.y + c.height / 2, start: c.x, end: c.x + c.width, kind: 'center' });
    targets.push({ pos: c.y + c.height, start: c.x, end: c.x + c.width, kind: 'edge' });
  }
  return targets;
}

export function computeDragSnap({
  originRect,
  rawOffsetX,
  rawOffsetY,
  candidates,
  threshold = 6,
}: DragSnapInput): DragSnapResult {
  const movingX = originRect.x + rawOffsetX;
  const movingY = originRect.y + rawOffsetY;
  const w = originRect.width;
  const h = originRect.height;

  const vAnchors = [
    { val: movingX, kind: 'edge' as const },
    { val: movingX + w / 2, kind: 'center' as const },
    { val: movingX + w, kind: 'edge' as const },
  ];
  const hAnchors = [
    { val: movingY, kind: 'edge' as const },
    { val: movingY + h / 2, kind: 'center' as const },
    { val: movingY + h, kind: 'edge' as const },
  ];

  const vTargets = getVerticalTargets(candidates);
  const hTargets = getHorizontalTargets(candidates);

  let bestDx = 0;
  let bestDistX = threshold + 1;
  let bestVTarget: AxisTarget | null = null;

  for (const anchor of vAnchors) {
    for (const target of vTargets) {
      const dist = Math.abs(target.pos - anchor.val);
      if (dist <= threshold && dist < bestDistX) {
        bestDistX = dist;
        bestDx = target.pos - anchor.val;
        bestVTarget = target;
      }
    }
  }

  let bestDy = 0;
  let bestDistY = threshold + 1;
  let bestHTarget: AxisTarget | null = null;

  for (const anchor of hAnchors) {
    for (const target of hTargets) {
      const dist = Math.abs(target.pos - anchor.val);
      if (dist <= threshold && dist < bestDistY) {
        bestDistY = dist;
        bestDy = target.pos - anchor.val;
        bestHTarget = target;
      }
    }
  }

  const snappedX = Math.round(rawOffsetX + bestDx);
  const snappedY = Math.round(rawOffsetY + bestDy);
  const finalY = originRect.y + snappedY;
  const finalX = originRect.x + snappedX;

  const guides: AlignmentGuide[] = [];
  if (bestVTarget) {
    guides.push({
      orientation: 'vertical',
      position: Math.round(bestVTarget.pos),
      start: Math.round(Math.min(bestVTarget.start, finalY)),
      end: Math.round(Math.max(bestVTarget.end, finalY + h)),
      kind: bestVTarget.kind,
    });
  }
  if (bestHTarget) {
    guides.push({
      orientation: 'horizontal',
      position: Math.round(bestHTarget.pos),
      start: Math.round(Math.min(bestHTarget.start, finalX)),
      end: Math.round(Math.max(bestHTarget.end, finalX + w)),
      kind: bestHTarget.kind,
    });
  }

  return { snappedX, snappedY, guides };
}

export function computeResizeSnap({
  initRect,
  dir,
  rawDx,
  rawDy,
  candidates,
  threshold = 6,
  minWidth = 24,
  minHeight = 20,
}: ResizeSnapInput): ResizeSnapResult {
  let width = Math.max(minWidth, Math.round(initRect.width + (dir.includes('e') ? rawDx : dir.includes('w') ? -rawDx : 0)));
  let height = Math.max(minHeight, Math.round(initRect.height + (dir.includes('s') ? rawDy : dir.includes('n') ? -rawDy : 0)));

  const guides: AlignmentGuide[] = [];
  const vTargets = getVerticalTargets(candidates);
  const hTargets = getHorizontalTargets(candidates);

  if (dir.includes('e')) {
    const rightEdge = initRect.x + width;
    let bestDelta = 0;
    let bestDist = threshold + 1;
    let bestTarget: AxisTarget | null = null;
    for (const t of vTargets) {
      const dist = Math.abs(t.pos - rightEdge);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestDelta = t.pos - rightEdge;
        bestTarget = t;
      }
    }
    if (bestTarget && width + bestDelta >= minWidth) {
      width = Math.round(width + bestDelta);
      guides.push({
        orientation: 'vertical',
        position: Math.round(bestTarget.pos),
        start: Math.round(Math.min(bestTarget.start, initRect.y)),
        end: Math.round(Math.max(bestTarget.end, initRect.y + height)),
        kind: bestTarget.kind,
      });
    }
  } else if (dir.includes('w')) {
    const leftEdge = initRect.x + initRect.width - width;
    let bestDelta = 0;
    let bestDist = threshold + 1;
    let bestTarget: AxisTarget | null = null;
    for (const t of vTargets) {
      const dist = Math.abs(t.pos - leftEdge);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestDelta = leftEdge - t.pos;
        bestTarget = t;
      }
    }
    if (bestTarget && width + bestDelta >= minWidth) {
      width = Math.round(width + bestDelta);
      guides.push({
        orientation: 'vertical',
        position: Math.round(bestTarget.pos),
        start: Math.round(Math.min(bestTarget.start, initRect.y)),
        end: Math.round(Math.max(bestTarget.end, initRect.y + height)),
        kind: bestTarget.kind,
      });
    }
  }

  if (dir.includes('s')) {
    const bottomEdge = initRect.y + height;
    let bestDelta = 0;
    let bestDist = threshold + 1;
    let bestTarget: AxisTarget | null = null;
    for (const t of hTargets) {
      const dist = Math.abs(t.pos - bottomEdge);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestDelta = t.pos - bottomEdge;
        bestTarget = t;
      }
    }
    if (bestTarget && height + bestDelta >= minHeight) {
      height = Math.round(height + bestDelta);
      guides.push({
        orientation: 'horizontal',
        position: Math.round(bestTarget.pos),
        start: Math.round(Math.min(bestTarget.start, initRect.x)),
        end: Math.round(Math.max(bestTarget.end, initRect.x + width)),
        kind: bestTarget.kind,
      });
    }
  } else if (dir.includes('n')) {
    const topEdge = initRect.y + initRect.height - height;
    let bestDelta = 0;
    let bestDist = threshold + 1;
    let bestTarget: AxisTarget | null = null;
    for (const t of hTargets) {
      const dist = Math.abs(t.pos - topEdge);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestDelta = topEdge - t.pos;
        bestTarget = t;
      }
    }
    if (bestTarget && height + bestDelta >= minHeight) {
      height = Math.round(height + bestDelta);
      guides.push({
        orientation: 'horizontal',
        position: Math.round(bestTarget.pos),
        start: Math.round(Math.min(bestTarget.start, initRect.x)),
        end: Math.round(Math.max(bestTarget.end, initRect.x + width)),
        kind: bestTarget.kind,
      });
    }
  }

  return { width, height, guides };
}
