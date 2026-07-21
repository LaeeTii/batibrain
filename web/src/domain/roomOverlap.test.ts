import { describe, expect, it } from 'vitest';
import { createRectangleRoomGeometry, insertVertexBetween, syncWallsWithVertices } from './geometry';
import { validateRoomPolygon } from './globalGeometry';
import { assertLockedGeometryPreserved, deleteRoomVertex, linkCoincidentWalls, linkedVertexIds, moveLinkedVertex, moveRoomWithLinkedVertices, normalizeCreatedRoomOverlaps, reconcilePersistedRoomIds, uniqueLevelWalls } from './roomOverlap';
import type { RoomSnapshot } from '../services/rooms';
import { createUniformWallHeightProfiles, validateWallHeightProfiles } from './wallHeightProfile';

function room(id: string, x: number, y: number, width: number, height: number): RoomSnapshot {
  const geometry = createRectangleRoomGeometry(id, width, height, { originX: x, originY: y, wallThicknessCm: 10, wallHeightCm: 250 });
  return { room: { id, levelId: 'niveau', name: id, type: 'autre', floorColor: '#E5FFFC' }, ...geometry, openings: [] };
}

describe('normalisation des chevauchements de pièces', () => {
  it('supprime un sommet et relie le mur entrant à ses deux voisins', () => {
    const source = room('A', 0, 0, 100, 100);
    const left = source.vertices[0];
    const right = source.vertices[1];
    const inserted = insertVertexBetween(source.vertices, left.id, right.id, {
      id: 'sommet-à-supprimer',
      pieceId: source.room.id,
      x: 50,
      y: 0,
    })!;
    source.vertices = inserted;
    source.walls = syncWallsWithVertices(inserted, source.walls);
    const incomingWall = source.walls.find(({ endVertexId }) => endVertexId === 'sommet-à-supprimer')!;

    const [result] = deleteRoomVertex([source], source.room.id, 'sommet-à-supprimer');

    expect(result.vertices).toHaveLength(4);
    expect(result.vertices.map(({ order }) => order)).toEqual([0, 1, 2, 3]);
    expect(result.walls).toHaveLength(4);
    expect(result.walls).toContainEqual(expect.objectContaining({
      id: incomingWall.id,
      startVertexId: left.id,
      endVertexId: right.id,
      pieceIds: [source.room.id],
    }));
  });

  it('refuse de supprimer un sommet verrouillé ou le sommet d’un triangle', () => {
    const rectangle = room('A', 0, 0, 100, 100);
    rectangle.vertices[0] = { ...rectangle.vertices[0], isLocked: true };
    expect(() => deleteRoomVertex([rectangle], rectangle.room.id, rectangle.vertices[0].id))
      .toThrow('verrouillé');

    const triangle = room('B', 0, 0, 100, 100);
    triangle.vertices = triangle.vertices.slice(0, 3).map((vertex, order) => ({ ...vertex, order }));
    triangle.walls = syncWallsWithVertices(triangle.vertices, triangle.walls);
    expect(() => deleteRoomVertex([triangle], triangle.room.id, triangle.vertices[0].id))
      .toThrow('au moins trois sommets');
  });

  it('conserve le sommet et le mur mitoyen dans la pièce voisine', () => {
    const [left, right] = linkCoincidentWalls([
      room('A', 0, 0, 100, 100),
      room('B', 100, 0, 100, 100),
    ]);
    const sharedVertex = left.vertices.find(({ x, y }) => x === 100 && y === 0)!;
    const sharedWall = left.walls.find((wall) => right.walls.some(({ id }) => id === wall.id))!;

    const result = deleteRoomVertex([left, right], left.room.id, sharedVertex.id);
    const nextLeft = result.find(({ room: value }) => value.id === left.room.id)!;
    const nextRight = result.find(({ room: value }) => value.id === right.room.id)!;

    expect(nextLeft.vertices.some(({ id }) => id === sharedVertex.id)).toBe(false);
    expect(nextRight.vertices.some(({ id }) => id === sharedVertex.id)).toBe(true);
    expect(nextRight.walls.find(({ id }) => id === sharedWall.id)?.pieceIds).toEqual([right.room.id]);
  });

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
      expect(linkedVertexIds(result.snapshots, zoneA.room.id, intersection.id))
        .toEqual(new Set([intersection.id]));
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
    expect(linkedVertexIds([left, right], left.room.id, sourceVertex.id))
      .toEqual(new Set([sourceVertex.id]));
    const moved = moveLinkedVertex([left, right], left.room.id, sourceVertex.id, { x: 120, y: 10 });
    expect(moved.flatMap(({ vertices }) => vertices).filter(({ x, y }) => x === 120 && y === 10)).toHaveLength(2);
  });

  it('fusionne deux sommets consécutifs sans conserver de doublon dans le contour', () => {
    const current = room('A', 0, 0, 100, 100);
    current.walls = current.walls.map((wall) => ({
      ...wall,
      heightProfilesLinked: true,
      heightProfiles: createUniformWallHeightProfiles(wall.id, 100, 250),
    }));
    const sorted = [...current.vertices].sort((left, right) => left.order - right.order);
    const source = sorted[0];
    const target = sorted[1];

    const [merged] = moveLinkedVertex([current], current.room.id, source.id, target);

    expect(merged.vertices).toHaveLength(3);
    expect(merged.vertices.map(({ id }) => id)).not.toContain(source.id);
    expect(merged.vertices.map(({ id }) => id)).toContain(target.id);
    expect(new Set(merged.vertices.map(({ id }) => id)).size).toBe(3);
    expect(merged.walls).toHaveLength(3);
    expect(merged.walls.some((wall) => wall.startVertexId === wall.endVertexId)).toBe(false);
    expect(validateRoomPolygon(merged.vertices)).toBeNull();
    const verticesById = new Map(merged.vertices.map((vertex) => [vertex.id, vertex]));
    merged.walls.forEach((wall) => {
      const start = verticesById.get(wall.startVertexId)!;
      const end = verticesById.get(wall.endVertexId)!;
      expect(validateWallHeightProfiles(
        { id: wall.id, heightProfilesLinked: wall.heightProfilesLinked ?? true },
        wall.heightProfiles!,
        Math.hypot(end.x - start.x, end.y - start.y),
      )).toEqual([]);
    });
  });

  it('autorise le déplacement d’un sommet libre voisin d’une pièce verrouillée', () => {
    const linked = linkCoincidentWalls([
      room('A', 0, 0, 100, 100),
      room('B', 100, 0, 100, 100),
    ]);
    const lockedIds = new Set(linked[0].vertices.map(({ id }) => id));
    const before = linked.map((snapshot) => ({
      ...snapshot,
      vertices: snapshot.vertices.map((vertex) => ({
        ...vertex,
        isLocked: lockedIds.has(vertex.id),
      })),
    }));
    const freeVertex = before[1].vertices.find(({ x, y }) => x === 200 && y === 0)!;
    const moved = linkCoincidentWalls(moveLinkedVertex(
      before,
      before[1].room.id,
      freeVertex.id,
      { x: 220, y: 0 },
    ));

    expect(() => assertLockedGeometryPreserved(before, moved)).not.toThrow();

    const lockedVertex = before[0].vertices[0];
    const invalid = moved.map((snapshot) => ({
      ...snapshot,
      vertices: snapshot.vertices.map((vertex) => vertex.id === lockedVertex.id
        ? { ...vertex, x: vertex.x + 10 }
        : vertex),
    }));
    expect(() => assertLockedGeometryPreserved(before, invalid)).toThrow(/sommet verrouillé/);
  });

  it('recale les profils des murs dont la longueur change avec un sommet', () => {
    const current = room('A', 0, 0, 100, 100);
    current.walls = current.walls.map((wall) => ({
      ...wall,
      heightProfilesLinked: true,
      heightProfiles: createUniformWallHeightProfiles(wall.id, 100, 250),
    }));
    const vertex = current.vertices.find(({ x, y }) => x === 100 && y === 0)!;

    const [moved] = moveLinkedVertex([current], current.room.id, vertex.id, { x: 120, y: 10 });
    const vertices = new Map(moved.vertices.map((point) => [point.id, point]));

    moved.walls.forEach((wall) => {
      const start = vertices.get(wall.startVertexId)!;
      const end = vertices.get(wall.endVertexId)!;
      const lengthCm = Math.hypot(end.x - start.x, end.y - start.y);
      expect(validateWallHeightProfiles(
        { id: wall.id, heightProfilesLinked: wall.heightProfilesLinked ?? true },
        wall.heightProfiles!,
        lengthCm,
      )).toEqual([]);
    });
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

  it('synchronise les profils physiques des deux projections d’un mur mitoyen', () => {
    const [left, right] = linkCoincidentWalls([
      room('A', 0, 0, 100, 100),
      room('B', 100, 0, 100, 100),
    ]);
    const leftWall = left.walls.find((wall) => right.walls.some(({ id }) => id === wall.id))!;
    const rightWall = right.walls.find(({ id }) => id === leftWall.id)!;
    leftWall.heightProfilesLinked = false;
    leftWall.heightProfiles = {
      wallId: leftWall.id,
      gauche: [
        { id: 'gauche-0', wallId: leftWall.id, faceSide: 'gauche', order: 0, positionCm: 0, heightCm: 210 },
        { id: 'gauche-1', wallId: leftWall.id, faceSide: 'gauche', order: 1, positionCm: 100, heightCm: 230 },
      ],
      droite: [
        { id: 'droite-0', wallId: leftWall.id, faceSide: 'droite', order: 0, positionCm: 0, heightCm: 310 },
        { id: 'droite-1', wallId: leftWall.id, faceSide: 'droite', order: 1, positionCm: 100, heightCm: 340 },
      ],
    };
    rightWall.heightProfiles = createUniformWallHeightProfiles(rightWall.id, 100, 999);

    const [synchronizedLeft, synchronizedRight] = linkCoincidentWalls([left, right]);
    const leftProjection = synchronizedLeft.walls.find(({ id }) => id === leftWall.id)!;
    const rightProjection = synchronizedRight.walls.find(({ id }) => id === leftWall.id)!;

    expect(leftProjection.heightProfiles?.gauche.map(({ positionCm, heightCm }) => [positionCm, heightCm])).toEqual([
      [0, 210], [100, 230],
    ]);
    expect(rightProjection.heightProfiles?.gauche.map(({ positionCm, heightCm }) => [positionCm, heightCm])).toEqual([
      [0, 340], [100, 310],
    ]);
    expect(rightProjection.heightProfiles?.droite.map(({ positionCm, heightCm }) => [positionCm, heightCm])).toEqual([
      [0, 230], [100, 210],
    ]);
    expect(rightProjection.heightProfilesLinked).toBe(false);
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

  it('conserve les identifiants réutilisés après un remplacement topologique', () => {
    expect(reconcilePersistedRoomIds(new Set(['A', 'B']), ['A', 'B'], ['A', 'B', 'C']))
      .toEqual(new Set(['A', 'B', 'C']));
  });

  it('préserve une ouverture et les points de profil lors d’une découpe compatible', () => {
    const existing = room('A', 0, 0, 100, 100);
    const support = existing.walls[1];
    const profiles = createUniformWallHeightProfiles(support.id, 100, 250);
    profiles.gauche.splice(1, 0, {
      id: 'profil-intermédiaire-gauche',
      wallId: support.id,
      faceSide: 'gauche',
      order: 1,
      positionCm: 25,
      heightCm: 300,
      isLocked: false,
    });
    profiles.gauche[2].order = 2;
    profiles.droite.splice(1, 0, {
      id: 'profil-intermédiaire-droite',
      wallId: support.id,
      faceSide: 'droite',
      order: 1,
      positionCm: 25,
      heightCm: 300,
      isLocked: false,
    });
    profiles.droite[2].order = 2;
    existing.walls[1] = { ...support, heightProfiles: profiles, heightProfilesLinked: true };
    existing.openings = [{
      id: 'ouverture-1',
      wallId: support.id,
      type: 'door',
      offsetCm: 10,
      widthCm: 20,
      bottomCm: 0,
      heightCm: 200,
      orientation: 'normal',
      hingeSide: 'left',
    }];

    const result = normalizeCreatedRoomOverlaps(
      room('B', 50, 50, 100, 100),
      [existing],
    );
    const openingOwner = result.snapshots.find(({ openings }) => (
      openings.some(({ id }) => id === 'ouverture-1')
    ));
    const targetWallId = openingOwner?.openings.find(({ id }) => id === 'ouverture-1')?.wallId;
    const targetWall = openingOwner?.walls.find(({ id }) => id === targetWallId);

    expect(targetWall?.heightProfiles?.gauche.map(({ positionCm, heightCm }) => (
      [positionCm, heightCm]
    ))).toContainEqual([25, 300]);
  });
});
