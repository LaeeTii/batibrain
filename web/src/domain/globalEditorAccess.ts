export interface GlobalEditorAccess {
  readOnly: boolean;
  reason: 'droits' | null;
  message: string | null;
}

export function getGlobalEditorAccess(canWrite: boolean): GlobalEditorAccess {
  if (!canWrite) return { readOnly: true, reason: 'droits', message: 'Lecture seule : votre rôle permet de consulter ce projet sans le modifier.' };
  return { readOnly: false, reason: null, message: null };
}
