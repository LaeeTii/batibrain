import type { Project } from '../../../shared/src/types';
import { getSupabaseClient } from '../lib/supabase';

type ProjectRow = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
};

export interface CreateProjectInput {
  id?: string;
  name: string;
  address?: string | null;
  description?: string | null;
}

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    description: row.description,
  };
}

function toProjectInsertRow(project: CreateProjectInput): Partial<ProjectRow> {
  return {
    ...(project.id ? { id: project.id } : {}),
    name: project.name,
    address: project.address ?? null,
    description: project.description ?? null,
  };
}

export async function getProject(projectId: string): Promise<Project> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, address, description')
    .eq('id', projectId)
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRow(data as ProjectRow);
}

export async function listProjects(): Promise<Project[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, address, description')
    .order('created_at');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProjectRow(row as ProjectRow));
}

export async function createProject(project: CreateProjectInput): Promise<Project> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .insert(toProjectInsertRow(project))
    .select('id, name, address, description')
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRow(data as ProjectRow);
}