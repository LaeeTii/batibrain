import type { Point, TopologyWall, Vertex, WallFace } from './types';

const EPSILON = 1e-9;

export const DEFAULT_WALL_THICKNESS_CM = 10;

export type WallQualification = 'detached' | 'exterior' | 'interior';
export type WallTopologyErrorCode =
  | 'too_many_pieces'
  | 'junction_not_inside_wall'
  | 'joining_wall_not_connected'
  | 'missing_third_piece';

export class WallTopologyError extends Error {
  readonly code: WallTopologyErrorCode;
  readonly wallId: string;

  constructor(code: WallTopologyErrorCode, wallId: string, message: string) {
    super(message);
    this.name = 'WallTopologyError';
    this.code = code;
    this.wallId = wallId;
  }
}

export interface CreateTopologyWallsOptions {
  existingWalls?: readonly TopologyWall[];
  thicknessCm?: number;
  createId?: () => string;
}

export function createStableWallFaces(): readonly [WallFace, WallFace] {
  return [{ side: 'gauche' }, { side: 'droite' }];
}

export function createWallsFromVertices(
  vertices: readonly Vertex[],
  options: CreateTopologyWallsOptions = {},
): TopologyWall[] {
  const sorted = [...vertices].sort((left, right) => left.order - right.order);
  if (sorted.length < 2) return [];

  const existingBySegment = new Map(
    (options.existingWalls ?? []).map((wall) => [segmentKey(wall.startVertexId, wall.endVertexId), wall]),
  );
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID());
  const pieceId = sorted[0].pieceId;

  return sorted.map((start, index) => {
    const end = sorted[(index + 1) % sorted.length];
    const existing = existingBySegment.get(segmentKey(start.id, end.id));

    if (existing) {
      return {
        ...existing,
        faces: cloneFaces(existing.faces),
        pieceIds: uniquePieceIds(existing.pieceIds),
      };
    }

    return {
      id: createId(),
      startVertexId: start.id,
      endVertexId: end.id,
      faces: createStableWallFaces(),
      pieceIds: [pieceId],
      thicknessCm: options.thicknessCm ?? DEFAULT_WALL_THICKNESS_CM,
      material: null,
      insulation: null,
      notes: null,
      isLocked: false,
    };
  });
}

export function wallQualification(wall: TopologyWall): WallQualification {
  assertWallRelations(wall);
  if (wall.pieceIds.length === 0) return 'detached';
  return wall.pieceIds.length === 1 ? 'exterior' : 'interior';
}

export function addPieceToWall(wall: TopologyWall, pieceId: string): TopologyWall {
  const pieceIds = uniquePieceIds([...wall.pieceIds, pieceId]);
  if (pieceIds.length > 2) {
    throw new WallTopologyError(
      'too_many_pieces',
      wall.id,
      'Un mur ne peut pas être lié à plus de deux pièces.',
    );
  }

  return { ...wall, faces: cloneFaces(wall.faces), pieceIds };
}

export function removePieceFromWall(wall: TopologyWall, pieceId: string): TopologyWall {
  return {
    ...wall,
    faces: cloneFaces(wall.faces),
    pieceIds: wall.pieceIds.filter((id) => id !== pieceId),
  };
}

export function assertWallRelations(wall: TopologyWall): void {
  if (uniquePieceIds(wall.pieceIds).length !== wall.pieceIds.length || wall.pieceIds.length > 2) {
    throw new WallTopologyError(
      'too_many_pieces',
      wall.id,
      'Un mur doit être lié à zéro, une ou deux pièces distinctes.',
    );
  }
}

export interface SplitWallAtJunctionInput {
  wall: TopologyWall;
  joiningWall: TopologyWall;
  junction: Point & { id: string };
  verticesById: ReadonlyMap<string, Point>;
  createId?: () => string;
}

export function splitWallAtThirdPieceJunction(
  input: SplitWallAtJunctionInput,
): readonly [TopologyWall, TopologyWall, TopologyWall] {
  const { wall, joiningWall, junction, verticesById } = input;
  assertWallRelations(wall);
  assertWallRelations(joiningWall);

  const start = verticesById.get(wall.startVertexId);
  const end = verticesById.get(wall.endVertexId);
  if (!start || !end || !isStrictlyInsideSegment(junction, start, end)) {
    throw new WallTopologyError(
      'junction_not_inside_wall',
      wall.id,
      'Le point de jonction doit être strictement à l’intérieur du mur à scinder.',
    );
  }

  if (joiningWall.startVertexId !== junction.id && joiningWall.endVertexId !== junction.id) {
    throw new WallTopologyError(
      'joining_wall_not_connected',
      joiningWall.id,
      'Le mur aboutissant doit partager le sommet de jonction.',
    );
  }

  const sourcePieceIds = new Set(wall.pieceIds);
  const hasThirdPiece = joiningWall.pieceIds.some((pieceId) => !sourcePieceIds.has(pieceId));
  if (wall.pieceIds.length !== 2 || !hasThirdPiece) {
    throw new WallTopologyError(
      'missing_third_piece',
      wall.id,
      'La scission attend un mur lié à deux pièces et un mur aboutissant lié à une troisième.',
    );
  }

  const createId = input.createId ?? (() => globalThis.crypto.randomUUID());
  const firstHalf = cloneWallWithSegment(wall, wall.id, wall.startVertexId, junction.id);
  const secondHalf = cloneWallWithSegment(wall, createId(), junction.id, wall.endVertexId);
  const connectedWall = {
    ...joiningWall,
    faces: cloneFaces(joiningWall.faces),
    pieceIds: [...joiningWall.pieceIds],
  };

  [firstHalf, secondHalf, connectedWall].forEach(assertWallRelations);
  return [firstHalf, secondHalf, connectedWall];
}

function cloneWallWithSegment(
  wall: TopologyWall,
  id: string,
  startVertexId: string,
  endVertexId: string,
): TopologyWall {
  return {
    ...wall,
    id,
    startVertexId,
    endVertexId,
    faces: cloneFaces(wall.faces),
    pieceIds: [...wall.pieceIds],
  };
}

function cloneFaces(faces: readonly [WallFace, WallFace]): readonly [WallFace, WallFace] {
  return [{ ...faces[0] }, { ...faces[1] }];
}

function uniquePieceIds(pieceIds: readonly string[]): string[] {
  return [...new Set(pieceIds)];
}

function segmentKey(startVertexId: string, endVertexId: string): string {
  return `${startVertexId}:${endVertexId}`;
}

function isStrictlyInsideSegment(point: Point, start: Point, end: Point): boolean {
  const cross = (end.x - start.x) * (point.y - start.y)
    - (end.y - start.y) * (point.x - start.x);
  if (Math.abs(cross) > EPSILON) return false;

  const dot = (point.x - start.x) * (end.x - start.x)
    + (point.y - start.y) * (end.y - start.y);
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot > EPSILON && dot < lengthSquared - EPSILON;
}
