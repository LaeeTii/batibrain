import { describe, expect, it } from 'vitest';
import { createRectangleRoomGeometry } from './geometry';
import { linkCoincidentWalls, linkedVertexIds, moveLinkedVertex, moveRoomWithLinkedVertices, normalizeCreatedRoomOverlaps, uniqueLevelWalls } from './roomOverlap';
import type { RoomSnapshot } from '../services/rooms';

function room(id: string, x: number, y: number, width: number, height: number): RoomSnapshot {
  const geometry = createRectangleRoomGeometry(id, width, height, { originX: x, originY: y, wallThicknessCm: 10, wallHeightCm: 250 });
  return { room: { id, levelId: 'niveau', name: id, type: 'autre', floorColor: '#E5FFFC' }, ...geometry, openings: [] };
}

describe('normalisation des chevauchements de pièces', () => {
  it('crée une pièce distincte pour la zone commune', () => {
    const result = normalizeCreatedRoomOverlaps(room('B', 50, 50, 100, 100), [room('A', 0, 0, 100, 100)]);
    expect(result.overlapCount).toBe(1);
    expect(result.snapshots.find(({ room: value }) => value.name === 'Zone de chevauchement')?.vertices).toHaveLength(4);
    expect(result.replacedRoomIds).toEqual(['A']);
    const wallIds = result.snapshots.flatMap(({ walls }) => walls.map(({ id }) => id));
    expect(new Set(wallIds).size).toBeLessThan(wallIds.length);
    expect(Math.max(...[...new Set(wallIds)].map((id) => wallIds.filter((wallId) => wallId === id).length))).toBe(2);
  });

  it('conserve une jonction commune aux trois pièces sur chaque point de croisement', () => {
    const result = normalizeCreatedRoomOverlaps(room('B', 50, 50, 100, 100), [room('A', 0, 0, 100, 100)]);
    const zoneA = result.snapshots.find(({ room: value }) => value.id === 'A')!;
    const intersections = [
      zoneA.vertices.find(({ x, y }) => x === 100 && y === 50)!,
      zoneA.vertices.find(({ x, y }) => x === 50 && y === 100)!,
    ];

    intersections.forEach((intersection) => {
      expect(linkedVertexIds(result.snapshots, zoneA.room.id, intersection.id).size).toBe(3);
    });

    const moved = moveLinkedVertex(result.snapshots, zoneA.room.id, intersections[0].id, { x: 110, y: 60 });
    expect(moved.flatMap(({ vertices }) => vertices).filter(({ x, y }) => x === 110 && y === 60)).toHaveLength(3);
  });

  it('décompose le contour restant lorsqu’une pièce est entièrement incluse', () => {
    const result = normalizeCreatedRoomOverlaps(room('B', 40, 40, 20, 20), [room('A', 0, 0, 100, 100)]);
    expect(result.overlapCount).toBe(1);
    expect(result.snapshots.filter(({ room: value }) => value.name.startsWith('A')).length).toBe(2);
  });

  it('laisse une création sans chevauchement inchangée', () => {
    const created = room('B', 200, 200, 50, 50);
    expect(normalizeCreatedRoomOverlaps(created, [room('A', 0, 0, 100, 100)])).toEqual({ snapshots: [created], replacedRoomIds: [], overlapCount: 0 });
  });

  it('conserve l’identifiant d’une pièce déplacée dans sa portion restante', () => {
    const moved = room('B', 50, 50, 100, 100);
    const result = normalizeCreatedRoomOverlaps(moved, [room('A', 0, 0, 100, 100)]);
    expect(result.snapshots.some(({ room: value }) => value.id === moved.room.id)).toBe(true);
    expect(result.snapshots.some(({ room: value }) => value.name === 'Zone de chevauchement')).toBe(true);
  });

  it('déplace les deux sommets portés par un mur mitoyen unique', () => {
    const [left, right] = linkCoincidentWalls([room('A', 0, 0, 100, 100), room('B', 100, 0, 100, 100)]);
    const sourceVertex = left.vertices.find(({ x, y }) => x === 100 && y === 0)!;
    expect(linkedVertexIds([left, right], left.room.id, sourceVertex.id).size).toBe(2);
    const moved = moveLinkedVertex([left, right], left.room.id, sourceVertex.id, { x: 120, y: 10 });
    expect(moved.flatMap(({ vertices }) => vertices).filter(({ x, y }) => x === 120 && y === 10)).toHaveLength(2);
  });

  it('déforme la pièce voisine lorsqu’une pièce liée par un mur mitoyen est déplacée', () => {
    const [left, right] = linkCoincidentWalls([room('A', 0, 0, 100, 100), room('B', 100, 0, 100, 100)]);
    const moved = moveRoomWithLinkedVertices([left, right], left.room.id, { x: 20, y: 0 });
    expect(moved.find(({ room: value }) => value.id === right.room.id)?.vertices.filter(({ x }) => x === 120)).toHaveLength(2);
  });

  it('ne compte le mur mitoyen qu’une seule fois au niveau', () => {
    const snapshots = linkCoincidentWalls([room('A', 0, 0, 100, 100), room('B', 100, 0, 100, 100)]);
    expect(snapshots.flatMap(({ walls }) => walls)).toHaveLength(8);
    expect(uniqueLevelWalls(snapshots)).toHaveLength(7);
  });

  it('désolidarise un ancien identifiant partagé lorsque les segments divergent', () => {
    const [left, right] = linkCoincidentWalls([room('A', 0, 0, 100, 100), room('B', 100, 0, 100, 100)]);
    const sharedId = left.walls.find((wall) => right.walls.some(({ id }) => id === wall.id))!.id;
    const movedRight = { ...right, vertices: right.vertices.map((vertex) => ({ ...vertex, x: vertex.x + 20 })) };
    const [nextLeft, nextRight] = linkCoincidentWalls([left, movedRight]);
    expect(nextLeft.walls.some(({ id }) => id === sharedId)).toBe(true);
    expect(nextRight.walls.some(({ id }) => id === sharedId)).toBe(false);
  });

  it('utilise la précision au centième de la base pour reconnaître une mitoyenneté', () => {
    const snapshots = linkCoincidentWalls([room('A', 0, 0, 100, 100), room('B', 100.004, 0, 100, 100)]);
    expect(uniqueLevelWalls(snapshots)).toHaveLength(7);
  });
});
