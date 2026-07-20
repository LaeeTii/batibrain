import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider, useUnsavedChanges } from './UnsavedChangesContext';
import { useEditorAutosave } from './useEditorAutosave';

function Harness({ save, intervalMs = 100 }: { save(): Promise<void>; intervalMs?: number }) {
  const [dirty, setDirty] = useState(false);
  const autosave = useEditorAutosave({ source: 'test-editor', dirty, enabled: true, save, intervalMs });
  const { hasUnsavedChanges } = useUnsavedChanges();
  return <>
    <button onClick={() => setDirty(true)}>Modifier</button>
    <button onClick={() => void autosave.saveNow().catch(() => undefined)}>Sauvegarder</button>
    <span>{autosave.status}</span>
    <span>{autosave.error}</span>
    <span>{hasUnsavedChanges ? 'brouillon' : 'propre'}</span>
  </>;
}

describe('useEditorAutosave', () => {
  afterEach(() => vi.useRealTimers());

  it('déclenche la sauvegarde manuelle et expose le brouillon global', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<UnsavedChangesProvider><Harness save={save} /></UnsavedChangesProvider>);
    fireEvent.click(screen.getByText('Modifier'));
    expect(screen.getByText('brouillon')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sauvegarder'));
    await act(async () => undefined);
    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByText('synced')).toBeInTheDocument();
  });

  it('conserve un unique état d’erreur et retente au cycle suivant', async () => {
    vi.useFakeTimers();
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('Réseau indisponible'))
      .mockResolvedValue(undefined);
    render(<UnsavedChangesProvider><Harness save={save} /></UnsavedChangesProvider>);
    fireEvent.click(screen.getByText('Modifier'));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByText('Réseau indisponible')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(screen.getByText('synced')).toBeInTheDocument();
  });
});
