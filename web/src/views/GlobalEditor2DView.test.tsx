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
const baseGeometry = createRectangleRoomGeometry('r1', 200, 200, { wallThicknessCm: 10, wallHeightCm: 250 });
const data: CanvasLevelData = {
  level: { id: 'l1', projectId: 'p1', name: 'RDC', number: 0, isVisible: true },
  rooms: [{
    room: { id: 'r1', levelId: 'l1', name: 'Cuisine', type: 'cuisine', floorColor: '#E5FFFC', isLocked: true },
    vertices: baseGeometry.vertices.map((vertex) => ({ ...vertex, isLocked: true })),
    walls: baseGeometry.walls,
    openings: [],
  }],
};

function renderContent(
  access: GlobalEditorAccess = { readOnly: false, reason: null, message: null },
  currentData = data,
  allData: CanvasLevelData[] = [currentData],
  visibleLevelIds: string[] = allData.map(({ level }) => level.id),
) {
  const gateway = { load: vi.fn().mockResolvedValue(DEFAULT_USER_PREFERENCES), save: vi.fn() };
  const validObjects = new Set([
    ...allData.flatMap(({ level, rooms }) => [
      `level:${level.id}`,
      ...rooms.flatMap(({ room, walls }) => [
        `room:${room.id}`,
        ...walls.map(({ id }) => `wall:${id}`),
      ]),
    ]),
  ]);
  return render(<MantineProvider><UnsavedChangesProvider><PreferencesProvider gateway={gateway}><ActionHistoryProvider><SelectionSyncBridge validObjects={validObjects} allowDraftObjects><GlobalEditorContent project={project} levels={allData.map(({ level }) => level)} levelData={allData} activeLevelId={currentData.level.id} visibleLevelIds={visibleLevelIds} options={DEFAULT_CANVAS_DISPLAY_OPTIONS} loading={false} error="" access={access} onRetry={vi.fn()} onOptionsChange={vi.fn()} onToggleLevel={vi.fn()} onActiveLevelChange={vi.fn()} /></SelectionSyncBridge></ActionHistoryProvider></PreferencesProvider></UnsavedChangesProvider></MantineProvider>);
}

describe('GlobalEditorContent', () => {
  it('affiche un niveau plus haut en filigrane au-dessus du niveau actif', () => {
    const upperData: CanvasLevelData = {
      level: { ...data.level, id: 'l2', name: 'Étage', number: 1, altitudeCm: 300 },
      rooms: [{
        ...data.rooms[0],
        room: { ...data.rooms[0].room, id: 'r2', levelId: 'l2', name: 'Chambre' },
        vertices: data.rooms[0].vertices.map((vertex) => ({
          ...vertex,
          id: `${vertex.id}-étage`,
          pieceId: 'r2',
          x: vertex.x + 500,
        })),
      }],
    };

    const { container } = renderContent(undefined, data, [upperData, data]);

    expect(container.querySelectorAll('.canvas2d-context-level')).toHaveLength(1);
    expect(container.querySelectorAll('.canvas2d-context-level .canvas2d-context-room')).toHaveLength(1);
    expect(screen.getByText('Chambre')).toBeInTheDocument();
    const activeLevel = container.querySelector('.canvas2d-active-level')!;
    const contextLevel = container.querySelector('.canvas2d-context-level')!;
    expect(activeLevel.compareDocumentPosition(contextLevel) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('signale la lecture seule tout en conservant le canvas et les panneaux', () => {
    renderContent({ readOnly: true, reason: 'droits', message: 'Lecture seule : consultation autorisée.' });
    expect(screen.getByText('Lecture seule : consultation autorisée.')).toBeInTheDocument();
    expect(screen.getAllByText('Cuisine')).not.toHaveLength(0);
    expect(screen.getByLabelText('Replier le panneau de création')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Magnétisme' })).toBeInTheDocument();
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

  it('ferme la sélection et la section active après un clic simple sur le fond', async () => {
    const { container } = renderContent();
    fireEvent.click(screen.getByRole('button', { name: 'Pièces' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cuisine' }));
    expect(screen.getByRole('button', { name: 'Retour' })).toBeInTheDocument();
    expect(screen.getByText(/L’élément sélectionné est verrouillé/)).toBeInTheDocument();

    fireEvent.click(container.querySelector('.canvas2d-background')!);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retour' })).not.toBeInTheDocument());
    expect(screen.queryByText(/L’élément sélectionné est verrouillé/)).not.toBeInTheDocument();
  });

  it('enregistre un déplacement de sommet une seule fois au relâchement', async () => {
    const movableData: CanvasLevelData = {
      ...data,
      rooms: [{
        room: { ...data.rooms[0].room, isLocked: false },
        vertices: baseGeometry.vertices.map((vertex) => ({ ...vertex, isLocked: false })),
        walls: baseGeometry.walls,
        openings: [],
      }],
    };
    const { container } = renderContent(undefined, movableData);
    fireEvent.click(screen.getByRole('button', { name: 'Pièces' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cuisine' }));
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    const handle = container.querySelector('.canvas-vertex-handle')!;

    fireEvent.dragStart(handle, { clientX: 0, clientY: 0 });
    handle.setAttribute('data-konva-drag-x', '25');
    handle.setAttribute('data-konva-drag-y', '25');
    fireEvent.drag(handle, { clientX: 25, clientY: 25 });
    expect(undoButton).toBeDisabled();
    handle.setAttribute('data-konva-drag-x', '40');
    handle.setAttribute('data-konva-drag-y', '40');
    fireEvent.drag(handle, { clientX: 40, clientY: 40 });
    expect(undoButton).toBeDisabled();
    handle.setAttribute('data-konva-drag-x', '50');
    handle.setAttribute('data-konva-drag-y', '50');
    fireEvent.dragEnd(handle, { clientX: 50, clientY: 50 });

    await waitFor(() => expect(undoButton).toBeEnabled());
    expect(container.querySelector('.canvas-vertex-handle')).toHaveAttribute('cx', '50');
    fireEvent.click(undoButton);
    await waitFor(() => expect(container.querySelector('.canvas-vertex-handle')).toHaveAttribute('cx', '0'));
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir' }));
    await waitFor(() => expect(container.querySelector('.canvas-vertex-handle')).toHaveAttribute('cx', '50'));
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

  it('permet de détacher immédiatement un mur d’une pièce créée dans le brouillon', async () => {
    const emptyData: CanvasLevelData = {
      level: data.level,
      rooms: [],
      geometryRevision: 0,
      canonical: {
        levelId: 'l1', revision: 0, vertices: [], pieces: [], walls: [], profilesByWallId: {}, openings: [], templatesById: {},
      },
      detachedWalls: [],
    };
    const { container } = renderContent(undefined, emptyData);
    fireEvent.click(screen.getByRole('button', { name: 'Pièces' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dessiner une pièce' }));
    fireEvent.click(container.querySelector('.canvas2d-background')!, { clientX: 350, clientY: 250 });
    fireEvent.click(container.querySelector('.canvas2d-background')!, { clientX: 650, clientY: 500 });

    await waitFor(() => expect(container.querySelectorAll('.canvas-level-wall')).toHaveLength(4));
    fireEvent.click(container.querySelector('.canvas-level-wall')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Détacher' }));
    fireEvent.click(container.querySelector('.canvas2d-background')!, { clientX: 350, clientY: 250 });
    fireEvent.click(container.querySelector('.canvas2d-background')!, { clientX: 350, clientY: 150 });

    await waitFor(() => expect(container.querySelectorAll('.canvas-detached-wall')).toHaveLength(4));
    expect(screen.queryByText(/Le mur doit appartenir à une pièce/)).not.toBeInTheDocument();
  });
});
