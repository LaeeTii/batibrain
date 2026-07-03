import { sortVertices } from '../../../shared/src/geometry';
import type { Room, Vertex } from '../../../shared/src/types';
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

export interface RoomSnapshot {
  room: Room;
  vertices: Vertex[];
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

function toPieceRow(room: Room): PieceRow {
  return {
    id: room.id,
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

  const { data: piece, error: pieceError } = await supabase
    .from('pieces')
    .select('id, level_id, name, notes')
    .eq('id', roomId)
    .single();

  if (pieceError) {
    throw pieceError;
  }

  const { data: vertices, error: verticesError } = await supabase
    .from('piece_vertices')
    .select('id, piece_id, vertex_order, x_cm, y_cm')
    .eq('piece_id', roomId)
    .order('vertex_order');

  if (verticesError) {
    throw verticesError;
  }

  return {
    room: mapPieceRow(piece as PieceRow),
    vertices: (vertices ?? []).map((row) => mapPieceVertexRow(row as PieceVertexRow)),
  };
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

export async function saveRoomSnapshot(snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const room = await saveRoom(snapshot.room);
  const vertices = await replaceRoomVertices(
    room.id,
    snapshot.vertices.map((vertex) => ({
      ...vertex,
      pieceId: room.id,
    })),
  );

  return {
    room,
    vertices,
  };
}