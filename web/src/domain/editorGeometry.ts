import type { RoomSnapshot } from '../services/rooms';
import type { Opening, TopologyWall, Vertex, Wall, WallFaceSide, WallHeightProfiles } from './types';
import type { TopologyOpening } from './types';
import { createStableWallFaces } from './wall';
import { assertValidWallHeightProfiles, invertWallSegmentAndProfiles } from './wallHeightProfile';
import { validateOpening } from './opening';
import { roomLockState, wallLockState } from './manualLock';

export interface WallEditorContext {
  projection: Wall;
  ownerRoomId: string;
  lengthCm: number;
}

type SemanticWallFace = 'intérieure' | 'extérieure';

interface ConnectedEndpointUpdate {
  vertexId: string;
  semanticFace: SemanticWallFace;
  heightCm: number;
}

export function topologyWallFromProjection(wall: Wall): TopologyWall {
  return {
    id: wall.id,
    startVertexId: wall.startVertexId,
    endVertexId: wall.endVertexId,
    faces: createStableWallFaces(),
    pieceIds: [...(wall.pieceIds ?? [wall.pieceId])],
    thicknessCm: wall.thicknessCm ?? null,
    material: wall.material ?? null,
    insulation: wall.insulation ?? null,
    notes: wall.notes ?? null,
    heightProfilesLinked: wall.heightProfilesLinked ?? true,
  };
}

export function findWallEditorContext(
  rooms: readonly RoomSnapshot[],
  wallId: string,
  preferredRoomId?: string,
): WallEditorContext | null {
  const candidates = rooms.flatMap((snapshot) => snapshot.walls
    .filter(({ id }) => id === wallId)
    .map((projection) => ({ snapshot, projection })));
  const candidate = candidates.find(({ snapshot }) => snapshot.room.id === preferredRoomId)
    ?? candidates[0];
  if (!candidate) return null;
  const start = candidate.snapshot.vertices.find(({ id }) => id === candidate.projection.startVertexId);
  const end = candidate.snapshot.vertices.find(({ id }) => id === candidate.projection.endVertexId);
  if (!start || !end) return null;
  return {
    projection: candidate.projection,
    ownerRoomId: candidate.snapshot.room.id,
    lengthCm: Math.hypot(end.x - start.x, end.y - start.y),
  };
}

export function interiorFaceForRoom(snapshot: Pick<RoomSnapshot, 'vertices'>): WallFaceSide {
  const vertices = [...snapshot.vertices].sort((left, right) => left.order - right.order);
  const signedArea = vertices.reduce((sum, vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + vertex.x * next.y - next.x * vertex.y;
  }, 0);
  return signedArea >= 0 ? 'gauche' : 'droite';
}

export function replaceWallAndSyncConnectedEndpoints(
  rooms: readonly RoomSnapshot[],
  ownerRoomId: string,
  referenceWall: Wall,
  previousProfiles: WallHeightProfiles,
  nextProfiles: WallHeightProfiles,
  openings: readonly Opening[],
): RoomSnapshot[] {
  const owner = rooms.find(({ room }) => room.id === ownerRoomId);
  if (!owner) return replaceWallAcrossLevel(rooms, referenceWall, nextProfiles, openings);
  const interiorFace = interiorFaceForRoom(owner);
  const updates: ConnectedEndpointUpdate[] = [];

  for (const faceSide of ['gauche', 'droite'] as const) {
    const previousFace = previousProfiles[faceSide];
    const nextFace = nextProfiles[faceSide];
    const semanticFace: SemanticWallFace = faceSide === interiorFace ? 'intérieure' : 'extérieure';
    const previousStart = previousFace[0];
    const nextStart = nextFace[0];
    if (previousStart && nextStart && previousStart.heightCm !== nextStart.heightCm) {
      updates.push({ vertexId: referenceWall.startVertexId, semanticFace, heightCm: nextStart.heightCm });
    }
    const previousEnd = previousFace.at(-1);
    const nextEnd = nextFace.at(-1);
    if (previousEnd && nextEnd && previousEnd.heightCm !== nextEnd.heightCm) {
      updates.push({ vertexId: referenceWall.endVertexId, semanticFace, heightCm: nextEnd.heightCm });
    }
  }

  let synchronized = replaceWallAcrossLevel(rooms, referenceWall, nextProfiles, openings);
  if (updates.length === 0) return synchronized;

  const updatesByWallId = new Map<string, ConnectedEndpointUpdate[]>();
  for (const update of updates) {
    for (const wall of owner.walls) {
      if (
        wall.id === referenceWall.id
        || (wall.startVertexId !== update.vertexId && wall.endVertexId !== update.vertexId)
      ) continue;
      const current = updatesByWallId.get(wall.id) ?? [];
      current.push(update);
      updatesByWallId.set(wall.id, current);
    }
  }

  for (const [wallId, wallUpdates] of updatesByWallId) {
    const currentOwner = synchronized.find(({ room }) => room.id === ownerRoomId);
    const adjacentWall = currentOwner?.walls.find(({ id }) => id === wallId);
    if (!currentOwner || !adjacentWall?.heightProfiles) continue;
    const adjacentInteriorFace = interiorFaceForRoom(currentOwner);
    const profiles: WallHeightProfiles = {
      wallId,
      gauche: adjacentWall.heightProfiles.gauche.map((point) => ({ ...point })),
      droite: adjacentWall.heightProfiles.droite.map((point) => ({ ...point })),
    };

    for (const update of wallUpdates) {
      const faceSide = update.semanticFace === 'intérieure'
        ? adjacentInteriorFace
        : opposite(adjacentInteriorFace);
      const endpointIndex = adjacentWall.startVertexId === update.vertexId
        ? 0
        : profiles[faceSide].length - 1;
      const endpoint = profiles[faceSide][endpointIndex];
      if (!endpoint || endpoint.heightCm === update.heightCm) continue;
      if (endpoint.isLocked) {
        throw new Error('Le point de profil commun du mur voisin est verrouillé.');
      }
      profiles[faceSide][endpointIndex] = { ...endpoint, heightCm: update.heightCm };
    }

    const profilesRemainLinked = profiles.gauche.length === profiles.droite.length
      && profiles.gauche.every((point, index) => (
        point.positionCm === profiles.droite[index]?.positionCm
        && point.heightCm === profiles.droite[index]?.heightCm
        && point.isLocked === profiles.droite[index]?.isLocked
      ));
    const nextAdjacentWall = {
      ...adjacentWall,
      heightProfilesLinked: adjacentWall.heightProfilesLinked === true && profilesRemainLinked,
    };
    const lengthCm = wallLength(currentOwner.vertices, adjacentWall);
    assertValidWallHeightProfiles(topologyWallFromProjection(nextAdjacentWall), profiles, lengthCm);
    synchronized = replaceWallAcrossLevel(
      synchronized,
      nextAdjacentWall,
      profiles,
      currentOwner.openings.filter((opening) => opening.wallId === wallId),
    );
  }

  return synchronized;
}

export function replaceWallAcrossLevel(
  rooms: readonly RoomSnapshot[],
  referenceWall: Wall,
  referenceProfiles: WallHeightProfiles,
  openings: readonly Opening[],
): RoomSnapshot[] {
  const referenceState = {
    wall: topologyWallFromProjection(referenceWall),
    profiles: referenceProfiles,
  };
  const referenceOpeningIds = new Set(openings.map(({ id }) => id));

  return rooms.map((snapshot) => {
    const projection = snapshot.walls.find(({ id }) => id === referenceWall.id);
    if (!projection) return snapshot;
    const sameDirection = projection.startVertexId === referenceWall.startVertexId
      && projection.endVertexId === referenceWall.endVertexId;
    const state = sameDirection
      ? referenceState
      : invertWallSegmentAndProfiles(referenceState, wallLength(snapshot.vertices, projection));
    const nextProjection: Wall = {
      ...projection,
      startVertexId: state.wall.startVertexId,
      endVertexId: state.wall.endVertexId,
      thicknessCm: state.wall.thicknessCm,
      material: state.wall.material,
      insulation: state.wall.insulation,
      notes: state.wall.notes,
      pieceIds: [...state.wall.pieceIds],
      heightProfilesLinked: state.wall.heightProfilesLinked,
      heightProfiles: state.profiles,
    };
    return {
      ...snapshot,
      walls: snapshot.walls.map((wall) => wall.id === referenceWall.id ? nextProjection : wall),
      openings: [
        ...snapshot.openings.filter((opening) => (
          opening.wallId !== referenceWall.id && !referenceOpeningIds.has(opening.id)
        )),
        ...openings.map((opening) => ({ ...opening })),
      ],
    };
  });
}

export function setSharedVertexLock(
  rooms: readonly RoomSnapshot[],
  vertexIds: ReadonlySet<string>,
  locked: boolean,
): RoomSnapshot[] {
  return rooms.map((snapshot) => {
    let changed = false;
    const vertices = snapshot.vertices.map((vertex): Vertex => {
      if (!vertexIds.has(vertex.id) || vertex.isLocked === locked) return vertex;
      changed = true;
      return { ...vertex, isLocked: locked };
    });
    return changed ? {
      ...snapshot,
      room: { ...snapshot.room, isLocked: roomLockState(vertices) },
      vertices,
      walls: snapshot.walls.map((wall) => ({
        ...wall,
        isLocked: wallLockState(wall, vertices),
      })),
    } : snapshot;
  });
}

export function assertOpeningValidInLevel(
  rooms: readonly RoomSnapshot[],
  opening: Opening,
): void {
  const context = findWallEditorContext(rooms, opening.wallId);
  if (!context?.projection.heightProfiles) throw new Error('Les profils du mur support sont introuvables.');
  const owner = rooms.find(({ room }) => room.id === context.ownerRoomId);
  const template = opening.templateId ? owner?.openingTemplates?.[opening.templateId] : undefined;
  if (!template || !opening.templateId || !opening.openingKind || !opening.placementType) {
    throw new Error('L’ouverture ne possède pas toutes ses données canoniques.');
  }
  const topologyOpening: TopologyOpening = {
    id: opening.id,
    wallId: opening.wallId,
    templateId: opening.templateId,
    type: opening.openingKind,
    placementType: opening.placementType,
    positionCm: opening.offsetCm,
    widthCm: opening.widthCm,
    heightCm: opening.heightCm,
    bottomCm: opening.bottomCm,
    orientation: opening.orientation,
    hingeSide: opening.hingeSide,
  };
  const siblings = owner?.openings
    .filter((candidate) => candidate.id !== opening.id && candidate.templateId && candidate.openingKind && candidate.placementType)
    .map((candidate): TopologyOpening => ({
      id: candidate.id,
      wallId: candidate.wallId,
      templateId: candidate.templateId!,
      type: candidate.openingKind!,
      placementType: candidate.placementType!,
      positionCm: candidate.offsetCm,
      widthCm: candidate.widthCm,
      heightCm: candidate.heightCm,
      bottomCm: candidate.bottomCm,
      orientation: candidate.orientation,
      hingeSide: candidate.hingeSide,
    })) ?? [];
  const [issue] = validateOpening(topologyOpening, {
    wall: topologyWallFromProjection(context.projection),
    profiles: context.projection.heightProfiles,
    wallLengthCm: context.lengthCm,
    template,
    siblingOpenings: siblings,
  });
  if (issue) throw new Error(issue.message);
}

function wallLength(vertices: readonly Vertex[], wall: Pick<Wall, 'startVertexId' | 'endVertexId'>) {
  const start = vertices.find(({ id }) => id === wall.startVertexId);
  const end = vertices.find(({ id }) => id === wall.endVertexId);
  if (!start || !end) throw new Error('Le mur référence un sommet absent.');
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function opposite(side: WallFaceSide): WallFaceSide {
  return side === 'gauche' ? 'droite' : 'gauche';
}
