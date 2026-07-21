import { describe, expect, it } from 'vitest';
import { createRectangleRoomGeometry } from './geometry';
import { detachWallEndpoint, moveDetachedVertex, reconnectDetachedVertex, splitWallInRooms } from './editorWallActions';
import type { RoomGeometrySnapshot } from './roomOverlap';
import { assertLevelGeometrySnapshot, type LevelGeometrySnapshot } from './levelGeometry';
import { createStableWallFaces } from './wall';
import { createUniformWallHeightProfiles } from './wallHeightProfile';

function snapshot(): RoomGeometrySnapshot {
  const geometry = createRectangleRoomGeometry('pièce', 400, 300, { wallThicknessCm: 10, wallHeightCm: 250 });
  return {
    room: { id: 'pièce', levelId: 'niveau', name: 'Pièce', type: 'autre', floorColor: '#E5FFFC' },
    vertices: geometry.vertices,
    walls: geometry.walls,
    openings: [],
  };
}

describe('actions d’édition d’un mur', () => {
  it('coupe un mur au point projeté et conserve le premier segment sélectionné', () => {
    const before = snapshot();
    const wall = before.walls[0];
    const [after] = splitWallInRooms([before], wall.id, { x: 150, y: 12 });

    expect(after.vertices).toHaveLength(5);
    expect(after.walls).toHaveLength(5);
    expect(after.walls.find(({ id }) => id === wall.id)?.endVertexId).not.toBe(wall.endVertexId);
    expect(after.walls.filter(({ startVertexId, endVertexId }) => startVertexId === after.vertices[1].id || endVertexId === after.vertices[1].id)).toHaveLength(2);
  });

  it('refuse une coupe qui traverse une ouverture', () => {
    const before = snapshot();
    const wall = before.walls[0];
    before.openings = [{ id: 'ouverture', wallId: wall.id, type: 'door', offsetCm: 100, widthCm: 100, bottomCm: 0, heightCm: 210, orientation: 'normal', hingeSide: 'left' }];

    expect(() => splitWallInRooms([before], wall.id, { x: 150, y: 0 })).toThrow(/traverse une ouverture/);
  });

  it('refuse la coupe d’un mur dont une extrémité est verrouillée', () => {
    const before = snapshot();
    before.vertices[0].isLocked = true;
    expect(() => splitWallInRooms([before], before.walls[0].id, { x: 150, y: 0 })).toThrow(/verrouillé/);
  });

  it('ouvre le contour, supprime la pièce et conserve ses murs autonomes', () => {
    const before = snapshot();
    const canonicalWalls = before.walls.map((wall) => ({
      id: wall.id,
      startVertexId: wall.startVertexId,
      endVertexId: wall.endVertexId,
      faces: createStableWallFaces(),
      pieceIds: [before.room.id],
      thicknessCm: wall.thicknessCm ?? 10,
      material: null,
      insulation: null,
      notes: null,
      heightProfilesLinked: true,
    }));
    const canonical: LevelGeometrySnapshot = {
      levelId: 'niveau', revision: 1,
      vertices: before.vertices.map((vertex) => ({ id: vertex.id, levelId: 'niveau', x: vertex.x, y: vertex.y, isLocked: false })),
      pieces: [{ room: before.room, vertexIds: before.vertices.map(({ id }) => id) }],
      walls: canonicalWalls,
      profilesByWallId: Object.fromEntries(canonicalWalls.map((wall) => {
        const start = before.vertices.find(({ id }) => id === wall.startVertexId)!;
        const end = before.vertices.find(({ id }) => id === wall.endVertexId)!;
        return [wall.id, createUniformWallHeightProfiles(wall.id, Math.hypot(end.x - start.x, end.y - start.y), 250)];
      })),
      openings: [], templatesById: {},
    };
    const selected = canonicalWalls[0];
    const result = detachWallEndpoint(canonical, [before], selected.id, selected.endVertexId, { x: 400, y: -100 });

    expect(result.rooms).toHaveLength(0);
    expect(result.canonical.pieces).toHaveLength(0);
    expect(result.canonical.walls).toHaveLength(4);
    expect(result.canonical.walls.every(({ pieceIds }) => pieceIds.length === 0)).toBe(true);
    const detached = result.canonical.walls.find(({ id }) => id === selected.id)!;
    expect(detached.startVertexId).toBe(selected.startVertexId);
    expect(detached.endVertexId).not.toBe(selected.endVertexId);
    expect(result.canonical.vertices.find(({ id }) => id === detached.endVertexId)).toMatchObject({ x: 400, y: -100 });

    const sharedVertexId = selected.startVertexId;
    const moved = moveDetachedVertex(result.canonical, sharedVertexId, { x: -50, y: 25 });
    expect(moved.vertices.find(({ id }) => id === sharedVertexId)).toMatchObject({ x: -50, y: 25 });
    expect(moved.walls.filter(({ startVertexId, endVertexId }) => startVertexId === sharedVertexId || endVertexId === sharedVertexId)).toHaveLength(2);

    const reconnected = reconnectDetachedVertex(result.canonical, detached.endVertexId, selected.endVertexId);
    expect(reconnected.createdPieceIds).toHaveLength(1);
    expect(reconnected.canonical.pieces).toHaveLength(1);
    expect(reconnected.canonical.pieces[0].vertexIds).toHaveLength(4);
    expect(reconnected.canonical.walls.every(({ pieceIds }) => pieceIds[0] === reconnected.createdPieceIds[0])).toBe(true);
    expect(reconnected.canonical.vertices.some(({ id }) => id === detached.endVertexId)).toBe(false);
    expect(() => assertLevelGeometrySnapshot(reconnected.canonical)).not.toThrow();
  });
});
