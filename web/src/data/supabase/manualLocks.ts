import type { ManualLockResourceType } from '../../domain/manualLock';
import { getSupabaseClient } from '../../lib/supabase';

export async function setManualResourceLock(
  resourceType: ManualLockResourceType,
  resourceId: string,
  locked: boolean,
): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('set_project_resource_manual_lock', {
    resource_type: resourceType,
    resource_id: resourceId,
    target_locked: locked,
  });
  if (error) throw error;
  return data as boolean;
}
