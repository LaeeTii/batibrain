import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionHistoryProvider, useActionHistory } from './ActionHistory';

function Harness({ undoAction, redoAction }: { undoAction(): void; redoAction(): void }) {
  const history = useActionHistory();
  return <><button onClick={() => history.record({ label: 'Action', undo: undoAction, redo: redoAction })}>Ajouter</button><button disabled={!history.canUndo} onClick={history.undo}>Annuler</button><button disabled={!history.canRedo} onClick={history.redo}>Rétablir</button></>;
}

describe('ActionHistoryProvider', () => {
  it('partage les piles entre boutons et raccourcis', () => {
    const undo = vi.fn(); const redo = vi.fn();
    render(<ActionHistoryProvider><Harness undoAction={undo} redoAction={redo} /></ActionHistoryProvider>);
    act(() => screen.getByText('Ajouter').click());
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); expect(undo).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true }); expect(redo).toHaveBeenCalledOnce();
  });
});
