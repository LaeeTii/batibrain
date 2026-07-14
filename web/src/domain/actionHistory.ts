export const MAX_EDITOR_HISTORY = 20;

export interface HistoryAction {
  label: string;
  undo(): void | Promise<void>;
  redo(): void | Promise<void>;
}

export interface ActionHistoryState {
  undoStack: HistoryAction[];
  redoStack: HistoryAction[];
}

export const EMPTY_ACTION_HISTORY: ActionHistoryState = { undoStack: [], redoStack: [] };

export function recordHistoryAction(state: ActionHistoryState, action: HistoryAction): ActionHistoryState {
  return { undoStack: [...state.undoStack, action].slice(-MAX_EDITOR_HISTORY), redoStack: [] };
}

export function moveHistoryAction(state: ActionHistoryState, direction: 'undo' | 'redo'): ActionHistoryState {
  if (direction === 'undo') {
    const action = state.undoStack.at(-1);
    return action ? { undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, action] } : state;
  }
  const action = state.redoStack.at(-1);
  return action ? { undoStack: [...state.undoStack, action].slice(-MAX_EDITOR_HISTORY), redoStack: state.redoStack.slice(0, -1) } : state;
}
