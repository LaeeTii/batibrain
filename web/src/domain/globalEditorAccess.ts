import type { ProjectEditingLock } from './types';

export interface GlobalEditorAccess {
  readOnly: boolean;
  reason: 'droits' | 'verrou-collaboratif' | null;
  message: string | null;
}

export function getGlobalEditorAccess(canWrite: boolean, lock: ProjectEditingLock | null): GlobalEditorAccess {
  if (!canWrite) return { readOnly: true, reason: 'droits', message: 'Lecture seule : votre rôle permet de consulter ce projet sans le modifier.' };
  if (lock?.isActive && !lock.heldByCurrentUser) return {
    readOnly: true,
    reason: 'verrou-collaboratif',
    message: `Lecture seule temporaire : ${lock.holderDisplayName ?? 'un autre utilisateur'} modifie ce projet.`,
  };
  return { readOnly: false, reason: null, message: null };
}
