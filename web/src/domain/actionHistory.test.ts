import { describe, expect, it, vi } from 'vitest';
import { EMPTY_ACTION_HISTORY, MAX_EDITOR_HISTORY, moveHistoryAction, recordHistoryAction } from './actionHistory';

describe('historique des actions', () => {
  it('conserve au plus vingt actions et vide le rétablissement', () => {
    let state = EMPTY_ACTION_HISTORY;
    for (let index = 0; index < MAX_EDITOR_HISTORY + 3; index += 1) state = recordHistoryAction(state, { label: `${index}`, undo: vi.fn(), redo: vi.fn() });
    expect(state.undoStack).toHaveLength(20);
    state = moveHistoryAction(state, 'undo');
    expect(state.redoStack).toHaveLength(1);
    state = recordHistoryAction(state, { label: 'nouvelle', undo: vi.fn(), redo: vi.fn() });
    expect(state.redoStack).toHaveLength(0);
  });
});
