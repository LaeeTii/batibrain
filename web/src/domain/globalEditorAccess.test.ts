import { describe, expect, it } from 'vitest';
import { getGlobalEditorAccess } from './globalEditorAccess';

describe('accès à l’éditeur global', () => {
  it('rend un collaborateur en lecture explicitement consultatif', () => {
    expect(getGlobalEditorAccess(false)).toMatchObject({ readOnly: true, reason: 'droits' });
  });

  it('autorise un utilisateur qui a les droits d’écriture', () => {
    expect(getGlobalEditorAccess(true)).toMatchObject({ readOnly: false, reason: null });
  });
});
