import { describe, expect, it } from 'vitest';
import type { TopologyWall } from './types';
import { createStableWallFaces } from './wall';
import {
  DEFAULT_WALL_HEIGHT_CM,
  WallHeightProfileError,
  createUniformWallHeightProfiles,
  invertWallSegmentAndProfiles,
  relinkWallHeightProfiles,
  resizeWallHeightProfiles,
  unlinkWallHeightProfiles,
  updateWallHeightProfile,
  validateWallHeightProfiles,
  wallHeightAtPosition,
} from './wallHeightProfile';

function wall(overrides: Partial<TopologyWall> = {}): TopologyWall {
  return {
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
    ...overrides,
  };
}

function idSequence() {
  let sequence = 0;
  return () => `profil-${sequence += 1}`;
}

describe('initialisation des profils de hauteur', () => {
  it('crée deux profils uniformes liés à 250 cm couvrant le mur', () => {
    const currentWall = wall();
    const profiles = createUniformWallHeightProfiles(currentWall.id, 200, undefined, idSequence());

    expect(currentWall.heightProfilesLinked).toBe(true);
    expect(profiles.gauche.map(({ positionCm, heightCm }) => [positionCm, heightCm])).toEqual([
      [0, DEFAULT_WALL_HEIGHT_CM], [200, DEFAULT_WALL_HEIGHT_CM],
    ]);
    expect(profiles.droite.map(({ positionCm, heightCm }) => [positionCm, heightCm])).toEqual([
      [0, DEFAULT_WALL_HEIGHT_CM], [200, DEFAULT_WALL_HEIGHT_CM],
    ]);
    expect(validateWallHeightProfiles(currentWall, profiles, 200)).toEqual([]);
  });

  it('refuse une longueur ou une hauteur initiale non positive', () => {
    expect(() => createUniformWallHeightProfiles('mur-1', 0)).toThrowError(
      expect.objectContaining({ issue: expect.objectContaining({ code: 'invalid_wall_length' }) }),
    );
    expect(() => createUniformWallHeightProfiles('mur-1', 200, -1)).toThrowError(
      expect.objectContaining({ issue: expect.objectContaining({ code: 'invalid_height' }) }),
    );
  });
});

describe('validation des profils', () => {
  it.each([
    {
      name: 'une extrémité manquante',
      mutate: (profiles: ReturnType<typeof createUniformWallHeightProfiles>) => {
        profiles.gauche[1].positionCm = 190;
      },
      code: 'missing_endpoints',
    },
    {
      name: 'une position dupliquée',
      mutate: (profiles: ReturnType<typeof createUniformWallHeightProfiles>) => {
        profiles.gauche.splice(1, 0, { ...profiles.gauche[0], id: 'doublon', order: 1 });
        profiles.gauche[2].order = 2;
      },
      code: 'duplicate_position',
    },
    {
      name: 'une hauteur nulle',
      mutate: (profiles: ReturnType<typeof createUniformWallHeightProfiles>) => {
        profiles.gauche[0].heightCm = 0;
      },
      code: 'invalid_height',
    },
    {
      name: 'un ordre discontinu',
      mutate: (profiles: ReturnType<typeof createUniformWallHeightProfiles>) => {
        profiles.gauche[1].order = 3;
      },
      code: 'invalid_order',
    },
  ])('refuse $name', ({ mutate, code }) => {
    const profiles = createUniformWallHeightProfiles('mur-1', 200, 250, idSequence());
    mutate(profiles);
    expect(validateWallHeightProfiles(wall(), profiles, 200)[0]?.code).toBe(code);
  });

  it('refuse des profils divergents lorsque leur liaison est active', () => {
    const profiles = createUniformWallHeightProfiles('mur-1', 200, 250, idSequence());
    profiles.droite[1].heightCm = 300;
    expect(validateWallHeightProfiles(wall(), profiles, 200)[0]?.code).toBe('linked_profiles_mismatch');
  });
});

describe('redimensionnement des profils', () => {
  it('recale proportionnellement les points sur la nouvelle longueur', () => {
    const currentWall = wall();
    const profiles = createUniformWallHeightProfiles(currentWall.id, 200, 250, idSequence());
    profiles.gauche.splice(1, 0, {
      id: 'milieu-gauche', wallId: currentWall.id, faceSide: 'gauche', order: 1,
      positionCm: 100, heightCm: 300, isLocked: false,
    });
    profiles.gauche[2].order = 2;
    profiles.droite.splice(1, 0, {
      id: 'milieu-droite', wallId: currentWall.id, faceSide: 'droite', order: 1,
      positionCm: 100, heightCm: 300, isLocked: false,
    });
    profiles.droite[2].order = 2;

    const resized = resizeWallHeightProfiles(currentWall, profiles, 200, 250.555);

    expect(resized.gauche.map(({ id, positionCm, heightCm }) => [id, positionCm, heightCm])).toEqual([
      [profiles.gauche[0].id, 0, 250],
      ['milieu-gauche', 125.28, 300],
      [profiles.gauche[2].id, 250.56, 250],
    ]);
    expect(validateWallHeightProfiles(currentWall, resized, 250.555)).toEqual([]);
  });

  it('refuse de déplacer un point de profil verrouillé', () => {
    const currentWall = wall();
    const profiles = createUniformWallHeightProfiles(currentWall.id, 200, 250, idSequence());
    profiles.gauche[1].isLocked = true;
    profiles.droite[1].isLocked = true;

    expect(() => resizeWallHeightProfiles(currentWall, profiles, 200, 250))
      .toThrowError(expect.objectContaining({ issue: expect.objectContaining({ code: 'locked_point' }) }));
  });
});

describe('édition liée et indépendante', () => {
  it('répercute atomiquement une modification lorsque les profils sont liés', () => {
    const currentWall = wall();
    const profiles = createUniformWallHeightProfiles(currentWall.id, 200, 250, idSequence());
    const state = updateWallHeightProfile(
      currentWall,
      profiles,
      'gauche',
      [
        { positionCm: 0, heightCm: 250 },
        { positionCm: 100, heightCm: 300 },
        { positionCm: 200, heightCm: 280 },
      ],
      200,
      idSequence(),
    );

    expect(state.profiles.gauche.map(({ positionCm, heightCm }) => [positionCm, heightCm]))
      .toEqual(state.profiles.droite.map(({ positionCm, heightCm }) => [positionCm, heightCm]));
    expect(validateWallHeightProfiles(state.wall, state.profiles, 200)).toEqual([]);
  });

  it('conserve les profils à la dissociation puis permet leur édition indépendante', () => {
    const currentWall = wall();
    const initial = createUniformWallHeightProfiles(currentWall.id, 200, 250, idSequence());
    const unlinked = unlinkWallHeightProfiles({ wall: currentWall, profiles: initial });
    const edited = updateWallHeightProfile(
      unlinked.wall,
      unlinked.profiles,
      'droite',
      [{ positionCm: 0, heightCm: 220 }, { positionCm: 200, heightCm: 300 }],
      200,
      idSequence(),
    );

    expect(unlinked.wall.heightProfilesLinked).toBe(false);
    expect(edited.profiles.gauche.map(({ heightCm }) => heightCm)).toEqual([250, 250]);
    expect(edited.profiles.droite.map(({ heightCm }) => heightCm)).toEqual([220, 300]);
    expect(validateWallHeightProfiles(edited.wall, edited.profiles, 200)).toEqual([]);
  });

  it('exige une confirmation puis copie la face affichée lors de la remise en liaison', () => {
    const currentWall = wall({ heightProfilesLinked: false });
    const profiles = createUniformWallHeightProfiles(currentWall.id, 200, 250, idSequence());
    profiles.gauche[1].heightCm = 320;
    const state = { wall: currentWall, profiles };

    expect(() => relinkWallHeightProfiles(state, 'gauche', 200, false)).toThrow(WallHeightProfileError);
    const relinked = relinkWallHeightProfiles(state, 'gauche', 200, true, idSequence());

    expect(relinked.wall.heightProfilesLinked).toBe(true);
    expect(relinked.profiles.droite.map(({ heightCm }) => heightCm)).toEqual([250, 320]);
  });
});

describe('inversion du segment', () => {
  it('permute les faces et inverse les distances pour préserver les faces physiques', () => {
    const currentWall = wall({ heightProfilesLinked: false });
    const profiles = createUniformWallHeightProfiles(currentWall.id, 200, 250, idSequence());
    const leftEdited = updateWallHeightProfile(
      currentWall,
      profiles,
      'gauche',
      [{ positionCm: 0, heightCm: 200 }, { positionCm: 50, heightCm: 240 }, { positionCm: 200, heightCm: 300 }],
      200,
      idSequence(),
    );
    const bothEdited = updateWallHeightProfile(
      leftEdited.wall,
      leftEdited.profiles,
      'droite',
      [{ positionCm: 0, heightCm: 400 }, { positionCm: 200, heightCm: 500 }],
      200,
      idSequence(),
    );
    const inverted = invertWallSegmentAndProfiles(bothEdited, 200);

    expect([inverted.wall.startVertexId, inverted.wall.endVertexId]).toEqual(['b', 'a']);
    expect(inverted.profiles.gauche.map(({ positionCm, heightCm }) => [positionCm, heightCm])).toEqual([
      [0, 500], [200, 400],
    ]);
    expect(inverted.profiles.droite.map(({ positionCm, heightCm }) => [positionCm, heightCm])).toEqual([
      [0, 300], [150, 240], [200, 200],
    ]);
  });

  it('interpole la hauteur entre deux points consécutifs', () => {
    const profile = createUniformWallHeightProfiles('mur-1', 200, 200, idSequence()).gauche;
    profile[1].heightCm = 300;
    expect(wallHeightAtPosition(profile, 50)).toBe(225);
    expect(wallHeightAtPosition(profile, 250)).toBeNull();
  });
});
