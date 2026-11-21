export type CanvasPoint = { x: number; y: number };
export type CanvasRect = CanvasPoint & { width: number; height: number };

export const CANVAS_ZOOM_MIN = 0.2;
export const CANVAS_ZOOM_MAX = 4;
export const CANVAS_ZOOM_STEP = 0.1;

export function clampCanvasZoom(value: number): number {
  return Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, Number(value.toFixed(2))));
}
export function stepCanvasZoom(current: number, direction: 'in' | 'out'): number {
  return clampCanvasZoom(current + (direction === 'in' ? CANVAS_ZOOM_STEP : -CANVAS_ZOOM_STEP));
}
export function snapCanvasValue(value: number, grid = 1): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}
export function snapCanvasRect(rect: CanvasRect, grid = 1): CanvasRect {
  return { x: snapCanvasValue(rect.x, grid), y: snapCanvasValue(rect.y, grid),
    width: Math.max(1, snapCanvasValue(rect.width, grid)), height: Math.max(1, snapCanvasValue(rect.height, grid)) };
}
export function applyCanvasTransform(rect: CanvasRect, transform: Partial<CanvasRect>, precision = 1): CanvasRect {
  const round = (value: number) => Number((value / precision).toFixed(0)) * precision;
  return { x: round(transform.x ?? rect.x), y: round(transform.y ?? rect.y),
    width: Math.max(1, round(transform.width ?? rect.width)), height: Math.max(1, round(transform.height ?? rect.height)) };
}
export function canvasPanDelta(start: CanvasPoint, current: CanvasPoint): CanvasPoint {
  return { x: current.x - start.x, y: current.y - start.y };
}