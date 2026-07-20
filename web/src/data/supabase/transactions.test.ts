import { describe, expect, it, vi } from 'vitest';
import { loadLevelGeometry, saveLevelGeometry } from './transactions';

function clientReturning(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe('frontière transactionnelle géométrique Supabase', () => {
  it('charge un niveau canonique par une seule RPC', async () => {
    const client = clientReturning({ level_id: 'niveau-1', revision: 4 });

    await expect(loadLevelGeometry(client as never, 'niveau-1'))
      .resolves.toEqual({ level_id: 'niveau-1', revision: 4 });
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith('load_level_geometry', {
      target_level_id: 'niveau-1',
    });
  });

  it('sauvegarde tout l’instantané avec sa révision en un seul appel', async () => {
    const client = clientReturning({ level_id: 'niveau-1', revision: 5 });
    const snapshot = {
      vertices: [],
      pieces: [],
      walls: [],
      openings: [],
      unlocked_vertex_ids: ['sommet-déverrouillé'],
    };

    await saveLevelGeometry(client as never, 'niveau-1', 4, snapshot);

    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith('save_level_geometry', {
      target_level_id: 'niveau-1',
      expected_revision: 4,
      snapshot_data: snapshot,
    });
  });

  it('propage un rollback sans déclencher une seconde écriture', async () => {
    const error = new Error('LOCKED_VERTEX_MUTATION');
    const client = clientReturning(null, error);

    await expect(saveLevelGeometry(client as never, 'niveau-1', 2, {
      vertices: [], pieces: [], walls: [], openings: [],
    })).rejects.toBe(error);
    expect(client.rpc).toHaveBeenCalledOnce();
  });
});
