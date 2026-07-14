import type { Point, Vertex } from './types';

const EPSILON = 1e-7;

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function intersects(a: Point, b: Point, c: Point, d: Point) {
  const abC = orientation(a, b, c); const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a); const cdB = orientation(c, d, b);
  return abC * abD < -EPSILON && cdA * cdB < -EPSILON;
}

export function validateRoomPolygon(vertices: readonly Vertex[]): string | null {
  const sorted = [...vertices].sort((a, b) => a.order - b.order);
  if (sorted.length < 3) return 'Une pièce doit contenir au moins trois sommets.';
  if (sorted.some((vertex, index) => vertex.order !== index || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y))) return 'Les sommets doivent être finis, uniques et ordonnés sans interruption.';
  for (let index = 0; index < sorted.length; index += 1) {
    const next = (index + 1) % sorted.length;
    if (Math.hypot(sorted[next].x - sorted[index].x, sorted[next].y - sorted[index].y) <= EPSILON) return 'Deux sommets consécutifs ne peuvent pas être confondus.';
    for (let other = index + 1; other < sorted.length; other += 1) {
      const otherNext = (other + 1) % sorted.length;
      if (index === other || next === other || otherNext === index) continue;
      if (intersects(sorted[index], sorted[next], sorted[other], sorted[otherNext])) return 'Le contour d’une pièce ne peut pas s’auto-intersecter.';
    }
  }
  return null;
}

export function snapGlobalPoint(point: Point, vertices: readonly Vertex[], movingId: string | null, distanceCm = 12, gridCm = 25): Point {
  let best = { ...point }; let distance = distanceCm;
  for (const vertex of vertices) {
    if (vertex.id === movingId) continue;
    const candidateDistance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
    if (candidateDistance <= distance) { best = { x: vertex.x, y: vertex.y }; distance = candidateDistance; }
  }
  if (distance < distanceCm) return best;
  const grid = { x: Math.round(point.x / gridCm) * gridCm, y: Math.round(point.y / gridCm) * gridCm };
  return Math.hypot(grid.x - point.x, grid.y - point.y) <= distanceCm ? grid : point;
}

export function translateRoomVertices(vertices: readonly Vertex[], delta: Point): Vertex[] {
  return vertices.map((vertex) => ({ ...vertex, x: vertex.x + delta.x, y: vertex.y + delta.y }));
}
