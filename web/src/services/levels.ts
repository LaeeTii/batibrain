import type { Level } from '../domain/types';
import { getSupabaseClient } from '../lib/supabase';

type LevelRow = {
  id: string;
  project_id: string;
  name: string;
  altitude_cm: number | null;
};

export interface CreateLevelInput {
  id?: string;
  projectId: string;
  name: string;
  altitudeCm?: number | null;
}

function mapLevelRow(row: LevelRow): Level {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    altitudeCm: row.altitude_cm,
  };
}

function toLevelInsertRow(level: CreateLevelInput): Partial<LevelRow> {
  return {
    ...(level.id ? { id: level.id } : {}),
    project_id: level.projectId,
    name: level.name,
    altitude_cm: level.altitudeCm ?? null,
  };
}

export async function getLevel(levelId: string): Promise<Level> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('levels')
    .select('id, project_id, name, altitude_cm')
    .eq('id', levelId)
    .single();

  if (error) {
    throw error;
  }

  return mapLevelRow(data as LevelRow);
}

export async function listLevelsByProject(projectId: string): Promise<Level[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('levels')
    .select('id, project_id, name, altitude_cm')
    .eq('project_id', projectId)
    .order('created_at');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapLevelRow(row as LevelRow));
}

export async function createLevel(level: CreateLevelInput): Promise<Level> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('levels')
    .insert(toLevelInsertRow(level))
    .select('id, project_id, name, altitude_cm')
    .single();

  if (error) {
    throw error;
  }

  return mapLevelRow(data as LevelRow);
}