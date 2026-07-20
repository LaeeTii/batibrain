import type {
  OpeningTemplate,
  Room,
  TopologyOpening,
  TopologyWall,
  Vertex,
  WallHeightProfiles,
} from './types';
import { validateOpening } from './opening';
import { assertValidRoomVertices } from './room';
import { assertWallRelations, isWallLocked } from './wall';
import { assertValidWallHeightProfiles } from './wallHeightProfile';

const EPSILON = 1e-9;

export interface GeometryVertex {
  id: string;
  levelId: string;
  x: number;
  y: number;
  isLocked: boolean;
}

export interface GeometryPiece {
  room: Room;
  vertexIds: string[];
}

export interface LevelGeometrySnapshot {
  levelId: string;
  revision: number;
  vertices: GeometryVertex[];
  pieces: GeometryPiece[];
  walls: TopologyWall[];
  profilesByWallId: Record<string, WallHeightProfiles>;
  openings: TopologyOpening[];
  templatesById: Record<string, OpeningTemplate>;
  unlockedVertexIds?: string[];
  unlockedProfilePointIds?: string[];
}

export type GeometryMutationErrorCode =
  | 'locked_vertex'
  | 'locked_profile_point'
  | 'invalid_snapshot';

export class GeometryMutationError extends Error {
  readonly code: GeometryMutationErrorCode;
  readonly pointId: string | null;

  constructor(code: GeometryMutationErrorCode, message: string, pointId: string | null = null) {
    super(message);
    this.name = 'GeometryMutationError';
    this.code = code;
    this.pointId = pointId;
  }
}

export function isRoomLocked(piece: GeometryPiece, verticesById: ReadonlyMap<string, GeometryVertex>) {
  return piece.vertexIds.length > 0
    && piece.vertexIds.every((vertexId) => verticesById.get(vertexId)?.isLocked === true);
}

export function assertLevelGeometrySnapshot(snapshot: LevelGeometrySnapshot): void {
  const verticesById = uniqueMap(snapshot.vertices, 'sommet');
  const piecesById = uniqueMap(snapshot.pieces.map(({ room }) => room), 'pièce');
  const wallsById = uniqueMap(snapshot.walls, 'mur');
  uniqueMap(snapshot.openings, 'ouverture');

  for (const vertex of snapshot.vertices) {
    if (
      vertex.levelId !== snapshot.levelId
      || !Number.isFinite(vertex.x)
      || !Number.isFinite(vertex.y)
    ) {
      throw invalidSnapshot('Chaque sommet doit appartenir au niveau et avoir des coordonnées finies.');
    }
  }

  for (const piece of snapshot.pieces) {
    const projectedVertices = piece.vertexIds.map((vertexId, order): Vertex => {
      const vertex = verticesById.get(vertexId);
      if (!vertex) throw invalidSnapshot('Le contour d’une pièce référence un sommet absent.');
      return {
        id: vertex.id,
        pieceId: piece.room.id,
        order,
        x: vertex.x,
        y: vertex.y,
        isLocked: vertex.isLocked,
      };
    });
    if (new Set(piece.vertexIds).size !== piece.vertexIds.length) {
      throw invalidSnapshot('Le contour d’une pièce ne peut pas référencer deux fois le même sommet.');
    }
    assertValidRoomVertices(projectedVertices);
  }

  for (const wall of snapshot.walls) {
    assertWallRelations(wall);
    const start = verticesById.get(wall.startVertexId);
    const end = verticesById.get(wall.endVertexId);
    if (!start || !end || start.id === end.id) {
      throw invalidSnapshot('Chaque mur doit relier deux sommets distincts du niveau.');
    }
    if (wall.pieceIds.some((pieceId) => !piecesById.has(pieceId))) {
      throw invalidSnapshot('Une relation mur–pièce référence une pièce absente.');
    }

    const profiles = snapshot.profilesByWallId[wall.id];
    if (!profiles) throw invalidSnapshot('Chaque mur doit conserver les profils de ses deux faces.');
    const wallLengthCm = Math.hypot(end.x - start.x, end.y - start.y);
    assertValidWallHeightProfiles(wall, profiles, wallLengthCm);
  }

  for (const piece of snapshot.pieces) {
    piece.vertexIds.forEach((startVertexId, index) => {
      const endVertexId = piece.vertexIds[(index + 1) % piece.vertexIds.length];
      const matching = snapshot.walls.filter((wall) => (
        wall.pieceIds.includes(piece.room.id)
        && sameUndirectedSegment(wall.startVertexId, wall.endVertexId, startVertexId, endVertexId)
      ));
      if (matching.length !== 1) {
        throw invalidSnapshot('Chaque arête de pièce doit correspondre à un unique mur.');
      }
    });
  }

  for (const wall of snapshot.walls) {
    for (const pieceId of wall.pieceIds) {
      const piece = snapshot.pieces.find(({ room }) => room.id === pieceId);
      const matchesContour = piece?.vertexIds.some((startVertexId, index) => (
        sameUndirectedSegment(
          wall.startVertexId,
          wall.endVertexId,
          startVertexId,
          piece.vertexIds[(index + 1) % piece.vertexIds.length],
        )
      ));
      if (!matchesContour) {
        throw invalidSnapshot('Chaque relation mur–pièce doit correspondre à une arête réelle.');
      }
    }
  }

  for (const opening of snapshot.openings) {
    const wall = wallsById.get(opening.wallId);
    const template = snapshot.templatesById[opening.templateId];
    const profiles = snapshot.profilesByWallId[opening.wallId];
    if (!wall || !template || !profiles) {
      throw invalidSnapshot('Une ouverture référence un support ou un template absent.');
    }
    const start = verticesById.get(wall.startVertexId)!;
    const end = verticesById.get(wall.endVertexId)!;
    const [issue] = validateOpening(opening, {
      wall,
      profiles,
      wallLengthCm: Math.hypot(end.x - start.x, end.y - start.y),
      template,
      siblingOpenings: snapshot.openings,
    });
    if (issue) throw invalidSnapshot(issue.message);
  }
}

export function assertGeometryMutationAllowed(
  before: LevelGeometrySnapshot,
  after: LevelGeometrySnapshot,
): void {
  const afterVertices = new Map(after.vertices.map((vertex) => [vertex.id, vertex]));
  const explicitlyUnlockedVertices = new Set(after.unlockedVertexIds ?? []);
  for (const vertex of before.vertices) {
    if (!vertex.isLocked) continue;
    const next = afterVertices.get(vertex.id);
    const changed = !next
      || Math.abs(next.x - vertex.x) > EPSILON
      || Math.abs(next.y - vertex.y) > EPSILON;
    if (
      changed
      && next?.isLocked !== false
      && !explicitlyUnlockedVertices.has(vertex.id)
    ) {
      throw new GeometryMutationError(
        'locked_vertex',
        'Un sommet verrouillé ne peut pas être déplacé, remplacé ou supprimé.',
        vertex.id,
      );
    }
  }

  const afterProfilePoints = new Map(
    Object.values(after.profilesByWallId)
      .flatMap(({ gauche, droite }) => [...gauche, ...droite])
      .map((point) => [point.id, point]),
  );
  const explicitlyUnlockedProfilePoints = new Set(after.unlockedProfilePointIds ?? []);
  for (const point of Object.values(before.profilesByWallId)
    .flatMap(({ gauche, droite }) => [...gauche, ...droite])) {
    if (!point.isLocked) continue;
    const next = afterProfilePoints.get(point.id);
    const changed = !next
      || Math.abs(next.positionCm - point.positionCm) > EPSILON
      || Math.abs(next.heightCm - point.heightCm) > EPSILON;
    if (
      changed
      && next?.isLocked !== false
      && !explicitlyUnlockedProfilePoints.has(point.id)
    ) {
      throw new GeometryMutationError(
        'locked_profile_point',
        'Un point de profil verrouillé ne peut pas être déplacé, remplacé ou supprimé.',
        point.id,
      );
    }
  }
}

export function computedWallLocked(
  wall: TopologyWall,
  verticesById: ReadonlyMap<string, GeometryVertex>,
): boolean {
  return isWallLocked(wall, verticesById);
}

function uniqueMap<T extends { id: string }>(values: readonly T[], label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    if (result.has(value.id)) throw invalidSnapshot(`Chaque ${label} doit avoir un identifiant unique.`);
    result.set(value.id, value);
  }
  return result;
}

function sameUndirectedSegment(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  return (leftStart === rightStart && leftEnd === rightEnd)
    || (leftStart === rightEnd && leftEnd === rightStart);
}

function invalidSnapshot(message: string): GeometryMutationError {
  return new GeometryMutationError('invalid_snapshot', message);
}
