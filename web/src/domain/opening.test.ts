import { describe, expect, it } from 'vitest';
import type {
  OpeningTemplate,
  TopologyOpening,
  TopologyWall,
  WallHeightProfiles,
} from './types';
import { createStableWallFaces } from './wall';
import { createUniformWallHeightProfiles } from './wallHeightProfile';
import {
  OpeningValidationError,
  assertOpeningCanBePersisted,
  createOpeningFromTemplate,
  findOpeningsToRemoveAfterTopologyChange,
  openingAdjacentPieceIds,
  validateOpening,
} from './opening';

const interiorTemplate: OpeningTemplate = {
  id: 'template-intérieur',
  name: 'Porte intérieure',
  type: 'porte',
  placementType: 'intérieur',
};
const exteriorTemplate: OpeningTemplate = {
  id: 'template-extérieur',
  name: 'Fenêtre extérieure',
  type: 'fenêtre',
  placementType: 'extérieur',
};

function wall(pieceIds = ['pièce-1', 'pièce-2'], overrides: Partial<TopologyWall> = {}): TopologyWall {
  return {
    id: 'mur-1',
    startVertexId: 'a',
    endVertexId: 'b',
    faces: createStableWallFaces(),
    pieceIds,
    thicknessCm: 10,
    material: null,
    insulation: null,
    notes: null,
    isLocked: false,
    heightProfilesLinked: true,
    ...overrides,
  };
}

function opening(
  template = interiorTemplate,
  overrides: Partial<TopologyOpening> = {},
): TopologyOpening {
  return createOpeningFromTemplate(template, {
    id: overrides.id ?? 'ouverture-1',
    wallId: overrides.wallId ?? 'mur-1',
    positionCm: overrides.positionCm ?? 20,
    widthCm: overrides.widthCm ?? 80,
    heightCm: overrides.heightCm ?? 210,
    bottomCm: overrides.bottomCm ?? 0,
    orientation: overrides.orientation,
  });
}

function profiles(heightCm = 250): WallHeightProfiles {
  let sequence = 0;
  return createUniformWallHeightProfiles('mur-1', 300, heightCm, () => `profil-${sequence += 1}`);
}

describe('templates et instances d’ouverture', () => {
  it('copie explicitement le type et le placement du template', () => {
    const result = opening(interiorTemplate);
    expect(result).toMatchObject({
      templateId: interiorTemplate.id,
      type: 'porte',
      placementType: 'intérieur',
      bottomCm: 0,
      isLocked: false,
    });
  });

  it('calcule l’adjacence depuis les relations du mur support', () => {
    expect(openingAdjacentPieceIds(opening(), wall())).toEqual(['pièce-1', 'pièce-2']);
    expect(openingAdjacentPieceIds(opening(exteriorTemplate), wall(['pièce-1']))).toEqual(['pièce-1']);
    expect(openingAdjacentPieceIds(opening(interiorTemplate), wall(['pièce-1']))).toEqual([]);
  });
});

describe('validation avant persistance', () => {
  it('accepte une ouverture intérieure sur un mur intérieur compatible avec les deux profils', () => {
    expect(validateOpening(opening(), {
      wall: wall(), profiles: profiles(), wallLengthCm: 300, template: interiorTemplate,
    })).toEqual([]);
  });

  it('refuse une caractéristique intérieure ou extérieure incompatible avec le mur', () => {
    const issue = validateOpening(opening(interiorTemplate), {
      wall: wall(['pièce-1']), profiles: profiles(), wallLengthCm: 300, template: interiorTemplate,
    })[0];
    expect(issue?.code).toBe('placement_incompatible');
  });

  it('refuse une instance qui diverge de son template', () => {
    const changed = { ...opening(), type: 'fenêtre' as const };
    expect(validateOpening(changed, {
      wall: wall(), profiles: profiles(), wallLengthCm: 300, template: interiorTemplate,
    })[0]?.code).toBe('template_mismatch');
  });

  it.each([
    [{ positionCm: -1 }, 'invalid_position'],
    [{ widthCm: 0 }, 'invalid_dimensions'],
    [{ heightCm: -10 }, 'invalid_dimensions'],
    [{ bottomCm: -1 }, 'invalid_dimensions'],
    [{ positionCm: 250, widthCm: 60 }, 'outside_wall'],
  ] as const)('refuse les dimensions ou positions invalides %o', (overrides, code) => {
    expect(validateOpening(opening(interiorTemplate, overrides), {
      wall: wall(), profiles: profiles(), wallLengthCm: 300, template: interiorTemplate,
    })[0]?.code).toBe(code);
  });

  it('refuse le chevauchement mais autorise deux ouvertures qui se touchent', () => {
    const current = opening(interiorTemplate, { positionCm: 100, widthCm: 50 });
    const overlapping = opening(interiorTemplate, { id: 'chevauchement', positionCm: 120, widthCm: 50 });
    const touching = opening(interiorTemplate, { id: 'contact', positionCm: 150, widthCm: 50 });

    expect(validateOpening(current, {
      wall: wall(), profiles: profiles(), wallLengthCm: 300, template: interiorTemplate,
      siblingOpenings: [overlapping],
    })[0]).toMatchObject({ code: 'overlap', conflictingOpeningId: 'chevauchement' });
    expect(validateOpening(current, {
      wall: wall(), profiles: profiles(), wallLengthCm: 300, template: interiorTemplate,
      siblingOpenings: [touching],
    })).toEqual([]);
  });

  it('contrôle les extrémités et les points intermédiaires sur chacune des deux faces', () => {
    const currentWall = wall([], { pieceIds: ['pièce-1', 'pièce-2'], heightProfilesLinked: false });
    const currentProfiles = profiles(300);
    currentProfiles.droite.splice(1, 0, {
      id: 'point-bas',
      wallId: 'mur-1',
      faceSide: 'droite',
      order: 1,
      positionCm: 60,
      heightCm: 190,
    });
    currentProfiles.droite[2].order = 2;

    const issue = validateOpening(opening(interiorTemplate, {
      positionCm: 20, widthCm: 80, heightCm: 200,
    }), {
      wall: currentWall,
      profiles: currentProfiles,
      wallLengthCm: 300,
      template: interiorTemplate,
    })[0];

    expect(issue).toMatchObject({
      code: 'outside_wall_height',
      faceSide: 'droite',
      availableHeightCm: 190,
    });
  });

  it('lève une erreur structurée avant persistance', () => {
    expect(() => assertOpeningCanBePersisted(opening(interiorTemplate, { heightCm: 400 }), {
      wall: wall(), profiles: profiles(), wallLengthCm: 300, template: interiorTemplate,
    })).toThrow(OpeningValidationError);
  });
});

describe('revalidation après modification topologique', () => {
  it('identifie pour suppression une ouverture devenue incompatible', () => {
    const interiorOpening = opening(interiorTemplate);
    const exteriorOpening = opening(exteriorTemplate, {
      id: 'ouverture-extérieure', positionCm: 150, widthCm: 50, heightCm: 100,
    });
    const exteriorWall = wall(['pièce-1']);

    const incompatible = findOpeningsToRemoveAfterTopologyChange(
      [interiorOpening, exteriorOpening],
      new Map([['mur-1', exteriorWall]]),
      new Map([['mur-1', profiles()]]),
      new Map([['mur-1', 300]]),
      new Map([
        [interiorTemplate.id, interiorTemplate],
        [exteriorTemplate.id, exteriorTemplate],
      ]),
    );

    expect(incompatible.map(({ opening: item, issue }) => [item.id, issue.code])).toEqual([
      ['ouverture-1', 'placement_incompatible'],
    ]);
  });

  it('identifie une ouverture dont le mur support a disparu', () => {
    const incompatible = findOpeningsToRemoveAfterTopologyChange(
      [opening()], new Map(), new Map(), new Map(), new Map([[interiorTemplate.id, interiorTemplate]]),
    );
    expect(incompatible[0]?.issue.code).toBe('placement_incompatible');
  });
});
