import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { reconcileEditorSelection, type EditorSelection } from '../domain/editorSelection';

interface SelectionContextValue {
  selection: EditorSelection | null;
  select(selection: EditorSelection): void;
  clear(): void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionSyncBridge({ validObjects, onLevelChange, children }: React.PropsWithChildren<{ validObjects: ReadonlySet<string>; onLevelChange?(levelId: string): void }>) {
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  useEffect(() => setSelection((current) => reconcileEditorSelection(current, validObjects)), [validObjects]);
  const select = useCallback((next: EditorSelection) => {
    if (!validObjects.has(`${next.type}:${next.id}`)) { setSelection(null); return; }
    if (next.levelId) onLevelChange?.(next.levelId);
    setSelection(next);
  }, [onLevelChange, validObjects]);
  const value = useMemo(() => ({ selection, select, clear: () => setSelection(null) }), [select, selection]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useEditorSelection() {
  const context = useContext(SelectionContext);
  if (!context) throw new Error('useEditorSelection doit être utilisé dans SelectionSyncBridge.');
  return context;
}
