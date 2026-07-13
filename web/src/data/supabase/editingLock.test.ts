import { describe, expect, it } from 'vitest';
import { mapProjectEditingLock } from './editingLock';

describe('mapProjectEditingLock', () => {
  it('transpose l’état calculé par le serveur', () => {
    expect(mapProjectEditingLock({
      project_id: 'projet-1',
      holder_user_id: 'utilisateur-1',
      holder_display_name: 'Camille',
      last_activity_at: '2026-07-13T14:00:00Z',
      expires_at: '2026-07-13T14:02:00Z',
      is_active: true,
      held_by_current_user: false,
      server_now: '2026-07-13T14:01:00Z',
    })).toEqual({
      projectId: 'projet-1',
      holderUserId: 'utilisateur-1',
      holderDisplayName: 'Camille',
      lastActivityAt: '2026-07-13T14:00:00Z',
      expiresAt: '2026-07-13T14:02:00Z',
      isActive: true,
      heldByCurrentUser: false,
      serverNow: '2026-07-13T14:01:00Z',
    });
  });
});
