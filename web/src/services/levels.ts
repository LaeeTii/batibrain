import type { Level } from '../domain/types';
import { DEFAULT_LEVEL_ZERO_NAME } from '../domain/level';
import { getSupabaseClient } from '../lib/supabase';

type LevelRow = {
  id: string;
  project_id: string;
  name: string;
  altitude_cm: number | null;
  level_number: number;
  is_visible: boolean;
  is_soft_deleted: boolean;
};

export interface CreateLevelInput {
  id?: string;
  projectId: string;
  name: string;
  altitudeCm?: number | null;
  number?: number;
  isVisible?: boolean;
}

function mapLevelRow(row: LevelRow): Level {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    altitudeCm: row.altitude_cm,
    number: row.level_number,
    isVisible: row.is_visible,
  };
}

function toLevelInsertRow(level: CreateLevelInput): Partial<LevelRow> {
  return {
    ...(level.id ? { id: level.id } : {}),
    project_id: level.projectId,
    name: level.name,
    altitude_cm: level.altitudeCm ?? null,
    level_number: level.number ?? 0,
    is_visible: level.isVisible ?? true,
    is_soft_deleted: false,
  };
}

export async function getLevel(levelId: string): Promise<Level> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('levels')
    .select('id, project_id, name, altitude_cm, level_number, is_visible, is_soft_deleted')
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
    .select('id, project_id, name, altitude_cm, level_number, is_visible, is_soft_deleted')
    .eq('project_id', projectId)
    .eq('is_soft_deleted', false)
    .order('level_number');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapLevelRow(row as LevelRow));
}

export async function createLevel(level: CreateLevelInput): Promise<Level> {
  const supabase = getSupabaseClient();
  let number = level.number;
  if (number === undefined) {
    const levels = await listLevelsByProject(level.projectId);
    number = Math.max(0, ...levels.map((item) => item.number)) + 1;
  }
  const { data, error } = await supabase
    .from('levels')
    .insert(toLevelInsertRow({ ...level, number }))
    .select('id, project_id, name, altitude_cm, level_number, is_visible, is_soft_deleted')
    .single();

  if (error) {
    throw error;
  }

  return mapLevelRow(data as LevelRow);
}

export async function updateLevel(level: Level): Promise<Level> {
  if (level.number === 0 && !level.isVisible) {
    throw new Error('Le niveau 0 obligatoire doit rester visible.');
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('levels').update({
    name: level.name.trim() || (level.number === 0 ? DEFAULT_LEVEL_ZERO_NAME : `Niveau ${level.number}`),
    altitude_cm: level.altitudeCm ?? null,
    is_visible: level.isVisible,
  }).eq('id', level.id).select('id, project_id, name, altitude_cm, level_number, is_visible, is_soft_deleted').single();
  if (error) throw error;
  return mapLevelRow(data as LevelRow);
}
