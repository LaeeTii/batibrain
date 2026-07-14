import { describe, expect, it } from 'vitest';
import { reconcileEditorSelection, sameEditorSelection, type EditorSelection } from './editorSelection';

const room: EditorSelection = { source: 'canvas', type: 'room', id: 'r1', levelId: 'l1' };

describe('sélection de l’éditeur', () => {
  it('compare l’objet sans dépendre de sa source', () => {
    expect(sameEditorSelection(room, { ...room, source: 'détail-tree' })).toBe(true);
  });

  it('purge un objet qui a disparu', () => {
    expect(reconcileEditorSelection(room, new Set(['room:r2']))).toBeNull();
    expect(reconcileEditorSelection(room, new Set(['room:r1']))).toEqual(room);
  });
});
