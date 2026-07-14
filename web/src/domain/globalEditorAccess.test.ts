import { describe, expect, it } from 'vitest';
import type { ProjectEditingLock } from './types';
import { getGlobalEditorAccess } from './globalEditorAccess';

const lock: ProjectEditingLock = { projectId: 'p1', holderUserId: 'u2', holderDisplayName: 'Camille', lastActivityAt: '2026-07-14T10:00:00Z', expiresAt: '2026-07-14T10:02:00Z', isActive: true, heldByCurrentUser: false, serverNow: '2026-07-14T10:01:00Z' };

describe('accès à l’éditeur global', () => {
  it('rend un collaborateur en lecture explicitement consultatif', () => {
    expect(getGlobalEditorAccess(false, null)).toMatchObject({ readOnly: true, reason: 'droits' });
  });

  it('rend le verrou collaboratif d’un autre utilisateur temporairement consultatif', () => {
    expect(getGlobalEditorAccess(true, lock)).toEqual({ readOnly: true, reason: 'verrou-collaboratif', message: 'Lecture seule temporaire : Camille modifie ce projet.' });
  });

  it('autorise le détenteur du verrou', () => {
    expect(getGlobalEditorAccess(true, { ...lock, heldByCurrentUser: true })).toMatchObject({ readOnly: false, reason: null });
  });
});
