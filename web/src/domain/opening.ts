import type {
  OpeningTemplate,
  TopologyOpening,
  TopologyWall,
  WallFaceSide,
  WallHeightProfilePoint,
  WallHeightProfiles,
} from './types';
import { wallQualification } from './wall';
import { validateWallHeightProfiles, wallHeightAtPosition } from './wallHeightProfile';

const EPSILON = 1e-9;

export type OpeningValidationCode =
  | 'template_mismatch'
  | 'placement_incompatible'
  | 'invalid_position'
  | 'invalid_dimensions'
  | 'outside_wall'
  | 'overlap'
  | 'invalid_wall_profiles'
  | 'outside_wall_height';

export interface TopologyOpeningValidationIssue {
  code: OpeningValidationCode;
  openingId: string;
  wallId: string;
  faceSide: WallFaceSide | null;
  conflictingOpeningId: string | null;
  availableHeightCm: number | null;
  message: string;
}

export class OpeningValidationError extends Error {
  readonly issue: TopologyOpeningValidationIssue;

  constructor(issue: TopologyOpeningValidationIssue) {
    super(issue.message);
    this.name = 'OpeningValidationError';
    this.issue = issue;
  }
}

export interface CreateOpeningInput {
  id?: string;
  wallId: string;
  positionCm: number;
  widthCm: number;
  heightCm: number;
  bottomCm?: number;
  orientation?: string | null;
}

export interface OpeningValidationContext {
  wall: TopologyWall;
  profiles: WallHeightProfiles;
  wallLengthCm: number;
  template: OpeningTemplate;
  siblingOpenings?: readonly TopologyOpening[];
}

export interface IncompatibleOpening {
  opening: TopologyOpening;
  issue: TopologyOpeningValidationIssue;
}

export function createOpeningFromTemplate(
  template: OpeningTemplate,
  input: CreateOpeningInput,
): TopologyOpening {
  return {
    id: input.id ?? globalThis.crypto.randomUUID(),
    wallId: input.wallId,
    templateId: template.id,
    type: template.type,
    placementType: template.placementType,
    positionCm: input.positionCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    bottomCm: input.bottomCm ?? 0,
    orientation: input.orientation ?? null,
  };
}

export function openingAdjacentPieceIds(
  opening: TopologyOpening,
  wall: TopologyWall,
): string[] {
  if (!isPlacementCompatible(opening.placementType, wall)) return [];
  return [...wall.pieceIds];
}

export function validateOpening(
  opening: TopologyOpening,
  context: OpeningValidationContext,
): TopologyOpeningValidationIssue[] {
  const { wall, profiles, wallLengthCm, template } = context;

  if (
    opening.templateId !== template.id
    || opening.type !== template.type
    || opening.placementType !== template.placementType
  ) {
    return [issue(
      'template_mismatch', opening, null, null, null,
      'Le type et le placement de l’ouverture doivent correspondre à son template.',
    )];
  }
  if (opening.wallId !== wall.id || !isPlacementCompatible(opening.placementType, wall)) {
    return [issue(
      'placement_incompatible', opening, null, null, null,
      'Le caractère intérieur ou extérieur de l’ouverture est incompatible avec le mur.',
    )];
  }
  if (!Number.isFinite(opening.positionCm) || opening.positionCm < 0) {
    return [issue(
      'invalid_position', opening, null, null, null,
      'La position de l’ouverture doit être positive ou nulle.',
    )];
  }
  if (
    !Number.isFinite(opening.widthCm)
    || opening.widthCm <= EPSILON
    || !Number.isFinite(opening.heightCm)
    || opening.heightCm <= EPSILON
    || !Number.isFinite(opening.bottomCm)
    || opening.bottomCm < 0
  ) {
    return [issue(
      'invalid_dimensions', opening, null, null, null,
      'La largeur et la hauteur doivent être positives et l’allège positive ou nulle.',
    )];
  }

  const openingEndCm = opening.positionCm + opening.widthCm;
  if (!Number.isFinite(wallLengthCm) || openingEndCm > wallLengthCm + EPSILON) {
    return [issue(
      'outside_wall', opening, null, null, null,
      'L’ouverture doit rester entièrement comprise dans son mur support.',
    )];
  }

  const overlapping = (context.siblingOpenings ?? []).find((sibling) => (
    sibling.id !== opening.id
    && sibling.wallId === opening.wallId
    && rangesOverlap(
      opening.positionCm,
      openingEndCm,
      sibling.positionCm,
      sibling.positionCm + sibling.widthCm,
    )
  ));
  if (overlapping) {
    return [issue(
      'overlap', opening, null, overlapping.id, null,
      'Deux ouvertures d’un même mur ne peuvent pas se chevaucher.',
    )];
  }

  if (validateWallHeightProfiles(wall, profiles, wallLengthCm).length > 0) {
    return [issue(
      'invalid_wall_profiles', opening, null, null, null,
      'Les profils du mur doivent être valides avant de contrôler une ouverture.',
    )];
  }

  for (const faceSide of ['gauche', 'droite'] as const) {
    const availableHeightCm = minimumHeightAcrossOpening(
      profiles[faceSide],
      opening.positionCm,
      openingEndCm,
    );
    if (
      availableHeightCm === null
      || opening.bottomCm + opening.heightCm > availableHeightCm + EPSILON
    ) {
      return [issue(
        'outside_wall_height',
        opening,
        faceSide,
        null,
        availableHeightCm,
        `L’ouverture dépasse la hauteur disponible sur la face ${faceSide}.`,
      )];
    }
  }

  return [];
}

export function assertOpeningCanBePersisted(
  opening: TopologyOpening,
  context: OpeningValidationContext,
): void {
  const [firstIssue] = validateOpening(opening, context);
  if (firstIssue) throw new OpeningValidationError(firstIssue);
}

export function findOpeningsToRemoveAfterTopologyChange(
  openings: readonly TopologyOpening[],
  wallsById: ReadonlyMap<string, TopologyWall>,
  profilesByWallId: ReadonlyMap<string, WallHeightProfiles>,
  wallLengthsCm: ReadonlyMap<string, number>,
  templatesById: ReadonlyMap<string, OpeningTemplate>,
): IncompatibleOpening[] {
  const incompatible: IncompatibleOpening[] = [];

  for (const opening of openings) {
    const wall = wallsById.get(opening.wallId);
    const profiles = profilesByWallId.get(opening.wallId);
    const wallLengthCm = wallLengthsCm.get(opening.wallId);
    const template = templatesById.get(opening.templateId);
    let firstIssue: TopologyOpeningValidationIssue | undefined;

    if (!wall || !profiles || wallLengthCm === undefined || !template) {
      firstIssue = issue(
        'placement_incompatible', opening, null, null, null,
        'Le support ou le template de l’ouverture n’existe plus.',
      );
    } else {
      [firstIssue] = validateOpening(opening, {
        wall,
        profiles,
        wallLengthCm,
        template,
        siblingOpenings: openings,
      });
    }

    if (firstIssue) incompatible.push({ opening, issue: firstIssue });
  }

  return incompatible;
}

function isPlacementCompatible(
  placementType: TopologyOpening['placementType'],
  wall: TopologyWall,
): boolean {
  const qualification = wallQualification(wall);
  return (placementType === 'intérieur' && qualification === 'interior')
    || (placementType === 'extérieur' && qualification === 'exterior');
}

function minimumHeightAcrossOpening(
  profile: readonly WallHeightProfilePoint[],
  startCm: number,
  endCm: number,
): number | null {
  const positions = [
    startCm,
    ...profile
      .map(({ positionCm }) => positionCm)
      .filter((positionCm) => positionCm > startCm && positionCm < endCm),
    endCm,
  ];
  const heights = positions.map((positionCm) => wallHeightAtPosition(profile, positionCm));
  if (heights.some((height) => height === null)) return null;
  return Math.min(...(heights as number[]));
}

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean {
  return leftStart < rightEnd - EPSILON && rightStart < leftEnd - EPSILON;
}

function issue(
  code: OpeningValidationCode,
  opening: TopologyOpening,
  faceSide: WallFaceSide | null,
  conflictingOpeningId: string | null,
  availableHeightCm: number | null,
  message: string,
): TopologyOpeningValidationIssue {
  return {
    code,
    openingId: opening.id,
    wallId: opening.wallId,
    faceSide,
    conflictingOpeningId,
    availableHeightCm,
    message,
  };
}
