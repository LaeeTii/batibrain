import type {
  DerivedWall,
  Opening,
  Point,
  Point2D,
  Polygon,
  Segment,
  Vector2D,
  Vertex,
  Wall,
} from './types';

const EPSILON = 1e-9;

export type OpeningValidationCode =
  | 'wall_not_found'
  | 'invalid_offset'
  | 'invalid_width'
  | 'invalid_bottom'
  | 'invalid_height'
  | 'outside_wall'
  | 'outside_wall_height'
  | 'overlap';

export interface OpeningValidationIssue {
  code: OpeningValidationCode;
  opening: Opening;
  wall: Wall | null;
  wallLengthCm: number | null;
  availableWallHeightCm: number | null;
  conflictingOpening: Opening | null;
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function vector(from: Point, to: Point): Vector2D {
  return { x: to.x - from.x, y: to.y - from.y };
}

export function projectPointOnSegment(point: Point, segment: Segment): Point {
  const direction = vector(segment.start, segment.end);
  const lengthSquared = direction.x ** 2 + direction.y ** 2;

  if (lengthSquared <= EPSILON ** 2) {
    return { ...segment.start };
  }

  const fromStart = vector(segment.start, point);
  const ratio = Math.max(
    0,
    Math.min(1, (fromStart.x * direction.x + fromStart.y * direction.y) / lengthSquared),
  );

  return {
    x: segment.start.x + ratio * direction.x,
    y: segment.start.y + ratio * direction.y,
  };
}

export function segmentLengthCm(a: Point2D, b: Point2D): number {
  return distance(a, b);
}

export function interiorSegmentLengthCm(
  segment: Segment,
  startWallThicknessCm = 0,
  endWallThicknessCm = 0,
): number {
  const startDeduction = Number.isFinite(startWallThicknessCm)
    ? Math.max(0, startWallThicknessCm)
    : 0;
  const endDeduction = Number.isFinite(endWallThicknessCm)
    ? Math.max(0, endWallThicknessCm)
    : 0;
  return Math.max(0, distance(segment.start, segment.end) - startDeduction - endDeduction);
}

export function signedPolygonAreaCm2(points: readonly Point[]): number {
  if (points.length < 3) return 0;

  let doubleArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    doubleArea += current.x * next.y - next.x * current.y;
  }

  return doubleArea / 2;
}

export function polygonAreaCm2(points: Point2D[]): number {
  return Math.abs(signedPolygonAreaCm2(points));
}

export type PolygonOrientation = 'clockwise' | 'counterclockwise' | 'degenerate';

export function polygonOrientation(points: readonly Point[]): PolygonOrientation {
  const signedArea = signedPolygonAreaCm2(points);
  if (Math.abs(signedArea) <= EPSILON) return 'degenerate';
  return signedArea > 0 ? 'counterclockwise' : 'clockwise';
}

export function segmentOrientationDegrees(segment: Segment): number | null {
  const direction = vector(segment.start, segment.end);
  if (Math.hypot(direction.x, direction.y) <= EPSILON) return null;

  const angle = Math.atan2(direction.y, direction.x) * (180 / Math.PI);
  return (angle + 360) % 360;
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
  const centroidX = cx / divisor;
  const centroidY = cy / divisor;
  return {
    x: Math.abs(centroidX) <= EPSILON ? 0 : centroidX,
    y: Math.abs(centroidY) <= EPSILON ? 0 : centroidY,
  };
}

export function polygonCentroid(polygon: Polygon): Point {
  return centroid(polygon.vertices);
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

export function polygonInteriorAnglesDegrees(points: readonly Point[]): number[] {
  const orientation = polygonOrientation(points);
  if (points.length < 3 || orientation === 'degenerate') {
    return points.map(() => 0);
  }

  const orientationSign = orientation === 'counterclockwise' ? 1 : -1;

  return points.map((current, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousVector = vector(current, previous);
    const nextVector = vector(current, next);
    const baseAngle = angleAtVertexDegrees(previous, current, next);
    const cross = previousVector.x * nextVector.y - previousVector.y * nextVector.x;

    return orientationSign * cross > EPSILON ? 360 - baseAngle : baseAngle;
  });
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

export interface RectangleRoomGeometryOptions {
  originX?: number;
  originY?: number;
  wallThicknessCm?: number | null;
  wallHeightCm?: number | null;
}

export function createRectangleRoomGeometry(
  pieceId: string,
  widthCm: number,
  depthCm: number,
  options: RectangleRoomGeometryOptions = {},
): { vertices: Vertex[]; walls: Wall[] } {
  if (!Number.isFinite(widthCm) || widthCm <= EPSILON) {
    throw new Error('La largeur de la pièce doit être strictement positive.');
  }

  if (!Number.isFinite(depthCm) || depthCm <= EPSILON) {
    throw new Error('La profondeur de la pièce doit être strictement positive.');
  }

  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const wallThicknessCm = options.wallThicknessCm ?? null;
  const wallHeightCm = options.wallHeightCm ?? null;

  const vertices: Vertex[] = [
    { id: globalThis.crypto.randomUUID(), pieceId, order: 0, x: originX, y: originY },
    { id: globalThis.crypto.randomUUID(), pieceId, order: 1, x: originX + widthCm, y: originY },
    { id: globalThis.crypto.randomUUID(), pieceId, order: 2, x: originX + widthCm, y: originY + depthCm },
    { id: globalThis.crypto.randomUUID(), pieceId, order: 3, x: originX, y: originY + depthCm },
  ];

  const walls = syncWallsWithVertices(vertices, []).map((wall) => ({
    ...wall,
    thicknessCm: wallThicknessCm,
    heightLeftCm: wallHeightCm,
    heightRightCm: wallHeightCm,
  }));

  return {
    vertices,
    walls,
  };
}

export function createRectangleRoomGeometryFromPoints(
  pieceId: string,
  firstPoint: Point,
  secondPoint: Point,
  options: Omit<RectangleRoomGeometryOptions, 'originX' | 'originY'> = {},
): { vertices: Vertex[]; walls: Wall[] } {
  const originX = Math.min(firstPoint.x, secondPoint.x);
  const originY = Math.min(firstPoint.y, secondPoint.y);
  return createRectangleRoomGeometry(
    pieceId,
    Math.abs(secondPoint.x - firstPoint.x),
    Math.abs(secondPoint.y - firstPoint.y),
    { ...options, originX, originY },
  );
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

export function syncOpeningsWithWalls(walls: Wall[], openings: Opening[]): Opening[] {
  const wallIds = new Set(walls.map((wall) => wall.id));
  return openings.filter((opening) => wallIds.has(opening.wallId));
}

function openingRangesOverlap(
  leftStartCm: number,
  leftEndCm: number,
  rightStartCm: number,
  rightEndCm: number,
): boolean {
  return leftStartCm < rightEndCm - EPSILON && rightStartCm < leftEndCm - EPSILON;
}

function findWallEndpoints(
  verticesById: Map<string, Vertex>,
  wall: Wall,
): { start: Vertex; end: Vertex } | null {
  const start = verticesById.get(wall.startVertexId);
  const end = verticesById.get(wall.endVertexId);

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

function normalizeWallHeightCm(heightCm: number | null | undefined): number | null {
  if (!Number.isFinite(heightCm) || heightCm === null || heightCm === undefined) {
    return null;
  }

  return heightCm;
}

function wallHeightAtOffsetCm(wall: Wall, wallLengthCm: number, offsetCm: number): number | null {
  const leftHeightCm = normalizeWallHeightCm(wall.heightLeftCm);
  const rightHeightCm = normalizeWallHeightCm(wall.heightRightCm);

  if (leftHeightCm === null && rightHeightCm === null) {
    return null;
  }

  if (leftHeightCm === null) {
    return rightHeightCm;
  }

  if (rightHeightCm === null) {
    return leftHeightCm;
  }

  if (wallLengthCm <= EPSILON) {
    return Math.min(leftHeightCm, rightHeightCm);
  }

  const ratio = Math.max(0, Math.min(1, offsetCm / wallLengthCm));
  return leftHeightCm + (rightHeightCm - leftHeightCm) * ratio;
}

export function validateOpeningOnWall(
  wallLengthCm: number,
  wall: Wall | null,
  opening: Opening,
  siblingOpenings: Opening[],
): OpeningValidationIssue | null {
  if (!Number.isFinite(opening.offsetCm) || opening.offsetCm < 0) {
    return {
      code: 'invalid_offset',
      opening,
      wall,
      wallLengthCm,
      availableWallHeightCm: null,
      conflictingOpening: null,
    };
  }

  if (!Number.isFinite(opening.widthCm) || opening.widthCm <= EPSILON) {
    return {
      code: 'invalid_width',
      opening,
      wall,
      wallLengthCm,
      availableWallHeightCm: null,
      conflictingOpening: null,
    };
  }

  if (!Number.isFinite(opening.bottomCm) || opening.bottomCm < 0) {
    return {
      code: 'invalid_bottom',
      opening,
      wall,
      wallLengthCm,
      availableWallHeightCm: null,
      conflictingOpening: null,
    };
  }

  if (!Number.isFinite(opening.heightCm) || opening.heightCm <= EPSILON) {
    return {
      code: 'invalid_height',
      opening,
      wall,
      wallLengthCm,
      availableWallHeightCm: null,
      conflictingOpening: null,
    };
  }

  const openingStartCm = opening.offsetCm;
  const openingEndCm = opening.offsetCm + opening.widthCm;

  if (openingEndCm > wallLengthCm + EPSILON) {
    return {
      code: 'outside_wall',
      opening,
      wall,
      wallLengthCm,
      availableWallHeightCm: null,
      conflictingOpening: null,
    };
  }

  if (wall) {
    const wallHeightAtOpeningStartCm = wallHeightAtOffsetCm(wall, wallLengthCm, openingStartCm);
    const wallHeightAtOpeningEndCm = wallHeightAtOffsetCm(wall, wallLengthCm, openingEndCm);

    if (wallHeightAtOpeningStartCm !== null || wallHeightAtOpeningEndCm !== null) {
      const availableWallHeightCm = Math.min(
        wallHeightAtOpeningStartCm ?? Number.POSITIVE_INFINITY,
        wallHeightAtOpeningEndCm ?? Number.POSITIVE_INFINITY,
      );

      if (opening.bottomCm + opening.heightCm > availableWallHeightCm + EPSILON) {
        return {
          code: 'outside_wall_height',
          opening,
          wall,
          wallLengthCm,
          availableWallHeightCm,
          conflictingOpening: null,
        };
      }
    }
  }

  for (const siblingOpening of siblingOpenings) {
    if (siblingOpening.id === opening.id) {
      continue;
    }

    if (!Number.isFinite(siblingOpening.offsetCm) || siblingOpening.offsetCm < 0) {
      continue;
    }

    if (!Number.isFinite(siblingOpening.widthCm) || siblingOpening.widthCm <= EPSILON) {
      continue;
    }

    const siblingStartCm = siblingOpening.offsetCm;
    const siblingEndCm = siblingOpening.offsetCm + siblingOpening.widthCm;

    if (openingRangesOverlap(openingStartCm, openingEndCm, siblingStartCm, siblingEndCm)) {
      return {
        code: 'overlap',
        opening,
        wall,
        wallLengthCm,
        availableWallHeightCm: null,
        conflictingOpening: siblingOpening,
      };
    }
  }

  return null;
}

export function validateOpenings(
  vertices: Vertex[],
  walls: Wall[],
  openings: Opening[],
): OpeningValidationIssue[] {
  const verticesById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
  const openingsByWallId = new Map<string, Opening[]>();

  for (const opening of openings) {
    const groupedOpenings = openingsByWallId.get(opening.wallId) ?? [];
    groupedOpenings.push(opening);
    openingsByWallId.set(opening.wallId, groupedOpenings);
  }

  const issues: OpeningValidationIssue[] = [];

  for (const opening of openings) {
    const wall = wallsById.get(opening.wallId) ?? null;
    if (!wall) {
      issues.push({
        code: 'wall_not_found',
        opening,
        wall: null,
        wallLengthCm: null,
        availableWallHeightCm: null,
        conflictingOpening: null,
      });
      continue;
    }

    const endpoints = findWallEndpoints(verticesById, wall);
    if (!endpoints) {
      issues.push({
        code: 'wall_not_found',
        opening,
        wall,
        wallLengthCm: null,
        availableWallHeightCm: null,
        conflictingOpening: null,
      });
      continue;
    }

    const wallLengthCm = segmentLengthCm(endpoints.start, endpoints.end);
    const issue = validateOpeningOnWall(
      wallLengthCm,
      wall,
      opening,
      openingsByWallId.get(opening.wallId) ?? [],
    );

    if (issue) {
      issues.push({
        ...issue,
        wall,
      });
    }
  }

  return issues;
}

export function formatOpeningValidationIssue(issue: OpeningValidationIssue): string {
  switch (issue.code) {
    case 'invalid_offset':
      return 'La position de l’ouverture doit être positive ou nulle.';
    case 'invalid_width':
      return 'La largeur de l’ouverture doit être strictement positive.';
    case 'invalid_bottom':
      return 'L’allège de l’ouverture doit être positive ou nulle.';
    case 'invalid_height':
      return 'La hauteur de l’ouverture doit être strictement positive.';
    case 'outside_wall': {
      const wallLengthLabel = issue.wallLengthCm === null
        ? 'la longueur du mur'
        : `${Math.round(issue.wallLengthCm)} cm`;

      return `L’ouverture dépasse les limites du mur (${wallLengthLabel}).`;
    }
    case 'outside_wall_height': {
      const wallHeightLabel = issue.availableWallHeightCm === null
        ? 'la hauteur disponible du mur'
        : `${Math.round(issue.availableWallHeightCm)} cm`;

      return `Le haut de l’ouverture dépasse la hauteur disponible du mur à cet emplacement (${wallHeightLabel}).`;
    }
    case 'overlap':
      return 'Deux ouvertures d’un même mur ne peuvent pas se chevaucher.';
    case 'wall_not_found':
      return 'Le mur associé à l’ouverture est introuvable.';
    default:
      return 'L’ouverture est invalide.';
  }
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
      id: sourceWall.pieceId === targetWall.pieceId ? sourceWall.id : targetWall.id,
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
