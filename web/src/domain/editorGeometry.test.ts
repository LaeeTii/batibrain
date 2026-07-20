import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from '../services/rooms';
import {
  findWallEditorContext,
  replaceWallAcrossLevel,
  replaceWallAndSyncConnectedEndpoints,
  setSharedVertexLock,
} from './editorGeometry';
import type { WallHeightProfiles } from './types';

function rooms(): RoomSnapshot[] {
  const profiles: WallHeightProfiles = {
    wallId: 'wall',
    gauche: [
      { id: 'g0', wallId: 'wall', faceSide: 'gauche', order: 0, positionCm: 0, heightCm: 250 },
      { id: 'g1', wallId: 'wall', faceSide: 'gauche', order: 1, positionCm: 400, heightCm: 250 },
    ],
    droite: [
      { id: 'd0', wallId: 'wall', faceSide: 'droite', order: 0, positionCm: 0, heightCm: 250 },
      { id: 'd1', wallId: 'wall', faceSide: 'droite', order: 1, positionCm: 400, heightCm: 250 },
    ],
  };
  return ['a', 'b'].map((roomId, index) => ({
    room: { id: roomId, levelId: 'level', name: roomId, type: 'autre', floorColor: '#fff' },
    vertices: [
      { id: index ? 'v2' : 'v1', pieceId: roomId, order: 0, x: index ? 400 : 0, y: 0 },
      { id: index ? 'v1' : 'v2', pieceId: roomId, order: 1, x: index ? 0 : 400, y: 0 },
      { id: `${roomId}-3`, pieceId: roomId, order: 2, x: 0, y: 300 },
    ],
    walls: [{
      id: 'wall', pieceId: roomId,
      startVertexId: index ? 'v2' : 'v1', endVertexId: index ? 'v1' : 'v2',
      pieceIds: ['a', 'b'], thicknessCm: 10, heightProfilesLinked: true,
      heightProfiles: profiles,
    }],
    openings: [],
  }));
}

describe('géométrie partagée des éditeurs', () => {
  it('retrouve la projection orientée vers la pièce d’origine', () => {
    expect(findWallEditorContext(rooms(), 'wall', 'b')?.ownerRoomId).toBe('b');
  });

  it('répercute un mur modifié dans les projections des deux pièces', () => {
    const source = rooms();
    const wall = { ...source[0].walls[0], material: 'Brique' };
    const updated = replaceWallAcrossLevel(source, wall, wall.heightProfiles!, []);
    expect(updated[0].walls[0].material).toBe('Brique');
    expect(updated[1].walls[0].material).toBe('Brique');
    expect(updated[1].walls[0].startVertexId).toBe('v2');
  });

  it('répercute chaque face physique du profil dans la projection mitoyenne opposée', () => {
    const source = rooms();
    const wall = { ...source[0].walls[0], heightProfilesLinked: false };
    const profiles: WallHeightProfiles = {
      wallId: wall.id,
      gauche: [
        { id: 'g0', wallId: wall.id, faceSide: 'gauche', order: 0, positionCm: 0, heightCm: 210 },
        { id: 'g1', wallId: wall.id, faceSide: 'gauche', order: 1, positionCm: 400, heightCm: 230 },
      ],
      droite: [
        { id: 'd0', wallId: wall.id, faceSide: 'droite', order: 0, positionCm: 0, heightCm: 310 },
        { id: 'd1', wallId: wall.id, faceSide: 'droite', order: 1, positionCm: 400, heightCm: 340 },
      ],
    };

    const updated = replaceWallAcrossLevel(source, wall, profiles, []);

    expect(updated[0].walls[0].heightProfiles?.gauche.map(({ heightCm }) => heightCm)).toEqual([210, 230]);
    expect(updated[1].walls[0].heightProfiles?.gauche.map(({ heightCm }) => heightCm)).toEqual([340, 310]);
    expect(updated[1].walls[0].heightProfiles?.droite.map(({ heightCm }) => heightCm)).toEqual([230, 210]);
  });

  it('synchronise face par face la hauteur du sommet commun de deux murs adjacents', () => {
    const source = rooms();
    const owner = source[0];
    const referenceWall = { ...owner.walls[0], heightProfilesLinked: false };
    const previousProfiles: WallHeightProfiles = {
      wallId: referenceWall.id,
      gauche: [
        { id: 'référence-g0', wallId: referenceWall.id, faceSide: 'gauche', order: 0, positionCm: 0, heightCm: 250 },
        { id: 'référence-g1', wallId: referenceWall.id, faceSide: 'gauche', order: 1, positionCm: 400, heightCm: 250 },
      ],
      droite: [
        { id: 'référence-d0', wallId: referenceWall.id, faceSide: 'droite', order: 0, positionCm: 0, heightCm: 350 },
        { id: 'référence-d1', wallId: referenceWall.id, faceSide: 'droite', order: 1, positionCm: 400, heightCm: 350 },
      ],
    };
    referenceWall.heightProfiles = previousProfiles;
    owner.walls[0] = referenceWall;
    owner.walls.push({
      id: 'mur-adjacent',
      pieceId: owner.room.id,
      pieceIds: [owner.room.id],
      startVertexId: 'v2',
      endVertexId: 'a-3',
      thicknessCm: 10,
      heightProfilesLinked: false,
      heightProfiles: {
        wallId: 'mur-adjacent',
        gauche: [
          { id: 'adjacent-g0', wallId: 'mur-adjacent', faceSide: 'gauche', order: 0, positionCm: 0, heightCm: 250 },
          { id: 'adjacent-g1', wallId: 'mur-adjacent', faceSide: 'gauche', order: 1, positionCm: 500, heightCm: 250 },
        ],
        droite: [
          { id: 'adjacent-d0', wallId: 'mur-adjacent', faceSide: 'droite', order: 0, positionCm: 0, heightCm: 350 },
          { id: 'adjacent-d1', wallId: 'mur-adjacent', faceSide: 'droite', order: 1, positionCm: 500, heightCm: 350 },
        ],
      },
    });

    const interiorOnly: WallHeightProfiles = {
      ...previousProfiles,
      gauche: previousProfiles.gauche.map((point, index) => index === 1 ? { ...point, heightCm: 280 } : { ...point }),
      droite: previousProfiles.droite.map((point) => ({ ...point })),
    };
    const interiorResult = replaceWallAndSyncConnectedEndpoints(
      source,
      owner.room.id,
      referenceWall,
      previousProfiles,
      interiorOnly,
      [],
    );
    const interiorAdjacent = interiorResult[0].walls.find(({ id }) => id === 'mur-adjacent')!;
    expect(interiorAdjacent.heightProfiles?.gauche[0].heightCm).toBe(280);
    expect(interiorAdjacent.heightProfiles?.droite[0].heightCm).toBe(350);

    const bothFaces: WallHeightProfiles = {
      ...interiorOnly,
      droite: previousProfiles.droite.map((point, index) => index === 1 ? { ...point, heightCm: 380 } : { ...point }),
    };
    const bothResult = replaceWallAndSyncConnectedEndpoints(
      source,
      owner.room.id,
      referenceWall,
      previousProfiles,
      bothFaces,
      [],
    );
    const bothAdjacent = bothResult[0].walls.find(({ id }) => id === 'mur-adjacent')!;
    expect(bothAdjacent.heightProfiles?.gauche[0].heightCm).toBe(280);
    expect(bothAdjacent.heightProfiles?.droite[0].heightCm).toBe(380);
  });

  it('synchronise le verrou d’un sommet partagé', () => {
    const source = rooms();
    const lockedIds = new Set(source[0].vertices.map(({ id }) => id));
    const updated = setSharedVertexLock(source, lockedIds, true);
    expect(updated.flatMap(({ vertices }) => vertices.filter(({ id }) => id === 'v1')))
      .toEqual(expect.arrayContaining([expect.objectContaining({ isLocked: true })]));
    expect(updated[0].room.isLocked).toBe(true);
    expect(updated[0].walls[0].isLocked).toBe(true);
    expect(updated[1].room.isLocked).toBe(false);
    expect(updated[1].walls[0].isLocked).toBe(true);

    const unlocked = setSharedVertexLock(updated, lockedIds, false);
    expect(unlocked[0].room.isLocked).toBe(false);
    expect(unlocked[0].walls[0].isLocked).toBe(false);
    expect(unlocked[1].walls[0].isLocked).toBe(false);
  });
});
