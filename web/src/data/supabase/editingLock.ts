import type { ProjectEditingLock } from '../../domain/types';
import { getSupabaseClient } from '../../lib/supabase';

type EditingLockRow = {
  project_id: string;
  holder_user_id: string | null;
  holder_display_name: string | null;
  last_activity_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  held_by_current_user: boolean;
  server_now: string;
};

export function mapProjectEditingLock(row: EditingLockRow): ProjectEditingLock {
  return {
    projectId: row.project_id,
    holderUserId: row.holder_user_id,
    holderDisplayName: row.holder_display_name,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    heldByCurrentUser: row.held_by_current_user,
    serverNow: row.server_now,
  };
}

export async function getProjectEditingLock(projectId: string): Promise<ProjectEditingLock> {
  const { data, error } = await getSupabaseClient().rpc('project_editing_lock_state', {
    target_project_id: projectId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Projet inaccessible.');
  return mapProjectEditingLock(row as EditingLockRow);
}
