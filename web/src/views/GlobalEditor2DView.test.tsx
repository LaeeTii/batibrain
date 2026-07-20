import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionHistoryProvider } from '../components/ActionHistory';
import { DEFAULT_CANVAS_DISPLAY_OPTIONS, type CanvasLevelData } from '../components/Canvas2D';
import { SelectionSyncBridge } from '../components/SelectionSyncBridge';
import { PreferencesProvider } from '../components/PreferencesContext';
import { UnsavedChangesProvider } from '../components/UnsavedChangesContext';
import { DEFAULT_USER_PREFERENCES } from '../domain/userPreferences';
import { createRectangleRoomGeometry } from '../domain/geometry';
import { setSharedVertexLock } from '../domain/editorGeometry';
import { linkCoincidentWalls } from '../domain/roomOverlap';
import type { Project } from '../domain/types';
import type { GlobalEditorAccess } from '../domain/globalEditorAccess';
import { GlobalEditorContent } from './GlobalEditor2DView';

const project: Project = { id: 'p1', name: 'Maison', ownerUserId: 'u1', updatedAt: '2026-07-14T10:00:00Z' };
const data: CanvasLevelData = { level: { id: 'l1', projectId: 'p1', name: 'RDC', number: 0, isVisible: true }, rooms: [{ room: { id: 'r1', levelId: 'l1', name: 'Cuisine', type: 'cuisine', floorColor: '#E5FFFC', isLocked: true }, vertices: [{ id: 'a', pieceId: 'r1', order: 0, x: 0, y: 0, isLocked: true }, { id: 'b', pieceId: 'r1', order: 1, x: 200, y: 0, isLocked: true }, { id: 'c', pieceId: 'r1', order: 2, x: 200, y: 200, isLocked: true }], walls: [], openings: [] }] };

function renderContent(
  access: GlobalEditorAccess = { readOnly: false, reason: null, message: null },
  currentData = data,
) {
  const gateway = { load: vi.fn().mockResolvedValue(DEFAULT_USER_PREFERENCES), save: vi.fn() };
  const validObjects = new Set([
    `level:${currentData.level.id}`,
    ...currentData.rooms.flatMap(({ room, walls }) => [
      `room:${room.id}`,
      ...walls.map(({ id }) => `wall:${id}`),
    ]),
  ]);
  return render(<MantineProvider><UnsavedChangesProvider><PreferencesProvider gateway={gateway}><ActionHistoryProvider><SelectionSyncBridge validObjects={validObjects}><GlobalEditorContent project={project} levels={[currentData.level]} levelData={[currentData]} activeLevelId="l1" visibleLevelIds={['l1']} options={DEFAULT_CANVAS_DISPLAY_OPTIONS} loading={false} error="" access={access} onRetry={vi.fn()} onOptionsChange={vi.fn()} onToggleLevel={vi.fn()} onActiveLevelChange={vi.fn()} /></SelectionSyncBridge></ActionHistoryProvider></PreferencesProvider></UnsavedChangesProvider></MantineProvider>);
}

describe('GlobalEditorContent', () => {
  it('signale la lecture seule tout en conservant le canvas et les panneaux', () => {
    renderContent({ readOnly: true, reason: 'droits', message: 'Lecture seule : consultation autorisée.' });
    expect(screen.getByText('Lecture seule : consultation autorisée.')).toBeInTheDocument();
    expect(screen.getAllByText('Cuisine')).not.toHaveLength(0);
    expect(screen.getByLabelText('Replier le panneau de création')).toBeEnabled();
    expect(screen.getByLabelText('Annuler')).toBeDisabled();
  });

  it('maintient la sélection consultative d’une pièce verrouillée', async () => {
    renderContent();
    fireEvent.click(screen.getByRole('button', { name: 'Pièces' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cuisine' }));
    expect(screen.getByText(/L’élément sélectionné est verrouillé/)).toBeInTheDocument();
    expect(screen.getAllByText(/informations restent consultables/)).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Déverrouiller' }));
    expect(screen.queryByText(/L’élément sélectionné est verrouillé/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verrouiller' })).toBeInTheDocument();
  });

  it('autorise la suppression de B lorsque seuls ses sommets partagés avec A sont verrouillés', async () => {
    const snapshots = linkCoincidentWalls(['A', 'B'].map((roomId, index) => {
      const geometry = createRectangleRoomGeometry(roomId, 100, 100, {
        originX: index * 100,
        originY: 0,
        wallThicknessCm: 10,
        wallHeightCm: 250,
      });
      return {
        room: { id: roomId, levelId: 'l1', name: roomId, type: 'autre' as const, floorColor: '#fff' },
        ...geometry,
        openings: [],
      };
    }));
    const lockedIds = new Set(snapshots[0].vertices.map(({ id }) => id));
    const rooms = setSharedVertexLock(snapshots, lockedIds, true).map((snapshot) => ({
      ...snapshot,
      room: { ...snapshot.room, isLocked: snapshot.room.id === 'A' },
    }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderContent(undefined, { ...data, rooms });

    fireEvent.click(screen.getByRole('button', { name: 'Pièces' }));
    fireEvent.click(await screen.findByRole('button', { name: 'B' }));
    const deleteButton = screen.getByRole('button', { name: 'Supprimer la pièce' });
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'B' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
    confirm.mockRestore();
  });
});
