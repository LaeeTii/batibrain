import type { DimensionReference, DimensionType, EditorDimension, EditorNote } from '../domain/types';
import { getSupabaseClient } from '../lib/supabase';

type DimensionRow = {
  id: string;
  level_id: string;
  name: string;
  dimension_type: DimensionType;
  distance_cm: number | string;
  offset_cm: number | string;
  reference_a: DimensionReference;
  reference_b: DimensionReference;
};

type NoteRow = {
  id: string;
  project_id: string;
  origin_type: EditorNote['originType'];
  origin_id: string | null;
  content: string;
};

function mapDimension(row: DimensionRow): EditorDimension {
  return {
    id: row.id,
    levelId: row.level_id,
    name: row.name,
    type: row.dimension_type,
    distanceCm: Number(row.distance_cm),
    offsetCm: Number(row.offset_cm),
    referenceA: row.reference_a,
    referenceB: row.reference_b,
  };
}

function mapNote(row: NoteRow): EditorNote {
  return {
    id: row.id,
    projectId: row.project_id,
    originType: row.origin_type,
    originId: row.origin_id,
    text: row.content,
  };
}

export async function listDimensions(levelId: string): Promise<EditorDimension[]> {
  const { data, error } = await getSupabaseClient().from('dimensions')
    .select('id, level_id, name, dimension_type, distance_cm, offset_cm, reference_a, reference_b')
    .eq('level_id', levelId).order('created_at');
  if (error) throw error;
  return (data ?? []).map((row) => mapDimension(row as DimensionRow));
}

export async function saveDimension(dimension: EditorDimension): Promise<EditorDimension> {
  const { data, error } = await getSupabaseClient().from('dimensions').upsert({
    id: dimension.id,
    level_id: dimension.levelId,
    name: dimension.name.trim() || 'Nouvelle côte',
    dimension_type: dimension.type,
    distance_cm: dimension.distanceCm,
    offset_cm: dimension.offsetCm,
    reference_a: dimension.referenceA,
    reference_b: dimension.referenceB,
  }).select('id, level_id, name, dimension_type, distance_cm, offset_cm, reference_a, reference_b').single();
  if (error) throw error;
  return mapDimension(data as DimensionRow);
}

export async function deleteDimension(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('dimensions').delete().eq('id', id);
  if (error) throw error;
}

export async function listNotes(projectId: string): Promise<EditorNote[]> {
  const { data, error } = await getSupabaseClient().from('notes')
    .select('id, project_id, origin_type, origin_id, content')
    .eq('project_id', projectId).order('created_at');
  if (error) throw error;
  return (data ?? []).map((row) => mapNote(row as NoteRow));
}

export async function saveNote(note: EditorNote): Promise<EditorNote> {
  const { data, error } = await getSupabaseClient().from('notes').upsert({
    id: note.id,
    project_id: note.projectId,
    origin_type: note.originType,
    origin_id: note.originId,
    content: note.text,
  }).select('id, project_id, origin_type, origin_id, content').single();
  if (error) throw error;
  return mapNote(data as NoteRow);
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('notes').delete().eq('id', id);
  if (error) throw error;
}
