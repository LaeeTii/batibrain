import type { DerivedWall, Point2D, Vertex } from './types';

const EPSILON = 1e-9;

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function segmentLengthCm(a: Point2D, b: Point2D): number {
  return distance(a, b);
}

export function polygonAreaCm2(points: Point2D[]): number {
  if (points.length < 3) return 0;

  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return Math.abs(sum) / 2;
}

export function polygonPerimeterCm(points: Point2D[]): number {
  if (points.length < 2) return 0;

  let result = 0;
  for (let i = 0; i < points.length; i += 1) {
    result += distance(points[i], points[(i + 1) % points.length]);
  }
  return result;
}

export function centroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };

  const area = polygonAreaCm2(points);
  if (area < EPSILON) {
    const avg = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 },
    );
    return { x: avg.x / points.length, y: avg.y / points.length };
  }

  let cx = 0;
  let cy = 0;
  let factorSum = 0;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const factor = current.x * next.y - next.x * current.y;
    factorSum += factor;
    cx += (current.x + next.x) * factor;
    cy += (current.y + next.y) * factor;
  }

  const divisor = factorSum * 3;
  return { x: cx / divisor, y: cy / divisor };
}

export function angleAtVertexDegrees(prev: Point2D, current: Point2D, next: Point2D): number {
  const v1 = { x: prev.x - current.x, y: prev.y - current.y };
  const v2 = { x: next.x - current.x, y: next.y - current.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const norm1 = Math.hypot(v1.x, v1.y);
  const norm2 = Math.hypot(v2.x, v2.y);

  if (norm1 < EPSILON || norm2 < EPSILON) return 0;
  const ratio = Math.min(1, Math.max(-1, dot / (norm1 * norm2)));
  return Math.acos(ratio) * (180 / Math.PI);
}

export function sortVertices(vertices: Vertex[]): Vertex[] {
  return [...vertices].sort((a, b) => a.order - b.order);
}

export function wallsFromVertices(vertices: Vertex[]): DerivedWall[] {
  const sorted = sortVertices(vertices);
  if (sorted.length < 2) return [];

  return sorted.map((start, index) => {
    const end = sorted[(index + 1) % sorted.length];
    return {
      index,
      start,
      end,
      lengthCm: segmentLengthCm(start, end),
    };
  });
}

export function insertVertexBetween(
  vertices: Vertex[],
  firstVertexId: string,
  secondVertexId: string,
  newVertex: Omit<Vertex, 'order'>,
): Vertex[] | null {
  const sorted = sortVertices(vertices);
  if (sorted.length < 2) return null;

  const edgeIndex = sorted.findIndex((start, index) => {
    const end = sorted[(index + 1) % sorted.length];
    return (
      (start.id === firstVertexId && end.id === secondVertexId)
      || (start.id === secondVertexId && end.id === firstVertexId)
    );
  });

  if (edgeIndex === -1) return null;

  const withInsertedVertex = [
    ...sorted.slice(0, edgeIndex + 1),
    { ...newVertex, order: edgeIndex + 1 },
    ...sorted.slice(edgeIndex + 1),
  ];

  return withInsertedVertex.map((vertex, index) => ({
    ...vertex,
    order: index,
  }));
}

export function updateVertexPosition(
  vertices: Vertex[],
  vertexId: string,
  x: number,
  y: number,
): Vertex[] {
  return vertices.map((vertex) =>
    vertex.id === vertexId ? { ...vertex, x, y } : vertex,
  );
}

export function formatLengthCm(lengthCm: number): string {
  if (lengthCm >= 100) {
    return `${(lengthCm / 100).toFixed(2)} m`;
  }
  return `${Math.round(lengthCm)} cm`;
}
