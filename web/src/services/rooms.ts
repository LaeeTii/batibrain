import {
  createRectangleRoomGeometryFromPoints,
  formatOpeningValidationIssue,
  remapWallsToVertices,
  sortVertices,
  syncOpeningsWithWalls,
  syncWallsWithVertices,
  validateOpenings,
} from '../domain/geometry';
import { DEFAULT_ROOM_FLOOR_COLOR, DEFAULT_ROOM_TYPE } from '../domain/room';
import { normalizeCoordinateCm } from '../domain/roomOverlap';
import type { Opening, Room, RoomType, Vertex, Wall } from '../domain/types';
import { getSupabaseClient } from '../lib/supabase';

type PieceRow = {
  id: string;
  level_id: string;
  name: string;
  room_type: RoomType;
  floor_color: string;
  notes: string | null;
  is_soft_deleted: boolean;
  is_locked?: boolean;
};

type PieceVertexRow = {
  id: string;
  piece_id: string;
  vertex_order: number;
  x_cm: number | string;
  y_cm: number | string;
};

type PieceWallRow = {
  id: string;
  piece_id: string;
  start_vertex_id: string;
  end_vertex_id: string;
  thickness_cm: number | string | null;
  height_left_cm: number | string | null;
  height_right_cm: number | string | null;
  material: string | null;
  insulation: string | null;
  notes: string | null;
  is_locked?: boolean;
};

type PieceOpeningRow = {
  id: string;
  wall_id: string;
  opening_type: Opening['type'];
  offset_cm: number | string;
  width_cm: number | string;
  bottom_cm: number | string;
  height_cm: number | string;
  notes: string | null;
  is_locked?: boolean;
};

type CurrentWallRow = {
  id: string;
  start_vertex_id: string;
  end_vertex_id: string;
  thickness_cm: number | string | null;
  material: string | null;
  insulation: string | null;
  notes: string | null;
  is_locked: boolean;
};

type WallPieceRelationRow = { wall_id: string; piece_id: string };
type WallEndpointRow = { id: string; x_cm: number | string; y_cm: number | string };

type WallHeightPointRow = { wall_id: string; face_side: 'gauche' | 'droite'; point_order: number; height_cm: number | string };
type CurrentOpeningRow = Omit<PieceOpeningRow, 'opening_type' | 'offset_cm'> & { opening_type: string; position_cm: number | string };

export interface RoomSnapshot {
  room: Room;
  vertices: Vertex[];
  walls: Wall[];
  openings: Opening[];
}

export interface CreateRoomInput {
  id?: string;
  levelId: string;
  name: string;
  type?: RoomType;
  floorColor?: string;
  notes?: string | null;
}

export async function createRectangleRoom(input: CreateRoomInput & { firstPoint: { x: number; y: number }; secondPoint: { x: number; y: number }; wallThicknessCm: number; wallHeightCm: number }): Promise<RoomSnapshot> {
  const id = input.id ?? crypto.randomUUID();
  const geometry = createRectangleRoomGeometryFromPoints(id, input.firstPoint, input.secondPoint, { wallThicknessCm: input.wallThicknessCm, wallHeightCm: input.wallHeightCm });
  return saveRoomSnapshot({
    room: {
      id,
      levelId: input.levelId,
      name: input.name.trim() || 'Nouvelle pièce',
      type: input.type ?? DEFAULT_ROOM_TYPE,
      floorColor: input.floorColor?.trim() || DEFAULT_ROOM_FLOOR_COLOR,
      notes: input.notes ?? null,
      isSoftDeleted: false,
      isLocked: false,
    },
    vertices: geometry.vertices,
    walls: geometry.walls,
    openings: [],
  });
}

export async function updateRoomGeometryAtomically(snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  return saveRoomSnapshot(snapshot);
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
    isLocked: row.is_locked === true,
  };
}

function mapPieceVertexRow(row: PieceVertexRow): Vertex {
  return {
    id: row.id,
    pieceId: row.piece_id,
    order: row.vertex_order,
    x: Number(row.x_cm),
    y: Number(row.y_cm),
  };
}

function mapPieceWallRow(row: PieceWallRow): Wall {
  return {
    id: row.id,
    pieceId: row.piece_id,
    startVertexId: row.start_vertex_id,
    endVertexId: row.end_vertex_id,
    thicknessCm: row.thickness_cm === null ? null : Number(row.thickness_cm),
    heightLeftCm: row.height_left_cm === null ? null : Number(row.height_left_cm),
    heightRightCm: row.height_right_cm === null ? null : Number(row.height_right_cm),
    material: row.material,
    insulation: row.insulation,
    notes: row.notes,
    isLocked: row.is_locked === true,
  };
}

function mapPieceOpeningRow(row: PieceOpeningRow): Opening {
  return {
    id: row.id,
    wallId: row.wall_id,
    type: row.opening_type,
    offsetCm: Number(row.offset_cm),
    widthCm: Number(row.width_cm),
    bottomCm: Number(row.bottom_cm),
    heightCm: Number(row.height_cm),
    notes: row.notes,
    isLocked: row.is_locked === true,
  };
}

function mapCurrentOpeningRow(row: CurrentOpeningRow): Opening {
  const type: Opening['type'] = row.opening_type === 'porte'
    ? 'door'
    : row.opening_type === 'fenêtre' || row.opening_type === 'baie_vitree' ? 'window' : 'other';
  return mapPieceOpeningRow({ ...row, opening_type: type, offset_cm: row.position_cm });
}

function toPieceRow(room: Room): PieceRow {
  return {
    id: room.id,
    level_id: room.levelId,
    name: room.name,
    room_type: room.type,
    floor_color: room.floorColor,
    notes: room.notes ?? null,
    is_soft_deleted: room.isSoftDeleted ?? false,
  };
}

function toPieceInsertRow(room: CreateRoomInput): Partial<PieceRow> {
  return {
    ...(room.id ? { id: room.id } : {}),
    level_id: room.levelId,
    name: room.name,
    room_type: room.type ?? DEFAULT_ROOM_TYPE,
    floor_color: room.floorColor?.trim() || DEFAULT_ROOM_FLOOR_COLOR,
    notes: room.notes ?? null,
    is_soft_deleted: false,
  };
}

function toPieceVertexRows(roomId: string, vertices: Vertex[]): PieceVertexRow[] {
  return sortVertices(vertices).map((vertex, index) => ({
    id: vertex.id,
    piece_id: roomId,
    vertex_order: index,
    x_cm: normalizeCoordinateCm(vertex.x),
    y_cm: normalizeCoordinateCm(vertex.y),
  }));
}

function toPieceWallRows(roomId: string, vertices: Vertex[], walls: Wall[]): PieceWallRow[] {
  return syncWallsWithVertices(vertices, walls).map((wall) => ({
    id: wall.id,
    piece_id: roomId,
    start_vertex_id: wall.startVertexId,
    end_vertex_id: wall.endVertexId,
    thickness_cm: wall.thicknessCm ?? null,
    height_left_cm: wall.heightLeftCm ?? null,
    height_right_cm: wall.heightRightCm ?? null,
    material: wall.material ?? null,
    insulation: wall.insulation ?? null,
    notes: wall.notes ?? null,
  }));
}

function toPieceOpeningRows(walls: Wall[], openings: Opening[]): PieceOpeningRow[] {
  return syncOpeningsWithWalls(walls, openings).map((opening) => ({
    id: opening.id,
    wall_id: opening.wallId,
    opening_type: opening.type,
    offset_cm: opening.offsetCm,
    width_cm: opening.widthCm,
    bottom_cm: opening.bottomCm,
    height_cm: opening.heightCm,
    notes: opening.notes ?? null,
  }));
}

export async function getRoom(roomId: string): Promise<Room> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pieces')
    .select('id, level_id, name, room_type, floor_color, notes, is_soft_deleted, is_locked')
    .eq('id', roomId)
    .single();

  if (error) {
    throw error;
  }

  return mapPieceRow(data as PieceRow);
}

export async function listRoomsByLevel(levelId: string): Promise<Room[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pieces')
    .select('id, level_id, name, room_type, floor_color, notes, is_soft_deleted, is_locked')
    .eq('level_id', levelId)
    .eq('is_soft_deleted', false)
    .order('created_at');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapPieceRow(row as PieceRow));
}

function databaseReadError(context: string, error: { message: string }): Error {
  return new Error(`${context} : ${error.message}`);
}

async function loadSnapshotsForRooms(rooms: Room[]): Promise<RoomSnapshot[]> {
  if (rooms.length === 0) return [];
  const supabase = getSupabaseClient();
  const roomIds = rooms.map(({ id }) => id);

  const [verticesResult, relationsResult] = await Promise.all([
    supabase
      .from('piece_vertices')
      .select('id, piece_id, vertex_order, x_cm, y_cm')
      .in('piece_id', roomIds)
      .order('vertex_order'),
    supabase
      .from('wall_pieces')
      .select('wall_id, piece_id')
      .in('piece_id', roomIds),
  ]);

  if (verticesResult.error) throw databaseReadError('Chargement des sommets impossible', verticesResult.error);
  if (relationsResult.error) throw databaseReadError('Chargement des relations mur–pièce impossible', relationsResult.error);

  const mappedVertices = (verticesResult.data ?? []).map((row) => mapPieceVertexRow(row as PieceVertexRow));
  const wallRelations = (relationsResult.data ?? []) as WallPieceRelationRow[];
  const wallIds = [...new Set(wallRelations.map(({ wall_id }) => wall_id))];

  const { data: walls, error: wallsError } = wallIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('walls')
      .select('id, start_vertex_id, end_vertex_id, thickness_cm, material, insulation, notes, is_locked')
      .in('id', wallIds);

  if (wallsError) throw databaseReadError('Chargement des murs impossible', wallsError);

  const rawWalls = (walls ?? []) as CurrentWallRow[];
  const endpointIds = [...new Set(rawWalls.flatMap((wall) => [wall.start_vertex_id, wall.end_vertex_id]))];
  const [endpointsResult, heightsResult, openingsResult] = await Promise.all([
    endpointIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('piece_vertices')
        .select('id, x_cm, y_cm')
        .in('id', endpointIds),
    wallIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('wall_height_points')
        .select('wall_id, face_side, point_order, height_cm')
        .in('wall_id', wallIds)
        .order('point_order'),
    wallIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('openings')
        .select('id, wall_id, opening_type, position_cm, width_cm, bottom_cm, height_cm, notes, is_locked')
        .in('wall_id', wallIds),
  ]);

  if (endpointsResult.error) throw databaseReadError('Chargement des extrémités de murs impossible', endpointsResult.error);
  if (heightsResult.error) throw databaseReadError('Chargement des profils de murs impossible', heightsResult.error);
  if (openingsResult.error) throw databaseReadError('Chargement des ouvertures impossible', openingsResult.error);

  const wallEndpoints = endpointsResult.data;
  const endpointById = new Map((wallEndpoints ?? []).map((row) => {
    const endpoint = row as WallEndpointRow;
    return [endpoint.id, { x: Number(endpoint.x_cm), y: Number(endpoint.y_cm) }];
  }));
  const samePoint = (left: { x: number; y: number }, right: { x: number; y: number }) => Math.hypot(left.x - right.x, left.y - right.y) < 0.005;
  const heights = heightsResult.data as WallHeightPointRow[];
  const openings = (openingsResult.data ?? []).map((row) => mapCurrentOpeningRow(row as CurrentOpeningRow));
  const rawWallsById = new Map(rawWalls.map((wall) => [wall.id, wall]));

  return rooms.map((room) => {
    const roomVertices = sortVertices(mappedVertices.filter(({ pieceId }) => pieceId === room.id));
    const roomWallIds = new Set(wallRelations.filter(({ piece_id }) => piece_id === room.id).map(({ wall_id }) => wall_id));
    const roomRawWalls = [...roomWallIds].flatMap((id) => {
      const wall = rawWallsById.get(id);
      return wall ? [wall] : [];
    });
    const localWalls = roomVertices.map((start, index, sorted) => {
      const end = sorted[(index + 1) % sorted.length];
      const wall = roomRawWalls.find((candidate) => {
        const candidateStart = endpointById.get(candidate.start_vertex_id);
        const candidateEnd = endpointById.get(candidate.end_vertex_id);
        return Boolean(candidateStart && candidateEnd && (
          (samePoint(start, candidateStart) && samePoint(end, candidateEnd))
          || (samePoint(start, candidateEnd) && samePoint(end, candidateStart))
        ));
      });
      if (!wall) {
        // Identité de secours stable : elle permet d’afficher un ancien plan incomplet sans
        // fabriquer un nouvel UUID différent à chaque rechargement.
        return mapPieceWallRow({
          id: start.id,
          piece_id: room.id,
          start_vertex_id: start.id,
          end_vertex_id: end.id,
          thickness_cm: null,
          height_left_cm: null,
          height_right_cm: null,
          material: null,
          insulation: null,
          notes: null,
          is_locked: false,
        });
      }
      const left = heights.find((point) => point.wall_id === wall.id && point.face_side === 'gauche');
      const right = heights.find((point) => point.wall_id === wall.id && point.face_side === 'droite');
      return mapPieceWallRow({ ...wall, piece_id: room.id, start_vertex_id: start.id, end_vertex_id: end.id, height_left_cm: left?.height_cm ?? null, height_right_cm: right?.height_cm ?? null });
    });
    const localWallIds = new Set(localWalls.map(({ id }) => id));
    return {
      room,
      vertices: roomVertices,
      walls: localWalls,
      openings: syncOpeningsWithWalls(localWalls, openings.filter(({ wallId }) => localWallIds.has(wallId))),
    };
  });
}

export async function loadLevelRoomSnapshots(levelId: string): Promise<RoomSnapshot[]> {
  return loadSnapshotsForRooms(await listRoomsByLevel(levelId));
}

export async function loadRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  const [snapshot] = await loadSnapshotsForRooms([await getRoom(roomId)]);
  if (!snapshot) throw new Error('La pièce demandée n’existe plus.');
  return snapshot;
}

export async function createRoom(room: CreateRoomInput): Promise<Room> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pieces')
    .insert(toPieceInsertRow(room))
    .select('id, level_id, name, room_type, floor_color, notes, is_soft_deleted, is_locked')
    .single();

  if (error) {
    throw error;
  }

  return mapPieceRow(data as PieceRow);
}

export async function updateRoom(room: Room): Promise<Room> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pieces')
    .update({
      level_id: room.levelId,
      name: room.name,
      room_type: room.type,
      floor_color: room.floorColor,
      notes: room.notes ?? null,
    })
    .eq('id', room.id)
    .select('id, level_id, name, room_type, floor_color, notes, is_soft_deleted')
    .single();

  if (error) {
    throw error;
  }

  return mapPieceRow(data as PieceRow);
}

export async function saveRoom(room: Room): Promise<Room> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pieces')
    .upsert(toPieceRow(room), { onConflict: 'id' })
    .select('id, level_id, name, room_type, floor_color, notes, is_soft_deleted')
    .single();

  if (error) {
    throw error;
  }

  return mapPieceRow(data as PieceRow);
}

export async function softDeleteRoom(roomId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('pieces')
    .update({ is_soft_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', roomId);

  if (error) {
    throw error;
  }
}

export const deleteRoom = softDeleteRoom;


export async function replaceRoomVertices(roomId: string, vertices: Vertex[]): Promise<Vertex[]> {
  if (vertices.length < 3) {
    throw new Error('Une pièce doit contenir au moins 3 sommets.');
  }

  const supabase = getSupabaseClient();
  const rows = toPieceVertexRows(roomId, vertices);

  const { error: deleteError } = await supabase
    .from('piece_vertices')
    .delete()
    .eq('piece_id', roomId);

  if (deleteError) {
    throw deleteError;
  }

  const { data, error } = await supabase
    .from('piece_vertices')
    .insert(rows)
    .select('id, piece_id, vertex_order, x_cm, y_cm')
    .order('vertex_order');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapPieceVertexRow(row as PieceVertexRow));
}

export async function replaceRoomWalls(
  roomId: string,
  vertices: Vertex[],
  walls: Wall[],
): Promise<Wall[]> {
  const supabase = getSupabaseClient();
  const rows = toPieceWallRows(roomId, vertices, walls);

  const { error: deleteError } = await supabase
    .from('walls')
    .delete()
    .eq('piece_id', roomId);

  if (deleteError) {
    throw deleteError;
  }

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('walls')
    .insert(rows)
    .select('id, piece_id, start_vertex_id, end_vertex_id, thickness_cm, height_left_cm, height_right_cm, material, insulation, notes');

  if (error) {
    throw error;
  }

  return syncWallsWithVertices(
    vertices,
    (data ?? []).map((row) => mapPieceWallRow(row as PieceWallRow)),
  );
}

export async function replaceRoomOpenings(
  vertices: Vertex[],
  walls: Wall[],
  openings: Opening[],
): Promise<Opening[]> {
  const issues = validateOpenings(vertices, walls, openings);
  if (issues.length > 0) {
    throw new Error(formatOpeningValidationIssue(issues[0]));
  }

  const supabase = getSupabaseClient();
  const wallIds = walls.map((wall) => wall.id);

  if (wallIds.length === 0) {
    return [];
  }

  const rows = toPieceOpeningRows(walls, openings);

  const { error: deleteError } = await supabase
    .from('openings')
    .delete()
    .in('wall_id', wallIds);

  if (deleteError) {
    throw deleteError;
  }

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('openings')
    .insert(rows)
    .select('id, wall_id, opening_type, offset_cm, width_cm, bottom_cm, height_cm, notes');

  if (error) {
    throw error;
  }

  return syncOpeningsWithWalls(
    walls,
    (data ?? []).map((row) => mapPieceOpeningRow(row as PieceOpeningRow)),
  );
}

export async function saveRoomSnapshot(snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const room = await saveRoom(snapshot.room);
  const vertices = await replaceRoomVertices(
    room.id,
    snapshot.vertices.map((vertex) => ({
      ...vertex,
      pieceId: room.id,
    })),
  );
  const walls = await replaceRoomWalls(
    room.id,
    vertices,
    remapWallsToVertices(snapshot.vertices, vertices, snapshot.walls),
  );
  const openings = await replaceRoomOpenings(vertices, walls, snapshot.openings);

  return {
    room,
    vertices,
    walls,
    openings,
  };
}

function toGeometryVerticesPayload(vertices: Vertex[]) {
  return sortVertices(vertices).map((vertex, index) => ({
    id: vertex.id,
    vertex_order: index,
    x_cm: normalizeCoordinateCm(vertex.x),
    y_cm: normalizeCoordinateCm(vertex.y),
  }));
}

function buildFlatProfile(heightCm: number, lengthCm: number) {
  const normalizedLength = Math.max(1, lengthCm);
  return [
    {
      id: crypto.randomUUID(),
      point_order: 0,
      position_cm: 0,
      height_cm: heightCm,
    },
    {
      id: crypto.randomUUID(),
      point_order: 1,
      position_cm: normalizedLength,
      height_cm: heightCm,
    },
  ];
}

function toCreatePieceWallsPayload(vertices: Vertex[], walls: Wall[]) {
  const syncedWalls = syncWallsWithVertices(vertices, walls);
  const verticesById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  return syncedWalls.map((wall) => {
    const start = verticesById.get(wall.startVertexId);
    const end = verticesById.get(wall.endVertexId);
    const lengthCm = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 1;
    const leftHeightCm = wall.heightLeftCm ?? wall.heightRightCm ?? 250;
    const rightHeightCm = wall.heightRightCm ?? wall.heightLeftCm ?? 250;
    return {
      id: wall.id,
      start_vertex_id: wall.startVertexId,
      end_vertex_id: wall.endVertexId,
      thickness_cm: wall.thicknessCm ?? 10,
      height_profiles_linked: leftHeightCm === rightHeightCm,
      material: wall.material,
      insulation: wall.insulation,
      notes: wall.notes,
      is_locked: wall.isLocked === true,
      profiles: {
        gauche: buildFlatProfile(leftHeightCm, lengthCm),
        droite: buildFlatProfile(rightHeightCm, lengthCm),
      },
    };
  });
}

function toSharedWallsPayload(snapshots: RoomSnapshot[]) {
  const shared = new Map<string, ReturnType<typeof toCreatePieceWallsPayload>[number] & { piece_ids: string[] }>();
  for (const snapshot of snapshots) {
    for (const wall of toCreatePieceWallsPayload(snapshot.vertices, snapshot.walls)) {
      const current = shared.get(wall.id);
      if (current) {
        current.piece_ids = [...new Set([...current.piece_ids, snapshot.room.id])];
      } else {
        shared.set(wall.id, { ...wall, piece_ids: [snapshot.room.id] });
      }
    }
  }
  return [...shared.values()];
}

export async function updateRoomGeometry(snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('update_piece_geometry_v2', {
    target_piece_id: snapshot.room.id,
    vertices_data: toGeometryVerticesPayload(snapshot.vertices),
  });
  if (error) {
    throw error;
  }
  return loadRoomSnapshot(snapshot.room.id);
}

export async function createRoomComplete(snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const supabase = getSupabaseClient();
  const defaultThicknessCm = snapshot.walls[0]?.thicknessCm ?? 10;
  const defaultHeightCm = snapshot.walls[0]?.heightLeftCm ?? snapshot.walls[0]?.heightRightCm ?? 250;
  const { error } = await supabase.rpc('create_piece_complete', {
    piece_data: {
      id: snapshot.room.id,
      level_id: snapshot.room.levelId,
      name: snapshot.room.name,
      room_type: snapshot.room.type,
      floor_color: snapshot.room.floorColor,
      wall_thickness_cm: defaultThicknessCm,
      wall_height_cm: defaultHeightCm,
      notes: snapshot.room.notes,
      is_soft_deleted: snapshot.room.isSoftDeleted ?? false,
      is_locked: snapshot.room.isLocked ?? false,
    },
    vertices_data: toGeometryVerticesPayload(snapshot.vertices),
    walls_data: toCreatePieceWallsPayload(snapshot.vertices, snapshot.walls),
  });
  if (error) {
    throw error;
  }
  return loadRoomSnapshot(snapshot.room.id);
}

export async function replaceRoomGeometriesAtomically(levelId: string, replacedRoomIds: string[], snapshots: RoomSnapshot[]): Promise<RoomSnapshot[]> {
  const supabase = getSupabaseClient();
  const piecesData = snapshots.map((snapshot) => {
    const defaultThicknessCm = snapshot.walls[0]?.thicknessCm ?? 10;
    const defaultHeightCm = snapshot.walls[0]?.heightLeftCm ?? snapshot.walls[0]?.heightRightCm ?? 250;
    return {
      piece: {
        id: snapshot.room.id,
        level_id: snapshot.room.levelId,
        name: snapshot.room.name,
        room_type: snapshot.room.type,
        floor_color: snapshot.room.floorColor,
        wall_thickness_cm: defaultThicknessCm,
        wall_height_cm: defaultHeightCm,
        notes: snapshot.room.notes,
        is_soft_deleted: false,
        is_locked: snapshot.room.isLocked ?? false,
      },
      vertices: toGeometryVerticesPayload(snapshot.vertices),
      walls: toCreatePieceWallsPayload(snapshot.vertices, snapshot.walls),
    };
  });
  const { error } = await supabase.rpc('replace_piece_topology_v2', {
    target_level_id: levelId,
    replaced_piece_ids: replacedRoomIds,
    pieces_data: piecesData,
    walls_data: toSharedWallsPayload(snapshots),
  });
  if (error) throw error;
  return snapshots.map((snapshot) => ({
    ...snapshot,
    vertices: snapshot.vertices.map((vertex) => ({
      ...vertex,
      x: normalizeCoordinateCm(vertex.x),
      y: normalizeCoordinateCm(vertex.y),
    })),
  }));
}
