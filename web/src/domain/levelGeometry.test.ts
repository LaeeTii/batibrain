import { describe, expect, it } from 'vitest';
import {
  GeometryMutationError,
  assertGeometryMutationAllowed,
  assertLevelGeometrySnapshot,
  type LevelGeometrySnapshot,
} from './levelGeometry';
import { createStableWallFaces } from './wall';
import { createUniformWallHeightProfiles } from './wallHeightProfile';

function snapshot(): LevelGeometrySnapshot {
  const wall = {
    id: 'mur-1',
    startVertexId: 'a',
    endVertexId: 'b',
    faces: createStableWallFaces(),
    pieceIds: ['pièce-1'],
    thicknessCm: 10,
    material: null,
    insulation: null,
    notes: null,
    heightProfilesLinked: true,
  };
  const otherWalls = [
    ['mur-2', 'b', 'c'],
    ['mur-3', 'c', 'd'],
    ['mur-4', 'd', 'a'],
  ].map(([id, startVertexId, endVertexId]) => ({
    ...wall,
    id,
    startVertexId,
    endVertexId,
  }));
  return {
    levelId: 'niveau-1',
    revision: 1,
    vertices: [
      { id: 'a', levelId: 'niveau-1', x: 0, y: 0, isLocked: false },
      { id: 'b', levelId: 'niveau-1', x: 300, y: 0, isLocked: false },
      { id: 'c', levelId: 'niveau-1', x: 300, y: 200, isLocked: false },
      { id: 'd', levelId: 'niveau-1', x: 0, y: 200, isLocked: false },
    ],
    pieces: [{
      room: {
        id: 'pièce-1',
        levelId: 'niveau-1',
        name: 'Salon',
        type: 'salon',
        floorColor: '#fff',
      },
      vertexIds: ['a', 'b', 'c', 'd'],
    }],
    walls: [wall, ...otherWalls],
    profilesByWallId: {
      'mur-1': createUniformWallHeightProfiles('mur-1', 300),
      'mur-2': createUniformWallHeightProfiles('mur-2', 200),
      'mur-3': createUniformWallHeightProfiles('mur-3', 300),
      'mur-4': createUniformWallHeightProfiles('mur-4', 200),
    },
    openings: [],
    templatesById: {},
  };
}

describe('instantané géométrique canonique', () => {
  it('valide une pièce, ses murs autonomes et tous leurs profils', () => {
    expect(() => assertLevelGeometrySnapshot(snapshot())).not.toThrow();
  });

  it('refuse un troisième lien mur–pièce avant persistance', () => {
    const current = snapshot();
    current.walls[0].pieceIds = ['pièce-1', 'pièce-2', 'pièce-3'];
    expect(() => assertLevelGeometrySnapshot(current)).toThrow(/deux pièces/);
  });

  it('refuse le déplacement d’un sommet verrouillé sans modifier le brouillon source', () => {
    const before = snapshot();
    before.vertices[0].isLocked = true;
    const after = structuredClone(before);
    after.vertices[0].x = 20;

    expect(() => assertGeometryMutationAllowed(before, after)).toThrow(GeometryMutationError);
    expect(before.vertices[0].x).toBe(0);
  });

  it('autorise le déverrouillage et le déplacement dans le même instantané', () => {
    const before = snapshot();
    before.vertices[0].isLocked = true;
    const after = structuredClone(before);
    after.vertices[0] = { ...after.vertices[0], x: 20, isLocked: false };

    expect(() => assertGeometryMutationAllowed(before, after)).not.toThrow();
  });

  it('refuse la suppression d’un point de profil verrouillé', () => {
    const before = snapshot();
    before.profilesByWallId['mur-1'].gauche[1].isLocked = true;
    const after = structuredClone(before);
    after.profilesByWallId['mur-1'].gauche.pop();

    expect(() => assertGeometryMutationAllowed(before, after))
      .toThrowError(expect.objectContaining({ code: 'locked_profile_point' }));
  });
});
