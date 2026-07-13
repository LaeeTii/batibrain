import { describe, expect, it, vi } from 'vitest';
import {
  createPieceComplete,
  replaceWallTopology,
  writeWallHeightProfiles,
} from './transactions';

function clientReturning(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe('transactions Supabase', () => {
  it('envoie la pièce complète en un seul appel RPC', async () => {
    const client = clientReturning('piece-1');
    const piece = {
      id: 'piece-1', level_id: 'level-1', name: 'Séjour', room_type: 'sejour',
      floor_color: '#ffffff', wall_thickness_cm: 10, wall_height_cm: 250,
      is_soft_deleted: false, is_locked: false,
    };

    await expect(createPieceComplete(client as never, piece, [], [])).resolves.toBe('piece-1');
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith('create_piece_complete', expect.objectContaining({
      piece_data: piece,
    }));
  });

  it('envoie les seuls murs remplacés et leurs ouvertures en un appel RPC', async () => {
    const client = clientReturning([{ wall_count: 3, opening_count: 1 }]);

    await replaceWallTopology(client as never, 'level-1', ['wall-source'], [], []);

    expect(client.rpc).toHaveBeenCalledWith('replace_wall_topology', {
      target_level_id: 'level-1', replaced_wall_ids: ['wall-source'],
      walls_data: [], openings_data: [],
    });
  });

  it('propage une erreur RPC sans lancer une seconde écriture', async () => {
    const error = new Error('Transaction annulée');
    const client = clientReturning(null, error);

    await expect(writeWallHeightProfiles(client as never, 'wall-1', true, [], []))
      .rejects.toBe(error);
    expect(client.rpc).toHaveBeenCalledOnce();
  });
});
