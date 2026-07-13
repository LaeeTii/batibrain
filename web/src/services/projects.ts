import type { Project } from '../domain/types';
import { getSupabaseClient } from '../lib/supabase';

type ProjectRow = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  owner_user_id: string;
  updated_at: string;
  is_soft_deleted?: boolean;
};

export interface CreateProjectInput {
  id?: string;
  ownerUserId?: string;
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
    ownerUserId: row.owner_user_id,
    updatedAt: row.updated_at,
  };
}

function toProjectInsertRow(project: CreateProjectInput): Partial<ProjectRow> {
  return {
    ...(project.id ? { id: project.id } : {}),
    owner_user_id: project.ownerUserId,
    name: project.name,
    address: project.address ?? null,
    description: project.description ?? null,
    is_soft_deleted: false,
  };
}

const PROJECT_COLUMNS = 'id, name, address, description, owner_user_id, updated_at';

export async function getProject(projectId: string): Promise<Project> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
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
    .select(PROJECT_COLUMNS)
    .eq('is_soft_deleted', false)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProjectRow(row as ProjectRow));
}

export async function canWriteProject(projectId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('can_write_project', {
    target_project_id: projectId,
  });
  if (error) throw error;
  return data === true;
}

export async function createProject(project: CreateProjectInput): Promise<Project> {
  const supabase = getSupabaseClient();
  const projectId = project.id ?? crypto.randomUUID();
  let ownerUserId = project.ownerUserId;
  if (!ownerUserId) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error('Aucun utilisateur authentifié.');
    ownerUserId = user.id;
  }
  const { error } = await supabase
    .from('projects')
    .insert(toProjectInsertRow({ ...project, id: projectId, ownerUserId }));

  if (error) {
    throw error;
  }

  return getProject(projectId);
}


export async function updateProject(
  projectId: string,
  changes: Pick<CreateProjectInput, 'name' | 'address' | 'description'>,
): Promise<Project> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('update_project_with_lock', {
    target_project_id: projectId,
    target_name: changes.name,
    target_address: changes.address ?? null,
    target_description: changes.description ?? null,
    target_soft_deleted: false,
  });

  if (error) throw error;
  return mapProjectRow(data as ProjectRow);
}

export async function softDeleteProject(projectId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const project = await getProject(projectId);
  const { error } = await supabase.rpc('update_project_with_lock', {
    target_project_id: projectId,
    target_name: project.name,
    target_address: project.address ?? null,
    target_description: project.description ?? null,
    target_soft_deleted: true,
  });

  if (error) throw error;
}
