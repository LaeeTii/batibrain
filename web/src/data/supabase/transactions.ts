import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersistedVertex {
  id: string;
  x_cm: number;
  y_cm: number;
  is_locked: boolean;
}

export interface PersistedHeightPoint {
  id: string;
  point_order: number;
  position_cm: number;
  height_cm: number;
  is_locked: boolean;
}

export interface PersistedPiece {
  id: string;
  name: string;
  room_type: string;
  floor_color: string;
  wall_thickness_cm: number;
  wall_height_cm: number;
  notes: string | null;
  vertex_ids: string[];
}

export interface PersistedWall {
  id: string;
  start_vertex_id: string;
  end_vertex_id: string;
  thickness_cm: number;
  height_profiles_linked: boolean;
  material: string | null;
  insulation: string | null;
  notes: string | null;
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
  orientation: string | null;
  notes: string | null;
}

export interface PersistedLevelGeometry {
  vertices: PersistedVertex[];
  pieces: PersistedPiece[];
  walls: PersistedWall[];
  openings: PersistedOpening[];
  unlocked_vertex_ids?: string[];
  unlocked_profile_point_ids?: string[];
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

export function loadLevelGeometry<T>(
  client: SupabaseClient,
  levelId: string,
): Promise<T> {
  return callRpc<T>(client, 'load_level_geometry', { target_level_id: levelId });
}

export function saveLevelGeometry<T>(
  client: SupabaseClient,
  levelId: string,
  expectedRevision: number,
  snapshot: PersistedLevelGeometry,
): Promise<T> {
  return callRpc<T>(client, 'save_level_geometry', {
    target_level_id: levelId,
    expected_revision: expectedRevision,
    snapshot_data: snapshot,
  });
}
