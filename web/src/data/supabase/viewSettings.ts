import { getSupabaseClient } from './client';
import {
  DEFAULT_PROJECT_VIEW_SETTINGS,
  type CanvasDisplayOptions,
  type CanvasSnappingOptions,
  type ProjectViewSettings,
} from '../../domain/viewSettings';

export type ViewSettingsGateway = {
  load(projectId: string): Promise<ProjectViewSettings>;
  saveDisplayOptions(projectId: string, options: CanvasDisplayOptions): Promise<void>;
  saveSnappingOptions(projectId: string, options: CanvasSnappingOptions): Promise<void>;
};

export async function loadProjectViewSettings(projectId: string): Promise<ProjectViewSettings> {
  const client = getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error('Session introuvable.');

  const { data, error } = await client.from('editor_view_settings')
    .select('show_grid,show_rules,show_dimensions,show_angles,show_notes,show_room_surfaces,show_room_icons,snap_grid,snap_vertices,snap_intersections,snap_walls,snap_midpoints,snap_guides,snap_distance_cm')
    .eq('project_id', projectId)
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PROJECT_VIEW_SETTINGS;

  return {
    display: {
      grid: data.show_grid,
      rulers: data.show_rules,
      dimensions: data.show_dimensions,
      angles: data.show_angles,
      notes: data.show_notes,
      surfaces: data.show_room_surfaces,
      roomIcons: data.show_room_icons,
    },
    snapping: {
      grid: data.snap_grid,
      vertices: data.snap_vertices,
      intersections: data.snap_intersections,
      walls: data.snap_walls,
      midpoints: data.snap_midpoints,
      guides: data.snap_guides,
      distanceCm: Number(data.snap_distance_cm),
    },
  };
}

export async function saveProjectDisplayOptions(
  projectId: string,
  options: CanvasDisplayOptions,
): Promise<void> {
  const client = getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error('Session introuvable.');

  const { error } = await client.from('editor_view_settings').upsert({
    project_id: projectId,
    user_id: authData.user.id,
    show_grid: options.grid,
    show_rules: options.rulers,
    show_dimensions: options.dimensions,
    show_angles: options.angles,
    show_notes: options.notes,
    show_room_surfaces: options.surfaces,
    show_room_icons: options.roomIcons,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id,user_id' });
  if (error) throw error;
}

export async function saveProjectSnappingOptions(
  projectId: string,
  options: CanvasSnappingOptions,
): Promise<void> {
  const client = getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error('Session introuvable.');

  const { error } = await client.from('editor_view_settings').upsert({
    project_id: projectId,
    user_id: authData.user.id,
    snap_grid: options.grid,
    snap_vertices: options.vertices,
    snap_intersections: options.intersections,
    snap_walls: options.walls,
    snap_midpoints: options.midpoints,
    snap_guides: options.guides,
    snap_distance_cm: options.distanceCm,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id,user_id' });
  if (error) throw error;
}

export const supabaseViewSettingsGateway: ViewSettingsGateway = {
  load: loadProjectViewSettings,
  saveDisplayOptions: saveProjectDisplayOptions,
  saveSnappingOptions: saveProjectSnappingOptions,
};
