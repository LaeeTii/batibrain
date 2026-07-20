import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CANVAS_DISPLAY_OPTIONS } from '../../domain/viewSettings';

const getUser = vi.fn();
const from = vi.fn();

vi.mock('./client', () => ({
  getSupabaseClient: () => ({ auth: { getUser }, from }),
}));

const { loadProjectViewSettings, saveProjectDisplayOptions } = await import('./viewSettings');

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'utilisateur-1' } }, error: null });
});

describe('options de vue par projet', () => {
  it('relit les options du projet et de l’utilisateur courants', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        show_grid: false, show_rules: true, show_dimensions: false, show_angles: true,
        show_notes: false, show_room_surfaces: true, show_room_icons: false,
        snap_grid: true, snap_vertices: true, snap_intersections: false,
        snap_walls: true, snap_midpoints: false, snap_distance_cm: 12,
      },
      error: null,
    });
    const secondEq = vi.fn().mockReturnValue({ maybeSingle });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const select = vi.fn().mockReturnValue({ eq: firstEq });
    from.mockReturnValue({ select });

    const loaded = await loadProjectViewSettings('projet-1');

    expect(firstEq).toHaveBeenCalledWith('project_id', 'projet-1');
    expect(secondEq).toHaveBeenCalledWith('user_id', 'utilisateur-1');
    expect(loaded.display).toEqual({
      grid: false, rulers: true, dimensions: false, angles: true,
      notes: false, surfaces: true, roomIcons: false,
    });
  });

  it('persiste toutes les options avec la clé utilisateur-projet', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    const options = { ...DEFAULT_CANVAS_DISPLAY_OPTIONS, grid: false, roomIcons: false };

    await saveProjectDisplayOptions('projet-1', options);

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'projet-1',
      user_id: 'utilisateur-1',
      show_grid: false,
      show_room_icons: false,
    }), { onConflict: 'project_id,user_id' });
  });
});
