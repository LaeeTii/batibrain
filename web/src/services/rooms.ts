import { remapWallsToVertices, sortVertices, syncWallsWithVertices } from '../../../shared/src/geometry';
import type { Room, Vertex, Wall } from '../../../shared/src/types';
import { getSupabaseClient } from '../lib/supabase';

type PieceRow = {
  id: string;
  level_id: string;
  name: string;
  notes: string | null;
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
};

export interface RoomSnapshot {
  room: Room;
  vertices: Vertex[];
  walls: Wall[];
}

export interface CreateRoomInput {
  id?: string;
  levelId: string;
  name: string;
  notes?: string | null;
}

function mapPieceRow(row: PieceRow): Room {
  return {
    id: row.id,
    levelId: row.level_id,
    name: row.name,
    notes: row.notes,
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
  };
}

function toPieceRow(room: Room): PieceRow {
  return {
    id: room.id,
    level_id: room.levelId,
    name: room.name,
    notes: room.notes ?? null,
  };
}

function toPieceInsertRow(room: CreateRoomInput): Partial<PieceRow> {
  return {
    ...(room.id ? { id: room.id } : {}),
    level_id: room.levelId,
    name: room.name,
    notes: room.notes ?? null,
  };
}

function toPieceVertexRows(roomId: string, vertices: Vertex[]): PieceVertexRow[] {
  return sortVertices(vertices).map((vertex, index) => ({
    id: vertex.id,
    piece_id: roomId,
    vertex_order: index,
    x_cm: vertex.x,
    y_cm: vertex.y,
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

export async function getRoom(roomId: string): Promise<Room> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pieces')
    .select('id, level_id, name, notes')
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
    .select('id, level_id, name, notes')
    .eq('level_id', levelId)
    .order('created_at');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapPieceRow(row as PieceRow));
}

export async function loadRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  const supabase = getSupabaseClient();
  const room = await getRoom(roomId);

  const { data: vertices, error: verticesError } = await supabase
    .from('piece_vertices')
    .select('id, piece_id, vertex_order, x_cm, y_cm')
    .eq('piece_id', roomId)
    .order('vertex_order');

  if (verticesError) {
    throw verticesError;
  }

  const mappedVertices = (vertices ?? []).map((row) => mapPieceVertexRow(row as PieceVertexRow));

  const { data: walls, error: wallsError } = await supabase
    .from('walls')
    .select('id, piece_id, start_vertex_id, end_vertex_id, thickness_cm, height_left_cm, height_right_cm, material, insulation, notes')
    .eq('piece_id', roomId);

  if (wallsError) {
    throw wallsError;
  }

  return {
    room,
    vertices: mappedVertices,
    walls: syncWallsWithVertices(
      mappedVertices,
      (walls ?? []).map((row) => mapPieceWallRow(row as PieceWallRow)),
    ),
  };
}

export async function createRoom(room: CreateRoomInput): Promise<Room> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('pieces')
    .insert(toPieceInsertRow(room))
    .select('id, level_id, name, notes')
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
      notes: room.notes ?? null,
    })
    .eq('id', room.id)
    .select('id, level_id, name, notes')
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
    .select('id, level_id, name, notes')
    .single();

  if (error) {
    throw error;
  }

  return mapPieceRow(data as PieceRow);
}

export async function deleteRoom(roomId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('pieces')
    .delete()
    .eq('id', roomId);

  if (error) {
    throw error;
  }
}

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

  return {
    room,
    vertices,
    walls,
  };
}