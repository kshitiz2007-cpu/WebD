export type VectorPoint = { x: number; y: number };
export type VectorCommand = { type: 'move' | 'line' | 'curve' | 'close'; points: VectorPoint[] };
export type VectorPath = { commands: VectorCommand[] };
export function pathToSvgData(path: VectorPath): string {
  return path.commands.map(command => {
    if (command.type === 'close') return 'Z';
    const p = command.points;
    if (command.type === 'move' && p[0]) return `M ${p[0].x} ${p[0].y}`;
    if (command.type === 'line' && p[0]) return `L ${p[0].x} ${p[0].y}`;
    if (command.type === 'curve' && p.length >= 3) return `C ${p[0].x} ${p[0].y}, ${p[1].x} ${p[1].y}, ${p[2].x} ${p[2].y}`;
    return '';
  }).filter(Boolean).join(' ');
}
export function vectorBounds(points: VectorPoint[]) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(0, Math.max(...xs) - minX), height: Math.max(0, Math.max(...ys) - minY) };
}
export function translateVectorPoints(points: VectorPoint[], dx: number, dy: number): VectorPoint[] {
  return points.map(point => ({ x: point.x + dx, y: point.y + dy }));
}
export function simplifyVectorPoints(points: VectorPoint[], tolerance = 1.5): VectorPoint[] {
  if (points.length <= 2) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const previous = result[result.length - 1], current = points[i], next = points[i + 1];
    const area = Math.abs((current.x - previous.x) * (next.y - previous.y) - (current.y - previous.y) * (next.x - previous.x));
    const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
    if (area / length > tolerance) result.push(current);
  }
  result.push(points[points.length - 1]);
  return result;
}
