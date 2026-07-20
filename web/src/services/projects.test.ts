import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc, from }),
}));

const { softDeleteProject, updateProject } = await import('./projects');

const PROJECT_ROW = {
  id: 'projet-1',
  name: 'Maison',
  address: null,
  description: 'Rénovation',
  owner_user_id: 'propriétaire-1',
  updated_at: '2026-07-20T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('frontière propriétaire des projets', () => {
  it('modifie un projet par la RPC propriétaire', async () => {
    rpc.mockResolvedValue({ data: { ...PROJECT_ROW, name: 'Maison rénovée' }, error: null });

    await expect(updateProject('projet-1', {
      name: 'Maison rénovée',
      address: null,
      description: 'Rénovation',
    })).resolves.toMatchObject({ id: 'projet-1', name: 'Maison rénovée' });

    expect(rpc).toHaveBeenCalledWith('update_owned_project', {
      target_project_id: 'projet-1',
      target_name: 'Maison rénovée',
      target_address: null,
      target_description: 'Rénovation',
      target_soft_deleted: false,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('supprime logiquement un projet par la même RPC', async () => {
    const single = vi.fn().mockResolvedValue({ data: PROJECT_ROW, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    rpc.mockResolvedValue({ data: { ...PROJECT_ROW, is_soft_deleted: true }, error: null });

    await softDeleteProject('projet-1');

    expect(rpc).toHaveBeenCalledWith('update_owned_project', {
      target_project_id: 'projet-1',
      target_name: 'Maison',
      target_address: null,
      target_description: 'Rénovation',
      target_soft_deleted: true,
    });
  });
});
