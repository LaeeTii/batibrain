import {
  loadLevelGeometry,
  saveLevelGeometry,
  type PersistedLevelGeometry,
} from '../data/supabase/transactions';
import {
  assertLevelGeometrySnapshot,
  type GeometryPiece,
  type GeometryVertex,
  type LevelGeometrySnapshot,
} from '../domain/levelGeometry';
import { DEFAULT_ROOM_FLOOR_COLOR, DEFAULT_ROOM_TYPE } from '../domain/room';
import { normalizeCoordinateCm } from '../domain/roomOverlap';
import type {
  Opening,
  OpeningKind,
  OpeningPlacementType,
  OpeningTemplate,
  Room,
  RoomType,
  TopologyOpening,
  TopologyWall,
  Vertex,
  Wall,
  WallFaceSide,
  WallHeightProfilePoint,
  WallHeightProfiles,
} from '../domain/types';
import { createStableWallFaces } from '../domain/wall';
import {
  createUniformWallHeightProfiles,
  invertWallSegmentAndProfiles,
} from '../domain/wallHeightProfile';
import { getSupabaseClient } from '../lib/supabase';

type PieceRow = {
  id: string;
  level_id: string;
  name: string;
  room_type: RoomType;
  floor_color: string;
  notes: string | null;
  is_soft_deleted: boolean;
};

type RawVertex = {
  id: string;
  x_cm: number | string;
  y_cm: number | string;
  is_locked: boolean;
};

type RawPiece = {
  id: string;
  name: string;
  room_type: RoomType;
  floor_color: string;
  wall_thickness_cm: number | string;
  wall_height_cm: number | string;
  notes: string | null;
  is_soft_deleted: boolean;
  vertex_ids: string[];
};

type RawHeightPoint = {
  id: string;
  point_order: number;
  position_cm: number | string;
  height_cm: number | string;
  is_locked: boolean;
};

type RawWall = {
  id: string;
  start_vertex_id: string;
  end_vertex_id: string;
  thickness_cm: number | string | null;
  height_profiles_linked: boolean;
  material: string | null;
  insulation: string | null;
  notes: string | null;
  piece_ids: string[];
  profiles: {
    gauche: RawHeightPoint[];
    droite: RawHeightPoint[];
  };
};

type RawOpening = {
  id: string;
  wall_id: string;
  template_id: string;
  opening_type: OpeningKind;
  placement_type: OpeningPlacementType;
  position_cm: number | string;
  width_cm: number | string;
  bottom_cm: number | string;
  height_cm: number | string;
  orientation: string | null;
  notes: string | null;
};

type RawTemplate = {
  id: string;
  name: string;
  opening_type: OpeningKind;
  placement_type: OpeningPlacementType;
};

type RawLevelGeometry = {
  level_id: string;
  revision: number | string;
  vertices: RawVertex[];
  pieces: RawPiece[];
  walls: RawWall[];
  openings: RawOpening[];
  templates: RawTemplate[];
};

export interface RoomSnapshot {
  room: Room;
  vertices: Vertex[];
  walls: Wall[];
  openings: Opening[];
  geometryRevision?: number;
  openingTemplates?: Record<string, OpeningTemplate>;
  unlockedVertexIds?: string[];
  unlockedProfilePointIds?: string[];
}

export interface LevelRoomSnapshot {
  levelId: string;
  revision: number;
  rooms: RoomSnapshot[];
}

export interface CreateRoomInput {
  id?: string;
  levelId: string;
  name: string;
  type?: RoomType;
  floorColor?: string;
  notes?: string | null;
}

function mapPieceRow(row: PieceRow): Room {
  return {
    id: row.id,
    levelId: row.level_id,
    name: row.name,
    type: row.room_type,
    floorColor: row.floor_color,
    notes: row.notes,
    isSoftDeleted: row.is_soft_deleted,
  };
}

export async function getRoom(roomId: string): Promise<Room> {
  const { data, error } = await getSupabaseClient()
    .from('pieces')
    .select('id, level_id, name, room_type, floor_color, notes, is_soft_deleted')
    .eq('id', roomId)
    .single();
  if (error) throw error;
  return mapPieceRow(data as PieceRow);
}

export async function listRoomsByLevel(levelId: string): Promise<Room[]> {
  const { data, error } = await getSupabaseClient()
    .from('pieces')
    .select('id, level_id, name, room_type, floor_color, notes, is_soft_deleted')
    .eq('level_id', levelId)
    .eq('is_soft_deleted', false)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((row) => mapPieceRow(row as PieceRow));
}

export async function loadLevelGeometrySnapshot(levelId: string): Promise<LevelRoomSnapshot> {
  const raw = await loadLevelGeometry<RawLevelGeometry>(getSupabaseClient(), levelId);
  return projectRawLevelGeometry(raw);
}

export async function loadLevelRoomSnapshots(levelId: string): Promise<RoomSnapshot[]> {
  return (await loadLevelGeometrySnapshot(levelId)).rooms;
}

export async function loadRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  const room = await getRoom(roomId);
  const level = await loadLevelGeometrySnapshot(room.levelId);
  const snapshot = level.rooms.find(({ room: candidate }) => candidate.id === roomId);
  if (!snapshot) throw new Error('La pièce demandée n’existe plus.');
  return snapshot;
}

export async function updateRoom(room: Room): Promise<Room> {
  const { data, error } = await getSupabaseClient()
    .from('pieces')
    .update({
      name: room.name,
      room_type: room.type,
      floor_color: room.floorColor,
      notes: room.notes ?? null,
    })
    .eq('id', room.id)
    .select('id, level_id, name, room_type, floor_color, notes, is_soft_deleted')
    .single();
  if (error) throw error;
  return mapPieceRow(data as PieceRow);
}

export async function saveLevelRoomSnapshots(
  levelId: string,
  snapshots: readonly RoomSnapshot[],
  expectedRevision?: number,
): Promise<LevelRoomSnapshot> {
  const canonical = roomSnapshotsToCanonical(
    levelId,
    expectedRevision ?? snapshots[0]?.geometryRevision ?? 0,
    snapshots,
  );
  assertLevelGeometrySnapshot(canonical);
  const saved = await saveLevelGeometry<RawLevelGeometry>(
    getSupabaseClient(),
    levelId,
    canonical.revision,
    canonicalToPersisted(canonical),
  );
  return projectRawLevelGeometry(saved);
}

export async function createRoomComplete(snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const current = await loadLevelGeometrySnapshot(snapshot.room.levelId);
  const saved = await saveLevelRoomSnapshots(
    snapshot.room.levelId,
    [...current.rooms, snapshot],
    current.revision,
  );
  return saved.rooms.find(({ room }) => room.id === snapshot.room.id) ?? snapshot;
}

export async function updateRoomGeometry(snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const current = await loadLevelGeometrySnapshot(snapshot.room.levelId);
  const nextRooms = current.rooms.map((candidate) => (
    candidate.room.id === snapshot.room.id ? snapshot : candidate
  ));
  const saved = await saveLevelRoomSnapshots(snapshot.room.levelId, nextRooms, current.revision);
  const persisted = saved.rooms.find(({ room }) => room.id === snapshot.room.id);
  if (!persisted) throw new Error('La pièce sauvegardée n’a pas été relue.');
  return persisted;
}

export async function replaceRoomGeometriesAtomically(
  levelId: string,
  replacedRoomIds: string[],
  snapshots: RoomSnapshot[],
): Promise<RoomSnapshot[]> {
  const current = await loadLevelGeometrySnapshot(levelId);
  const replaced = new Set(replacedRoomIds);
  const saved = await saveLevelRoomSnapshots(
    levelId,
    [...current.rooms.filter(({ room }) => !replaced.has(room.id)), ...snapshots],
    current.revision,
  );
  const resultIds = new Set(snapshots.map(({ room }) => room.id));
  return saved.rooms.filter(({ room }) => resultIds.has(room.id));
}

export async function softDeleteRoom(roomId: string): Promise<void> {
  const room = await getRoom(roomId);
  const current = await loadLevelGeometrySnapshot(room.levelId);
  await saveLevelRoomSnapshots(
    room.levelId,
    current.rooms.filter(({ room: candidate }) => candidate.id !== roomId),
    current.revision,
  );
}

export const deleteRoom = softDeleteRoom;

export async function createRoom(_room: CreateRoomInput): Promise<Room> {
  throw new Error('La création sans géométrie canonique est désactivée.');
}

export async function replaceRoomVertices(
  _roomId: string,
  _vertices: Vertex[],
): Promise<Vertex[]> {
  throw new Error('Le chemin legacy de sauvegarde des sommets est désactivé.');
}

export async function replaceRoomWalls(
  _roomId: string,
  _vertices: Vertex[],
  _walls: Wall[],
): Promise<Wall[]> {
  throw new Error('Le chemin legacy de sauvegarde des murs est désactivé.');
}

export async function replaceRoomOpenings(
  _vertices: Vertex[],
  _walls: Wall[],
  _openings: Opening[],
): Promise<Opening[]> {
  throw new Error('Le chemin legacy de sauvegarde des ouvertures est désactivé.');
}

function projectRawLevelGeometry(raw: RawLevelGeometry): LevelRoomSnapshot {
  const revision = Number(raw.revision);
  const verticesById = new Map(raw.vertices.map((vertex) => [vertex.id, {
    id: vertex.id,
    x: Number(vertex.x_cm),
    y: Number(vertex.y_cm),
    isLocked: vertex.is_locked,
  }]));
  const templatesById = Object.fromEntries(raw.templates.map((template) => [template.id, {
    id: template.id,
    name: template.name,
    type: template.opening_type,
    placementType: template.placement_type,
  } satisfies OpeningTemplate]));
  const wallsById = new Map(raw.walls.map((wall) => {
    const topologyWall: TopologyWall = {
      id: wall.id,
      startVertexId: wall.start_vertex_id,
      endVertexId: wall.end_vertex_id,
      faces: createStableWallFaces(),
      pieceIds: [...wall.piece_ids],
      thicknessCm: wall.thickness_cm === null ? null : Number(wall.thickness_cm),
      material: wall.material,
      insulation: wall.insulation,
      notes: wall.notes,
      heightProfilesLinked: wall.height_profiles_linked,
    };
    return [wall.id, {
      wall: topologyWall,
      profiles: mapProfiles(wall),
    }];
  }));

  const openingsByWallId = new Map<string, Opening[]>();
  for (const opening of raw.openings) {
    const current = openingsByWallId.get(opening.wall_id) ?? [];
    current.push({
      id: opening.id,
      wallId: opening.wall_id,
      type: legacyOpeningType(opening.opening_type),
      openingKind: opening.opening_type,
      templateId: opening.template_id,
      placementType: opening.placement_type,
      offsetCm: Number(opening.position_cm),
      widthCm: Number(opening.width_cm),
      bottomCm: Number(opening.bottom_cm),
      heightCm: Number(opening.height_cm),
      orientation: opening.orientation,
      notes: opening.notes,
    });
    openingsByWallId.set(opening.wall_id, current);
  }

  const rooms = raw.pieces.map((piece): RoomSnapshot => {
    const vertices = piece.vertex_ids.map((vertexId, order): Vertex => {
      const vertex = verticesById.get(vertexId);
      if (!vertex) throw new Error('Le contour chargé référence un sommet absent.');
      return {
        ...vertex,
        pieceId: piece.id,
        order,
      };
    });
    const localWalls = piece.vertex_ids.map((startVertexId, index): Wall => {
      const endVertexId = piece.vertex_ids[(index + 1) % piece.vertex_ids.length];
      const found = [...wallsById.values()].find(({ wall }) => (
        wall.pieceIds.includes(piece.id)
        && sameSegment(wall.startVertexId, wall.endVertexId, startVertexId, endVertexId)
      ));
      if (!found) throw new Error('Une arête chargée ne possède pas de mur canonique.');
      const start = verticesById.get(found.wall.startVertexId)!;
      const end = verticesById.get(found.wall.endVertexId)!;
      const lengthCm = Math.hypot(end.x - start.x, end.y - start.y);
      const state = found.wall.startVertexId === startVertexId
        ? { wall: found.wall, profiles: found.profiles }
        : invertWallSegmentAndProfiles({
          wall: found.wall,
          profiles: found.profiles,
        }, lengthCm);
      return {
        id: state.wall.id,
        pieceId: piece.id,
        startVertexId,
        endVertexId,
        thicknessCm: state.wall.thicknessCm,
        heightLeftCm: state.profiles.gauche[0]?.heightCm ?? null,
        heightRightCm: state.profiles.droite[0]?.heightCm ?? null,
        material: state.wall.material,
        insulation: state.wall.insulation,
        notes: state.wall.notes,
        pieceIds: [...state.wall.pieceIds],
        heightProfilesLinked: state.wall.heightProfilesLinked,
        heightProfiles: state.profiles,
        isLocked: verticesById.get(startVertexId)?.isLocked === true
          && verticesById.get(endVertexId)?.isLocked === true,
      };
    });
    const localWallIds = new Set(localWalls.map(({ id }) => id));
    return {
      room: {
        id: piece.id,
        levelId: raw.level_id,
        name: piece.name,
        type: piece.room_type,
        floorColor: piece.floor_color,
        notes: piece.notes,
        isSoftDeleted: piece.is_soft_deleted,
        isLocked: vertices.length > 0 && vertices.every(({ isLocked }) => isLocked === true),
      },
      vertices,
      walls: localWalls,
      openings: [...localWallIds].flatMap((wallId) => openingsByWallId.get(wallId) ?? []),
      geometryRevision: revision,
      openingTemplates: templatesById,
    };
  });

  return { levelId: raw.level_id, revision, rooms };
}

function roomSnapshotsToCanonical(
  levelId: string,
  revision: number,
  snapshots: readonly RoomSnapshot[],
): LevelGeometrySnapshot {
  const verticesById = new Map<string, GeometryVertex>();
  const pieces: GeometryPiece[] = [];
  const wallsById = new Map<string, TopologyWall>();
  const profilesByWallId: Record<string, WallHeightProfiles> = {};
  const openingsById = new Map<string, TopologyOpening>();
  const templatesById: Record<string, OpeningTemplate> = {};
  const unlockedVertexIds = new Set<string>();
  const unlockedProfilePointIds = new Set<string>();

  for (const snapshot of snapshots) {
    Object.assign(templatesById, snapshot.openingTemplates ?? {});
    snapshot.unlockedVertexIds?.forEach((id) => unlockedVertexIds.add(id));
    snapshot.unlockedProfilePointIds?.forEach((id) => unlockedProfilePointIds.add(id));
    pieces.push({
      room: {
        ...snapshot.room,
        levelId,
        isLocked: undefined,
      },
      vertexIds: [...snapshot.vertices]
        .sort((left, right) => left.order - right.order)
        .map(({ id }) => id),
    });
    for (const vertex of snapshot.vertices) {
      const current = verticesById.get(vertex.id);
      const next: GeometryVertex = {
        id: vertex.id,
        levelId,
        x: normalizeCoordinateCm(vertex.x),
        y: normalizeCoordinateCm(vertex.y),
        isLocked: vertex.isLocked === true,
      };
      if (
        current
        && (current.x !== next.x || current.y !== next.y || current.isLocked !== next.isLocked)
      ) {
        throw new Error('Un sommet partagé doit conserver les mêmes coordonnées et le même verrou.');
      }
      verticesById.set(vertex.id, next);
    }
  }

  for (const snapshot of snapshots) {
    const vertices = new Map(snapshot.vertices.map((vertex) => [vertex.id, vertex]));
    for (const wall of snapshot.walls) {
      const start = vertices.get(wall.startVertexId);
      const end = vertices.get(wall.endVertexId);
      if (!start || !end) throw new Error('Un mur référence un sommet absent de sa pièce.');
      const existing = wallsById.get(wall.id);
      const pieceIds = [...new Set([...(existing?.pieceIds ?? wall.pieceIds ?? []), snapshot.room.id])];
      const topologyWall: TopologyWall = {
        id: wall.id,
        startVertexId: wall.startVertexId,
        endVertexId: wall.endVertexId,
        faces: createStableWallFaces(),
        pieceIds,
        thicknessCm: wall.thicknessCm ?? 10,
        material: wall.material ?? null,
        insulation: wall.insulation ?? null,
        notes: wall.notes ?? null,
        heightProfilesLinked: wall.heightProfilesLinked ?? true,
      };
      if (pieceIds.length > 2) throw new Error('Un mur ne peut pas être lié à trois pièces.');
      if (!existing) {
        wallsById.set(wall.id, topologyWall);
        profilesByWallId[wall.id] = wall.heightProfiles
          ? cloneProfiles(wall.heightProfiles)
          : createUniformWallHeightProfiles(
            wall.id,
            Math.hypot(end.x - start.x, end.y - start.y),
            wall.heightLeftCm ?? wall.heightRightCm ?? 250,
          );
      } else {
        wallsById.set(wall.id, { ...existing, pieceIds });
      }
    }
  }

  const compatibleWallIds = new Set(
    [...wallsById.values()]
      .filter(({ pieceIds }) => pieceIds.length === 1 || pieceIds.length === 2)
      .map(({ id }) => id),
  );
  for (const snapshot of snapshots) {
    for (const opening of snapshot.openings) {
      if (!compatibleWallIds.has(opening.wallId)) continue;
      const wall = wallsById.get(opening.wallId);
      if (!wall || !opening.templateId || !opening.openingKind || !opening.placementType) {
        throw new Error('Une ouverture canonique doit conserver son template et son placement.');
      }
      const compatible = (opening.placementType === 'intérieur' && wall.pieceIds.length === 2)
        || (opening.placementType === 'extérieur' && wall.pieceIds.length === 1);
      if (!compatible) continue;
      openingsById.set(opening.id, {
        id: opening.id,
        wallId: opening.wallId,
        templateId: opening.templateId,
        type: opening.openingKind,
        placementType: opening.placementType,
        positionCm: opening.offsetCm,
        widthCm: opening.widthCm,
        heightCm: opening.heightCm,
        bottomCm: opening.bottomCm,
        orientation: opening.orientation ?? null,
      });
    }
  }

  return {
    levelId,
    revision,
    vertices: [...verticesById.values()],
    pieces,
    walls: [...wallsById.values()],
    profilesByWallId,
    openings: [...openingsById.values()],
    templatesById,
    unlockedVertexIds: [...unlockedVertexIds],
    unlockedProfilePointIds: [...unlockedProfilePointIds],
  };
}

function canonicalToPersisted(snapshot: LevelGeometrySnapshot): PersistedLevelGeometry {
  return {
    vertices: snapshot.vertices.map((vertex) => ({
      id: vertex.id,
      x_cm: vertex.x,
      y_cm: vertex.y,
      is_locked: vertex.isLocked,
    })),
    pieces: snapshot.pieces.map(({ room, vertexIds }) => {
      const walls = snapshot.walls.filter(({ pieceIds }) => pieceIds.includes(room.id));
      const defaultWall = walls[0];
      const defaultProfile = defaultWall ? snapshot.profilesByWallId[defaultWall.id] : undefined;
      return {
        id: room.id,
        name: room.name.trim() || 'Nouvelle pièce',
        room_type: room.type,
        floor_color: room.floorColor || DEFAULT_ROOM_FLOOR_COLOR,
        wall_thickness_cm: defaultWall?.thicknessCm ?? 10,
        wall_height_cm: defaultProfile?.gauche[0]?.heightCm ?? 250,
        notes: room.notes ?? null,
        vertex_ids: vertexIds,
      };
    }),
    walls: snapshot.walls.map((wall) => ({
      id: wall.id,
      start_vertex_id: wall.startVertexId,
      end_vertex_id: wall.endVertexId,
      thickness_cm: wall.thicknessCm ?? 10,
      height_profiles_linked: wall.heightProfilesLinked,
      material: wall.material,
      insulation: wall.insulation,
      notes: wall.notes,
      piece_ids: wall.pieceIds,
      profiles: {
        gauche: snapshot.profilesByWallId[wall.id].gauche.map(toPersistedHeightPoint),
        droite: snapshot.profilesByWallId[wall.id].droite.map(toPersistedHeightPoint),
      },
    })),
    openings: snapshot.openings.map((opening) => ({
      id: opening.id,
      wall_id: opening.wallId,
      template_id: opening.templateId,
      opening_type: opening.type,
      placement_type: opening.placementType,
      position_cm: opening.positionCm,
      width_cm: opening.widthCm,
      bottom_cm: opening.bottomCm,
      height_cm: opening.heightCm,
      orientation: opening.orientation,
      notes: null,
    })),
    unlocked_vertex_ids: snapshot.unlockedVertexIds,
    unlocked_profile_point_ids: snapshot.unlockedProfilePointIds,
  };
}

function mapProfiles(wall: RawWall): WallHeightProfiles {
  return {
    wallId: wall.id,
    gauche: wall.profiles.gauche.map((point) => mapHeightPoint(wall.id, 'gauche', point)),
    droite: wall.profiles.droite.map((point) => mapHeightPoint(wall.id, 'droite', point)),
  };
}

function mapHeightPoint(
  wallId: string,
  faceSide: WallFaceSide,
  point: RawHeightPoint,
): WallHeightProfilePoint {
  return {
    id: point.id,
    wallId,
    faceSide,
    order: point.point_order,
    positionCm: Number(point.position_cm),
    heightCm: Number(point.height_cm),
    isLocked: point.is_locked,
  };
}

function toPersistedHeightPoint(point: WallHeightProfilePoint) {
  return {
    id: point.id,
    point_order: point.order,
    position_cm: point.positionCm,
    height_cm: point.heightCm,
    is_locked: point.isLocked === true,
  };
}

function cloneProfiles(profiles: WallHeightProfiles): WallHeightProfiles {
  return {
    wallId: profiles.wallId,
    gauche: profiles.gauche.map((point) => ({ ...point })),
    droite: profiles.droite.map((point) => ({ ...point })),
  };
}

function legacyOpeningType(type: OpeningKind): Opening['type'] {
  if (type === 'porte') return 'door';
  if (type === 'fenêtre' || type === 'baie_vitree') return 'window';
  return 'other';
}

function sameSegment(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
) {
  return (leftStart === rightStart && leftEnd === rightEnd)
    || (leftStart === rightEnd && leftEnd === rightStart);
}

export function createDraftRoom(input: CreateRoomInput): Room {
  return {
    id: input.id ?? crypto.randomUUID(),
    levelId: input.levelId,
    name: input.name.trim() || 'Nouvelle pièce',
    type: input.type ?? DEFAULT_ROOM_TYPE,
    floorColor: input.floorColor?.trim() || DEFAULT_ROOM_FLOOR_COLOR,
    notes: input.notes ?? null,
    isSoftDeleted: false,
    isLocked: false,
  };
}
