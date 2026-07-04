import type { DerivedWall, Point2D, Vertex, Wall } from './types';

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

function wallSegmentKey(startVertexId: string, endVertexId: string): string {
  return `${startVertexId}:${endVertexId}`;
}

function createWall(pieceId: string, startVertexId: string, endVertexId: string): Wall {
  return {
    id: globalThis.crypto.randomUUID(),
    pieceId,
    startVertexId,
    endVertexId,
    thicknessCm: null,
    heightLeftCm: null,
    heightRightCm: null,
    material: null,
    insulation: null,
    notes: null,
  };
}

export function syncWallsWithVertices(vertices: Vertex[], walls: Wall[]): Wall[] {
  const sorted = sortVertices(vertices);
  if (sorted.length < 2) return [];

  const wallsBySegment = new Map(
    walls.map((wall) => [wallSegmentKey(wall.startVertexId, wall.endVertexId), wall]),
  );

  return sorted.map((start, index) => {
    const end = sorted[(index + 1) % sorted.length];
    const existingWall = wallsBySegment.get(wallSegmentKey(start.id, end.id));

    if (!existingWall) {
      return createWall(start.pieceId, start.id, end.id);
    }

    if (
      existingWall.pieceId === start.pieceId
      && existingWall.startVertexId === start.id
      && existingWall.endVertexId === end.id
    ) {
      return existingWall;
    }

    return {
      ...existingWall,
      pieceId: start.pieceId,
      startVertexId: start.id,
      endVertexId: end.id,
    };
  });
}

export function remapWallsToVertices(
  sourceVertices: Vertex[],
  targetVertices: Vertex[],
  walls: Wall[],
): Wall[] {
  const orderedSourceWalls = syncWallsWithVertices(sourceVertices, walls);
  const orderedTargetWalls = syncWallsWithVertices(targetVertices, []);

  return orderedTargetWalls.map((targetWall, index) => {
    const sourceWall = orderedSourceWalls[index];
    if (!sourceWall) {
      return targetWall;
    }

    return {
      ...targetWall,
      id: sourceWall.id,
      thicknessCm: sourceWall.thicknessCm ?? null,
      heightLeftCm: sourceWall.heightLeftCm ?? null,
      heightRightCm: sourceWall.heightRightCm ?? null,
      material: sourceWall.material ?? null,
      insulation: sourceWall.insulation ?? null,
      notes: sourceWall.notes ?? null,
    };
  });
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

export function removeVertex(vertices: Vertex[], vertexId: string): Vertex[] | null {
  const sorted = sortVertices(vertices);
  if (sorted.length <= 3) return null;

  const next = sorted.filter((vertex) => vertex.id !== vertexId);
  if (next.length === sorted.length || next.length < 3) return null;

  return next.map((vertex, index) => ({
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

export function updateWallLength(
  vertices: Vertex[],
  wallIndex: number,
  nextLengthCm: number,
): Vertex[] | null {
  const sorted = sortVertices(vertices);
  if (sorted.length < 2) return null;
  if (!Number.isFinite(nextLengthCm) || nextLengthCm <= EPSILON) return null;
  if (wallIndex < 0 || wallIndex >= sorted.length) return null;

  const start = sorted[wallIndex];
  const endIndex = (wallIndex + 1) % sorted.length;
  const end = sorted[endIndex];
  const currentLength = segmentLengthCm(start, end);

  if (currentLength <= EPSILON) return null;

  const ratio = nextLengthCm / currentLength;
  const nextEndX = start.x + (end.x - start.x) * ratio;
  const nextEndY = start.y + (end.y - start.y) * ratio;

  return sorted.map((vertex, index) => (
    index === endIndex
      ? { ...vertex, x: nextEndX, y: nextEndY }
      : vertex
  ));
}

export function snapPointToNearbyAxes(
  vertices: Vertex[],
  movingVertexId: string,
  point: Point2D,
  thresholdCm = 12,
): {
  point: Point2D;
  snappedX: number | null;
  snappedY: number | null;
} {
  let snappedX: number | null = null;
  let snappedY: number | null = null;
  let minDeltaX = thresholdCm + EPSILON;
  let minDeltaY = thresholdCm + EPSILON;

  for (const vertex of vertices) {
    if (vertex.id === movingVertexId) continue;

    const deltaX = Math.abs(point.x - vertex.x);
    if (deltaX <= thresholdCm && deltaX < minDeltaX) {
      minDeltaX = deltaX;
      snappedX = vertex.x;
    }

    const deltaY = Math.abs(point.y - vertex.y);
    if (deltaY <= thresholdCm && deltaY < minDeltaY) {
      minDeltaY = deltaY;
      snappedY = vertex.y;
    }
  }

  return {
    point: {
      x: snappedX ?? point.x,
      y: snappedY ?? point.y,
    },
    snappedX,
    snappedY,
  };
}

export function formatLengthCm(lengthCm: number): string {
  if (lengthCm >= 100) {
    return `${(lengthCm / 100).toFixed(2)} m`;
  }
  return `${Math.round(lengthCm)} cm`;
}
