import { describe, expect, it } from 'vitest';
import type { Vertex } from './types';
import {
  DEFAULT_ROOM_FLOOR_COLOR,
  DEFAULT_ROOM_NAME,
  DEFAULT_ROOM_SIDE_CM,
  RoomValidationError,
  assertValidRoomVertices,
  createDefaultRoom,
  roomPolygon,
  validateRoomVertices,
} from './room';

function vertices(points: Array<[number, number]>, orders?: number[]): Vertex[] {
  return points.map(([x, y], index) => ({
    id: `sommet-${index}`,
    pieceId: 'pièce-1',
    order: orders?.[index] ?? index,
    x,
    y,
  }));
}

describe('création d’une pièce', () => {
  it('crée le rectangle initial 200 × 200 cm avec les valeurs métier par défaut', () => {
    const result = createDefaultRoom({ id: 'pièce-1', levelId: 'niveau-1', name: '  ' });

    expect(result.room).toMatchObject({
      id: 'pièce-1',
      levelId: 'niveau-1',
      name: DEFAULT_ROOM_NAME,
      type: 'autre',
      floorColor: DEFAULT_ROOM_FLOOR_COLOR,
    });
    expect(result.vertices).toHaveLength(4);
    expect(result.vertices.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [DEFAULT_ROOM_SIDE_CM, 0],
      [DEFAULT_ROOM_SIDE_CM, DEFAULT_ROOM_SIDE_CM],
      [0, DEFAULT_ROOM_SIDE_CM],
    ]);
  });

  it('représente la fermeture implicitement sans dupliquer le premier sommet', () => {
    const { vertices: roomVertices } = createDefaultRoom({ id: 'pièce-1', levelId: 'niveau-1' });
    const polygon = roomPolygon(roomVertices);

    expect(polygon.vertices).toHaveLength(4);
    expect(polygon.vertices.at(-1)).not.toEqual(polygon.vertices[0]);
  });

  it('accepte le type, la couleur et une origine globale personnalisés', () => {
    const result = createDefaultRoom({
      id: 'pièce-1',
      levelId: 'niveau-1',
      type: 'cuisine',
      floorColor: '#123456',
      origin: { x: -300, y: 50 },
    });

    expect(result.room.type).toBe('cuisine');
    expect(result.room.floorColor).toBe('#123456');
    expect(result.vertices[0]).toMatchObject({ x: -300, y: 50 });
  });
});

describe('validation des sommets d’une pièce', () => {
  it('refuse une pièce de moins de trois sommets', () => {
    expect(validateRoomVertices(vertices([[0, 0], [10, 0]]))[0]?.code).toBe('too_few_vertices');
  });

  it('refuse les coordonnées non finies', () => {
    const issues = validateRoomVertices(vertices([[0, 0], [Number.NaN, 0], [0, 10]]));
    expect(issues[0]).toMatchObject({ code: 'invalid_coordinate', vertexIds: ['sommet-1'] });
  });

  it('refuse un ordre non continu ou dupliqué', () => {
    const issues = validateRoomVertices(vertices([[0, 0], [10, 0], [0, 10]], [0, 2, 2]));
    expect(issues[0]?.code).toBe('invalid_vertex_order');
  });

  it('refuse un contour auto-intersecté avec une erreur exploitable', () => {
    const bowTie = vertices([[0, 0], [10, 10], [0, 10], [10, 0]]);
    const issue = validateRoomVertices(bowTie)[0];

    expect(issue).toMatchObject({
      code: 'self_intersection',
      vertexIds: ['sommet-0', 'sommet-1', 'sommet-2', 'sommet-3'],
    });
    expect(() => assertValidRoomVertices(bowTie)).toThrow(RoomValidationError);

    try {
      assertValidRoomVertices(bowTie);
    } catch (error) {
      expect(error).toBeInstanceOf(RoomValidationError);
      expect((error as RoomValidationError).issue.code).toBe('self_intersection');
    }
  });

  it('accepte un contour concave simple avec des coordonnées négatives', () => {
    const concave = vertices([[-20, -20], [20, -20], [20, 0], [0, 0], [0, 20], [-20, 20]]);
    expect(validateRoomVertices(concave)).toEqual([]);
  });
});
