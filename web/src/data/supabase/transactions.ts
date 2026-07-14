import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersistedHeightPoint {
  id?: string;
  point_order: number;
  position_cm: number;
  height_cm: number;
}

export interface PersistedWall {
  id: string;
  start_vertex_id: string;
  end_vertex_id: string;
  thickness_cm: number;
  height_profiles_linked: boolean;
  material?: string | null;
  insulation?: string | null;
  notes?: string | null;
  is_locked: boolean;
  piece_ids: string[];
  profiles: {
    gauche: PersistedHeightPoint[];
    droite: PersistedHeightPoint[];
  };
}

export interface PersistedOpening {
  id: string;
  wall_id: string;
  template_id: string;
  opening_type: string;
  placement_type: 'intérieur' | 'extérieur';
  position_cm: number;
  width_cm: number;
  bottom_cm: number;
  height_cm: number;
  orientation?: string | null;
  notes?: string | null;
  is_locked: boolean;
}

export interface CompletePiece {
  id: string;
  level_id: string;
  name: string;
  room_type: string;
  floor_color: string;
  wall_thickness_cm: number;
  wall_height_cm: number;
  notes?: string | null;
  is_soft_deleted: boolean;
  is_locked: boolean;
}

export interface PersistedVertex {
  id: string;
  vertex_order: number;
  x_cm: number;
  y_cm: number;
}

async function callRpc<T>(
  client: SupabaseClient,
  functionName: string,
  parameters: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(functionName, parameters);
  if (error) throw error;
  return data as T;
}

export function createPieceComplete(
  client: SupabaseClient,
  piece: CompletePiece,
  vertices: PersistedVertex[],
  walls: PersistedWall[],
): Promise<string> {
  return callRpc(client, 'create_piece_complete', {
    piece_data: piece,
    vertices_data: vertices,
    walls_data: walls,
  });
}

export function replaceWallTopology(
  client: SupabaseClient,
  levelId: string,
  replacedWallIds: string[],
  walls: PersistedWall[],
  openings: PersistedOpening[],
): Promise<{ wall_count: number; opening_count: number }[]> {
  return callRpc(client, 'replace_wall_topology', {
    target_level_id: levelId,
    replaced_wall_ids: replacedWallIds,
    walls_data: walls,
    openings_data: openings,
  });
}

export function writeWallHeightProfiles(
  client: SupabaseClient,
  wallId: string,
  linked: boolean,
  leftPoints: PersistedHeightPoint[],
  rightPoints: PersistedHeightPoint[],
): Promise<void> {
  return callRpc(client, 'write_wall_height_profiles', {
    target_wall_id: wallId,
    profiles_linked: linked,
    left_points: leftPoints,
    right_points: rightPoints,
  });
}

export function updatePieceGeometry(client: SupabaseClient, pieceId: string, vertices: PersistedVertex[]): Promise<void> {
  return callRpc(client, 'update_piece_geometry', { target_piece_id: pieceId, vertices_data: vertices });
}
