export type EditorSelectionSource = 'canvas' | 'creation-list' | 'détail-tree' | 'project-notes-bubble';

export type EditorSelectionType = 'level' | 'room' | 'wall' | 'opening' | 'dimension' | 'note' | 'point';

export interface EditorSelection {
  source: EditorSelectionSource;
  type: EditorSelectionType;
  id: string;
  levelId?: string;
}

export function sameEditorSelection(left: EditorSelection | null, right: EditorSelection | null) {
  return left?.type === right?.type && left?.id === right?.id;
}

export function reconcileEditorSelection(
  selection: EditorSelection | null,
  validObjects: ReadonlySet<string>,
) {
  if (!selection) return null;
  return validObjects.has(`${selection.type}:${selection.id}`) ? selection : null;
}
