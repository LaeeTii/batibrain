import { useCallback, useEffect, useRef, useState } from 'react';
import { useUnsavedChanges } from './UnsavedChangesContext';

export type EditorSaveStatus = 'idle' | 'dirty' | 'saving' | 'synced' | 'error';

interface UseEditorAutosaveOptions {
  source: string;
  dirty: boolean;
  enabled: boolean;
  save(): Promise<void>;
  intervalMs?: number;
}

interface EditorAutosaveState {
  status: EditorSaveStatus;
  error: string;
  saveNow(): Promise<void>;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Les modifications n’ont pas pu être enregistrées.';
}

/**
 * Contrat de persistance commun aux éditeurs : brouillon local, sauvegarde manuelle,
 * tentative automatique périodique et conservation du brouillon après un échec.
 */
export function useEditorAutosave({
  source,
  dirty,
  enabled,
  save,
  intervalMs = 300_000,
}: UseEditorAutosaveOptions): EditorAutosaveState {
  const { setSourceDirty } = useUnsavedChanges();
  const [status, setStatus] = useState<EditorSaveStatus>('idle');
  const [error, setError] = useState('');
  const saveRef = useRef(save);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const previousDirtyRef = useRef(dirty);

  saveRef.current = save;

  useEffect(() => {
    setSourceDirty(source, dirty);
    if (dirty && !previousDirtyRef.current && status !== 'saving' && status !== 'error') setStatus('dirty');
    if (!dirty && status === 'dirty') setStatus('idle');
    previousDirtyRef.current = dirty;
    return () => setSourceDirty(source, false);
  }, [dirty, setSourceDirty, source, status]);

  const saveNow = useCallback(async () => {
    if (!enabled || !dirty) return;
    if (inFlightRef.current) return inFlightRef.current;

    const operation = (async () => {
      setStatus('saving');
      setError('');
      try {
        await saveRef.current();
        setStatus('synced');
      } catch (caught) {
        setStatus('error');
        setError(errorMessage(caught));
        throw caught;
      }
    })();

    inFlightRef.current = operation;
    try {
      await operation;
    } finally {
      if (inFlightRef.current === operation) inFlightRef.current = null;
    }
  }, [dirty, enabled]);

  useEffect(() => {
    if (!enabled || !dirty) return undefined;
    const interval = window.setInterval(() => {
      void saveNow().catch(() => undefined);
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [dirty, enabled, intervalMs, saveNow]);

  return { status, error, saveNow };
}
