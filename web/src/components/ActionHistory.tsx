import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY_ACTION_HISTORY, moveHistoryAction, recordHistoryAction, type HistoryAction } from '../domain/actionHistory';

interface ActionHistoryContextValue {
  canUndo: boolean; canRedo: boolean; record(action: HistoryAction): void; undo(): void; redo(): void;
}
const ActionHistoryContext = createContext<ActionHistoryContextValue | null>(null);

export function ActionHistoryProvider({ children }: React.PropsWithChildren) {
  const [history, setHistory] = useState(EMPTY_ACTION_HISTORY);
  const historyRef = useRef(history);
  historyRef.current = history;
  const record = useCallback((action: HistoryAction) => {
    const next = recordHistoryAction(historyRef.current, action);
    historyRef.current = next;
    setHistory(next);
  }, []);
  const run = useCallback((direction: 'undo' | 'redo') => {
    const current = historyRef.current;
    const action = direction === 'undo' ? current.undoStack.at(-1) : current.redoStack.at(-1);
    if (!action) return;
    const next = moveHistoryAction(current, direction);
    historyRef.current = next;
    setHistory(next);
    void (direction === 'undo' ? action.undo() : action.redo());
  }, []);
  const undo = useCallback(() => run('undo'), [run]); const redo = useCallback(() => run('redo'), [run]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target;
      if (target instanceof Element && target.matches('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault(); event.shiftKey ? redo() : undo();
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);
  const value = useMemo(() => ({ canUndo: history.undoStack.length > 0, canRedo: history.redoStack.length > 0, record, undo, redo }), [history, record, redo, undo]);
  return <ActionHistoryContext.Provider value={value}>{children}</ActionHistoryContext.Provider>;
}

export function useActionHistory() {
  const context = useContext(ActionHistoryContext);
  if (!context) throw new Error('useActionHistory doit être utilisé dans ActionHistoryProvider.');
  return context;
}
