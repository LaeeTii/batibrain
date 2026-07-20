import type {
  TopologyWall,
  WallFaceSide,
  WallHeightProfilePoint,
  WallHeightProfiles,
} from './types';

const EPSILON = 1e-9;
export const DEFAULT_WALL_HEIGHT_CM = 250;

export type WallHeightProfileErrorCode =
  | 'invalid_wall_length'
  | 'missing_endpoints'
  | 'invalid_position'
  | 'invalid_height'
  | 'invalid_order'
  | 'duplicate_position'
  | 'profile_identity_mismatch'
  | 'linked_profiles_mismatch'
  | 'locked_point'
  | 'confirmation_required';

export interface WallHeightProfileIssue {
  code: WallHeightProfileErrorCode;
  wallId: string;
  faceSide: WallFaceSide | null;
  pointIds: string[];
  message: string;
}

export class WallHeightProfileError extends Error {
  readonly issue: WallHeightProfileIssue;

  constructor(issue: WallHeightProfileIssue) {
    super(issue.message);
    this.name = 'WallHeightProfileError';
    this.issue = issue;
  }
}

export interface WallHeightProfileState {
  wall: TopologyWall;
  profiles: WallHeightProfiles;
}

export interface HeightProfilePointInput {
  id?: string;
  positionCm: number;
  heightCm: number;
}

export function createUniformWallHeightProfiles(
  wallId: string,
  wallLengthCm: number,
  heightCm = DEFAULT_WALL_HEIGHT_CM,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): WallHeightProfiles {
  if (!Number.isFinite(wallLengthCm) || wallLengthCm <= EPSILON) {
    throw profileError('invalid_wall_length', wallId, null, [], 'La longueur du mur doit être positive.');
  }
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    throw profileError('invalid_height', wallId, null, [], 'La hauteur du mur doit être positive.');
  }

  return {
    wallId,
    gauche: createUniformProfile(wallId, 'gauche', wallLengthCm, heightCm, createId),
    droite: createUniformProfile(wallId, 'droite', wallLengthCm, heightCm, createId),
  };
}

export function validateWallHeightProfiles(
  wall: TopologyWall,
  profiles: WallHeightProfiles,
  wallLengthCm: number,
): WallHeightProfileIssue[] {
  if (!Number.isFinite(wallLengthCm) || wallLengthCm <= EPSILON) {
    return [profileIssue(
      'invalid_wall_length', wall.id, null, [], 'La longueur du mur doit être positive.',
    )];
  }
  if (profiles.wallId !== wall.id) {
    return [profileIssue(
      'profile_identity_mismatch', wall.id, null, [], 'Les profils doivent appartenir au mur validé.',
    )];
  }

  for (const side of ['gauche', 'droite'] as const) {
    const issue = validateFaceProfile(wall.id, side, profiles[side], wallLengthCm);
    if (issue) return [issue];
  }

  if (wall.heightProfilesLinked && !profilesHaveSameValues(profiles.gauche, profiles.droite)) {
    return [profileIssue(
      'linked_profiles_mismatch',
      wall.id,
      null,
      [...profiles.gauche, ...profiles.droite].map(({ id }) => id),
      'Deux profils liés doivent avoir les mêmes positions et hauteurs.',
    )];
  }

  return [];
}

export function assertValidWallHeightProfiles(
  wall: TopologyWall,
  profiles: WallHeightProfiles,
  wallLengthCm: number,
): void {
  const [issue] = validateWallHeightProfiles(wall, profiles, wallLengthCm);
  if (issue) throw new WallHeightProfileError(issue);
}

export function updateWallHeightProfile(
  wall: TopologyWall,
  profiles: WallHeightProfiles,
  faceSide: WallFaceSide,
  points: readonly HeightProfilePointInput[],
  wallLengthCm: number,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): WallHeightProfileState {
  assertProfilePointsCanChange(profiles[faceSide], points);
  const updatedFace = points.map((point, order): WallHeightProfilePoint => ({
    id: point.id ?? createId(),
    wallId: wall.id,
    faceSide,
    order,
    positionCm: point.positionCm,
    heightCm: point.heightCm,
    isLocked: profiles[faceSide].find(({ id }) => id === point.id)?.isLocked ?? false,
  }));
  const oppositeSide = oppositeFace(faceSide);
  const nextProfiles: WallHeightProfiles = {
    wallId: wall.id,
    gauche: faceSide === 'gauche' ? updatedFace : cloneProfile(profiles.gauche),
    droite: faceSide === 'droite' ? updatedFace : cloneProfile(profiles.droite),
  };

  if (wall.heightProfilesLinked) {
    nextProfiles[oppositeSide] = copyProfileValues(
      updatedFace,
      oppositeSide,
      profiles[oppositeSide],
      createId,
    );
  }

  assertValidWallHeightProfiles(wall, nextProfiles, wallLengthCm);
  return { wall: { ...wall }, profiles: nextProfiles };
}

export function unlinkWallHeightProfiles(state: WallHeightProfileState): WallHeightProfileState {
  return {
    wall: { ...state.wall, heightProfilesLinked: false },
    profiles: cloneProfiles(state.profiles),
  };
}

export function relinkWallHeightProfiles(
  state: WallHeightProfileState,
  sourceFace: WallFaceSide,
  wallLengthCm: number,
  confirmed: boolean,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): WallHeightProfileState {
  if (!confirmed) {
    throw profileError(
      'confirmation_required',
      state.wall.id,
      sourceFace,
      [],
      'La remise en liaison des profils doit être confirmée.',
    );
  }

  const targetFace = oppositeFace(sourceFace);
  const profiles = cloneProfiles(state.profiles);
  if (profiles[targetFace].some(({ isLocked }) => isLocked)) {
    throw profileError(
      'locked_point',
      state.wall.id,
      targetFace,
      profiles[targetFace].filter(({ isLocked }) => isLocked).map(({ id }) => id),
      'Un profil contenant un point verrouillé ne peut pas être remplacé.',
    );
  }
  profiles[targetFace] = copyProfileValues(
    profiles[sourceFace],
    targetFace,
    profiles[targetFace],
    createId,
  );
  const wall = { ...state.wall, heightProfilesLinked: true };
  assertValidWallHeightProfiles(wall, profiles, wallLengthCm);
  return { wall, profiles };
}

export function invertWallSegmentAndProfiles(
  state: WallHeightProfileState,
  wallLengthCm: number,
): WallHeightProfileState {
  assertValidWallHeightProfiles(state.wall, state.profiles, wallLengthCm);

  const wall: TopologyWall = {
    ...state.wall,
    startVertexId: state.wall.endVertexId,
    endVertexId: state.wall.startVertexId,
  };
  const profiles: WallHeightProfiles = {
    wallId: wall.id,
    gauche: reverseProfile(state.profiles.droite, 'gauche', wallLengthCm),
    droite: reverseProfile(state.profiles.gauche, 'droite', wallLengthCm),
  };
  assertValidWallHeightProfiles(wall, profiles, wallLengthCm);
  return { wall, profiles };
}

export function wallHeightAtPosition(
  profile: readonly WallHeightProfilePoint[],
  positionCm: number,
): number | null {
  if (profile.length < 2 || !Number.isFinite(positionCm)) return null;
  const sorted = [...profile].sort((left, right) => left.positionCm - right.positionCm);
  if (positionCm < sorted[0].positionCm || positionCm > sorted.at(-1)!.positionCm) return null;

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (positionCm < start.positionCm || positionCm > end.positionCm) continue;
    const length = end.positionCm - start.positionCm;
    if (length <= EPSILON) return null;
    const ratio = (positionCm - start.positionCm) / length;
    return start.heightCm + ratio * (end.heightCm - start.heightCm);
  }
  return null;
}

function validateFaceProfile(
  wallId: string,
  side: WallFaceSide,
  points: readonly WallHeightProfilePoint[],
  wallLengthCm: number,
): WallHeightProfileIssue | null {
  if (points.length < 2 || points[0]?.positionCm !== 0 || points.at(-1)?.positionCm !== wallLengthCm) {
    return profileIssue(
      'missing_endpoints', wallId, side, points.map(({ id }) => id),
      'Chaque profil doit couvrir les deux extrémités du mur.',
    );
  }

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point.wallId !== wallId || point.faceSide !== side) {
      return profileIssue(
        'profile_identity_mismatch', wallId, side, [point.id],
        'Chaque point doit appartenir au mur et à la face de son profil.',
      );
    }
    if (point.order !== index) {
      return profileIssue(
        'invalid_order', wallId, side, [point.id], 'Les points doivent être ordonnés sans rupture.',
      );
    }
    if (!Number.isFinite(point.positionCm) || point.positionCm < 0 || point.positionCm > wallLengthCm) {
      return profileIssue(
        'invalid_position', wallId, side, [point.id], 'La position doit rester dans les bornes du mur.',
      );
    }
    if (!Number.isFinite(point.heightCm) || point.heightCm <= 0) {
      return profileIssue(
        'invalid_height', wallId, side, [point.id], 'La hauteur doit être strictement positive.',
      );
    }
    if (index > 0 && point.positionCm <= points[index - 1].positionCm) {
      return profileIssue(
        point.positionCm === points[index - 1].positionCm ? 'duplicate_position' : 'invalid_order',
        wallId,
        side,
        [points[index - 1].id, point.id],
        'Les positions doivent être uniques et strictement croissantes.',
      );
    }
  }
  return null;
}

function createUniformProfile(
  wallId: string,
  faceSide: WallFaceSide,
  wallLengthCm: number,
  heightCm: number,
  createId: () => string,
): WallHeightProfilePoint[] {
  return [0, wallLengthCm].map((positionCm, order) => ({
    id: createId(), wallId, faceSide, order, positionCm, heightCm, isLocked: false,
  }));
}

function copyProfileValues(
  source: readonly WallHeightProfilePoint[],
  targetFace: WallFaceSide,
  existingTarget: readonly WallHeightProfilePoint[],
  createId: () => string,
): WallHeightProfilePoint[] {
  return source.map((point, order) => ({
    id: existingTarget[order]?.id ?? createId(),
    wallId: point.wallId,
    faceSide: targetFace,
    order,
    positionCm: point.positionCm,
    heightCm: point.heightCm,
    isLocked: existingTarget[order]?.isLocked ?? point.isLocked,
  }));
}

function reverseProfile(
  profile: readonly WallHeightProfilePoint[],
  targetFace: WallFaceSide,
  wallLengthCm: number,
): WallHeightProfilePoint[] {
  return [...profile].reverse().map((point, order) => ({
    ...point,
    faceSide: targetFace,
    order,
    positionCm: wallLengthCm - point.positionCm,
  }));
}

function profilesHaveSameValues(
  left: readonly WallHeightProfilePoint[],
  right: readonly WallHeightProfilePoint[],
): boolean {
  return left.length === right.length && left.every((point, index) => (
    point.positionCm === right[index].positionCm
    && point.heightCm === right[index].heightCm
    && point.isLocked === right[index].isLocked
  ));
}

function assertProfilePointsCanChange(
  current: readonly WallHeightProfilePoint[],
  next: readonly HeightProfilePointInput[],
): void {
  const nextById = new Map(next.flatMap((point) => point.id ? [[point.id, point] as const] : []));
  const lockedChanged = current.find((point) => {
    if (!point.isLocked) return false;
    const nextPoint = nextById.get(point.id);
    return !nextPoint
      || nextPoint.positionCm !== point.positionCm
      || nextPoint.heightCm !== point.heightCm;
  });
  if (lockedChanged) {
    throw profileError(
      'locked_point',
      lockedChanged.wallId,
      lockedChanged.faceSide,
      [lockedChanged.id],
      'Un point de profil verrouillé ne peut pas être modifié ou supprimé.',
    );
  }
}

function cloneProfile(profile: readonly WallHeightProfilePoint[]): WallHeightProfilePoint[] {
  return profile.map((point) => ({ ...point }));
}

function cloneProfiles(profiles: WallHeightProfiles): WallHeightProfiles {
  return { wallId: profiles.wallId, gauche: cloneProfile(profiles.gauche), droite: cloneProfile(profiles.droite) };
}

function oppositeFace(faceSide: WallFaceSide): WallFaceSide {
  return faceSide === 'gauche' ? 'droite' : 'gauche';
}

function profileError(
  code: WallHeightProfileErrorCode,
  wallId: string,
  faceSide: WallFaceSide | null,
  pointIds: string[],
  message: string,
): WallHeightProfileError {
  return new WallHeightProfileError(profileIssue(code, wallId, faceSide, pointIds, message));
}

function profileIssue(
  code: WallHeightProfileErrorCode,
  wallId: string,
  faceSide: WallFaceSide | null,
  pointIds: string[],
  message: string,
): WallHeightProfileIssue {
  return { code, wallId, faceSide, pointIds, message };
}
