import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionSyncBridge, useEditorSelection } from './SelectionSyncBridge';

function Harness() {
  const { selection, select } = useEditorSelection();
  return <><button onClick={() => select({ source: 'canvas', type: 'room', id: 'r1', levelId: 'l2' })}>Sélectionner</button><output>{selection?.id ?? 'aucune'}</output></>;
}

function DraftHarness() {
  const { selection, select } = useEditorSelection();
  return <><button onClick={() => select({ source: 'canvas', type: 'room', id: 'brouillon', levelId: 'l1' })}>Sélectionner le brouillon</button><output>{selection?.id ?? 'aucune'}</output></>;
}

describe('SelectionSyncBridge', () => {
  it('conserve la dernière intention valide et bascule de niveau', () => {
    const onLevelChange = vi.fn();
    render(<SelectionSyncBridge validObjects={new Set(['room:r1'])} onLevelChange={onLevelChange}><Harness /></SelectionSyncBridge>);
    act(() => screen.getByRole('button').click());
    expect(screen.getByText('r1')).toBeInTheDocument(); expect(onLevelChange).toHaveBeenCalledWith('l2');
  });

  it('purge la sélection quand l’objet disparaît', () => {
    const { rerender } = render(<SelectionSyncBridge validObjects={new Set(['room:r1'])}><Harness /></SelectionSyncBridge>);
    act(() => screen.getByRole('button').click());
    rerender(<SelectionSyncBridge validObjects={new Set()}><Harness /></SelectionSyncBridge>);
    expect(screen.getByText('aucune')).toBeInTheDocument();
  });

  it('accepte un objet créé localement avant sa sauvegarde', () => {
    render(<SelectionSyncBridge validObjects={new Set()} allowDraftObjects><DraftHarness /></SelectionSyncBridge>);
    act(() => screen.getByRole('button').click());
    expect(screen.getByText('brouillon')).toBeInTheDocument();
  });
});
