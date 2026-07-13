import type { Point, Polygon, Room, RoomType, Vertex } from './types';

export const DEFAULT_ROOM_SIDE_CM = 200;
export const DEFAULT_ROOM_NAME = 'Nouvelle pièce';
export const DEFAULT_ROOM_TYPE: RoomType = 'autre';
export const DEFAULT_ROOM_FLOOR_COLOR = '#E5FFFC';

export const ROOM_TYPES = [
  'cuisine',
  'chambre',
  'salon',
  'salle_de_bain',
  'toilettes',
  'bureau',
  'garage',
  'hall',
  'salle_de_jeu',
  'bibliotheque',
  'autre',
] as const satisfies readonly RoomType[];

export type RoomValidationCode =
  | 'too_few_vertices'
  | 'invalid_coordinate'
  | 'invalid_vertex_order'
  | 'self_intersection';

export type RoomValidationIssue = {
  code: RoomValidationCode;
  message: string;
  vertexIds: string[];
};

export class RoomValidationError extends Error {
  readonly issue: RoomValidationIssue;

  constructor(issue: RoomValidationIssue) {
    super(issue.message);
    this.name = 'RoomValidationError';
    this.issue = issue;
  }
}

export interface CreateDefaultRoomInput {
  id?: string;
  levelId: string;
  name?: string;
  type?: RoomType;
  floorColor?: string;
  origin?: Point;
}

export function createDefaultRoom(input: CreateDefaultRoomInput): {
  room: Room;
  vertices: Vertex[];
} {
  const roomId = input.id ?? globalThis.crypto.randomUUID();
  const origin = input.origin ?? { x: 0, y: 0 };
  const name = input.name?.trim() || DEFAULT_ROOM_NAME;

  const room: Room = {
    id: roomId,
    levelId: input.levelId,
    name,
    type: input.type ?? DEFAULT_ROOM_TYPE,
    floorColor: input.floorColor?.trim() || DEFAULT_ROOM_FLOOR_COLOR,
    notes: null,
  };

  const coordinates: Point[] = [
    origin,
    { x: origin.x + DEFAULT_ROOM_SIDE_CM, y: origin.y },
    { x: origin.x + DEFAULT_ROOM_SIDE_CM, y: origin.y + DEFAULT_ROOM_SIDE_CM },
    { x: origin.x, y: origin.y + DEFAULT_ROOM_SIDE_CM },
  ];
  const vertices = coordinates.map((point, order): Vertex => ({
    id: globalThis.crypto.randomUUID(),
    pieceId: roomId,
    order,
    ...point,
  }));

  return { room, vertices };
}

export function roomPolygon(vertices: readonly Vertex[]): Polygon {
  return {
    vertices: [...vertices]
      .sort((left, right) => left.order - right.order)
      .map(({ x, y }) => ({ x, y })),
  };
}

export function validateRoomVertices(vertices: readonly Vertex[]): RoomValidationIssue[] {
  if (vertices.length < 3) {
    return [{
      code: 'too_few_vertices',
      message: 'Une pièce doit contenir au moins trois sommets.',
      vertexIds: vertices.map(({ id }) => id),
    }];
  }

  const invalidCoordinates = vertices.filter(
    ({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y),
  );
  if (invalidCoordinates.length > 0) {
    return [{
      code: 'invalid_coordinate',
      message: 'Chaque coordonnée de sommet doit être un nombre fini.',
      vertexIds: invalidCoordinates.map(({ id }) => id),
    }];
  }

  const sorted = [...vertices].sort((left, right) => left.order - right.order);
  const hasInvalidOrder = sorted.some((vertex, index) => vertex.order !== index);
  if (hasInvalidOrder) {
    return [{
      code: 'invalid_vertex_order',
      message: 'Les sommets doivent avoir un ordre unique et continu à partir de zéro.',
      vertexIds: sorted.map(({ id }) => id),
    }];
  }

  for (let firstIndex = 0; firstIndex < sorted.length; firstIndex += 1) {
    const firstEndIndex = (firstIndex + 1) % sorted.length;
    for (let secondIndex = firstIndex + 1; secondIndex < sorted.length; secondIndex += 1) {
      const secondEndIndex = (secondIndex + 1) % sorted.length;
      const areAdjacent = firstIndex === secondEndIndex || firstEndIndex === secondIndex;

      if (!areAdjacent && segmentsIntersect(
        sorted[firstIndex],
        sorted[firstEndIndex],
        sorted[secondIndex],
        sorted[secondEndIndex],
      )) {
        return [{
          code: 'self_intersection',
          message: 'Le contour d’une pièce ne doit pas s’auto-intersecter.',
          vertexIds: [
            sorted[firstIndex].id,
            sorted[firstEndIndex].id,
            sorted[secondIndex].id,
            sorted[secondEndIndex].id,
          ],
        }];
      }
    }
  }

  return [];
}

export function assertValidRoomVertices(vertices: readonly Vertex[]): void {
  const [firstIssue] = validateRoomVertices(vertices);
  if (firstIssue) throw new RoomValidationError(firstIssue);
}

function segmentsIntersect(firstStart: Point, firstEnd: Point, secondStart: Point, secondEnd: Point) {
  const firstOrientation = crossProduct(firstStart, firstEnd, secondStart);
  const secondOrientation = crossProduct(firstStart, firstEnd, secondEnd);
  const thirdOrientation = crossProduct(secondStart, secondEnd, firstStart);
  const fourthOrientation = crossProduct(secondStart, secondEnd, firstEnd);

  if (
    Math.sign(firstOrientation) !== Math.sign(secondOrientation)
    && Math.sign(thirdOrientation) !== Math.sign(fourthOrientation)
  ) {
    return true;
  }

  return (firstOrientation === 0 && isPointOnSegment(secondStart, firstStart, firstEnd))
    || (secondOrientation === 0 && isPointOnSegment(secondEnd, firstStart, firstEnd))
    || (thirdOrientation === 0 && isPointOnSegment(firstStart, secondStart, secondEnd))
    || (fourthOrientation === 0 && isPointOnSegment(firstEnd, secondStart, secondEnd));
}

function crossProduct(start: Point, end: Point, point: Point): number {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

function isPointOnSegment(point: Point, start: Point, end: Point): boolean {
  return point.x >= Math.min(start.x, end.x)
    && point.x <= Math.max(start.x, end.x)
    && point.y >= Math.min(start.y, end.y)
    && point.y <= Math.max(start.y, end.y);
}
