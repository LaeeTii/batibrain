import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../components/PreferencesContext';
import { UnsavedChangesProvider } from '../components/UnsavedChangesContext';
import { DEFAULT_CANVAS_DISPLAY_OPTIONS } from '../components/Canvas2D';
import { DEFAULT_PROJECT_VIEW_SETTINGS } from '../domain/viewSettings';
import { DEFAULT_USER_PREFERENCES } from '../domain/userPreferences';
import { canWriteProject } from '../services/projects';
import { loadLevelGeometrySnapshot, saveLevelRoomSnapshots, type RoomSnapshot } from '../services/rooms';
import { RoomEditor } from './RoomEditor';

vi.mock('../lib/supabase', () => ({ hasSupabaseConfig: () => true }));
vi.mock('../data/supabase/viewSettings', () => ({
  supabaseViewSettingsGateway: {
    load: vi.fn().mockResolvedValue({ display: DEFAULT_CANVAS_DISPLAY_OPTIONS, snapping: DEFAULT_PROJECT_VIEW_SETTINGS.snapping }),
    saveDisplayOptions: vi.fn().mockResolvedValue(undefined),
    saveSnappingOptions: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../services/levels', () => ({
  getLevel: vi.fn().mockResolvedValue({ id: 'level', projectId: 'project', name: 'RDC', number: 0, isVisible: true }),
}));
vi.mock('../services/projects', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'project', name: 'Maison', ownerUserId: 'user', updatedAt: '2026-07-20' }),
  canWriteProject: vi.fn(),
}));
vi.mock('../services/rooms', () => ({
  loadLevelGeometrySnapshot: vi.fn(),
  saveLevelRoomSnapshots: vi.fn(),
}));

const snapshot: RoomSnapshot = {
  room: { id: 'room', levelId: 'level', name: 'Cuisine', type: 'cuisine', floorColor: '#E5FFFC' },
  vertices: [
    { id: 'v1', pieceId: 'room', order: 0, x: 0, y: 0 },
    { id: 'v2', pieceId: 'room', order: 1, x: 400, y: 0 },
    { id: 'v3', pieceId: 'room', order: 2, x: 400, y: 300 },
  ],
  walls: [],
  openings: [],
};

const siblingSnapshot: RoomSnapshot = {
  room: { id: 'sibling', levelId: 'level', name: 'Salon', type: 'salon', floorColor: '#FFF4E6' },
  vertices: [
    { id: 's1', pieceId: 'sibling', order: 0, x: 2_000, y: 2_000 },
    { id: 's2', pieceId: 'sibling', order: 1, x: 2_400, y: 2_000 },
    { id: 's3', pieceId: 'sibling', order: 2, x: 2_400, y: 2_300 },
  ],
  walls: [],
  openings: [],
};

function renderView() {
  const gateway = { load: vi.fn().mockResolvedValue(DEFAULT_USER_PREFERENCES), save: vi.fn() };
  return render(<MantineProvider><UnsavedChangesProvider><PreferencesProvider gateway={gateway}>
    <RoomEditor initialProjectId="project" initialLevelId="level" initialRoomId="room" onBack={vi.fn()} />
  </PreferencesProvider></UnsavedChangesProvider></MantineProvider>);
}

describe('RoomEditor2DView', () => {
  beforeEach(() => {
    vi.mocked(canWriteProject).mockResolvedValue(true);
    vi.mocked(loadLevelGeometrySnapshot).mockResolvedValue({ levelId: 'level', revision: 4, rooms: [snapshot, siblingSnapshot] });
    vi.mocked(saveLevelRoomSnapshots).mockResolvedValue({ levelId: 'level', revision: 5, rooms: [snapshot, siblingSnapshot] });
  });

  it('utilise le canvas React-Konva partagé et le contexte explicite', async () => {
    renderView();
    expect(await screen.findByRole('heading', { name: 'Cuisine' })).toBeInTheDocument();
    expect(screen.getByText('Maison · RDC')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom avant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Magnétisme' })).toBeInTheDocument();
    expect(screen.getByLabelText('Couleur du sol')).toHaveValue('#E5FFFC');
  });

  it('affiche les autres pièces en filigrane sans les inclure dans le cadrage', async () => {
    const { container } = renderView();
    await screen.findByRole('heading', { name: 'Cuisine' });

    const canvas = container.querySelector<HTMLElement>('.canvas2d')!;
    expect(within(canvas).getByText('Cuisine')).toBeInTheDocument();
    expect(within(canvas).getByText('Salon')).toBeInTheDocument();
    expect(canvas.querySelectorAll('.canvas2d-context-room')).toHaveLength(1);
    expect(within(canvas).getByText('X : -120 cm → 520 cm')).toBeInTheDocument();
    expect(within(canvas).getByText('Y : -120 cm → 420 cm')).toBeInTheDocument();
  });

  it('permet de masquer les autres pièces depuis les options d’affichage', async () => {
    const { container } = renderView();
    await screen.findByRole('heading', { name: 'Cuisine' });

    fireEvent.click(screen.getByRole('button', { name: 'Affichage' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Autres pièces en filigrane' }));

    const canvas = container.querySelector<HTMLElement>('.canvas2d')!;
    expect(within(canvas).queryByText('Salon')).not.toBeInTheDocument();
    expect(canvas.querySelector('.canvas2d-context-room')).not.toBeInTheDocument();
  });

  it('sauvegarde le brouillon de pièce avec la transaction canonique du niveau', async () => {
    renderView();
    const name = await screen.findByLabelText('Nom');
    fireEvent.change(name, { target: { value: 'Cuisine ouverte' } });
    const save = screen.getByRole('button', { name: 'Sauvegarder' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(saveLevelRoomSnapshots).toHaveBeenCalledWith('level', expect.any(Array), 4, undefined));
  });

  it('annule tout un déplacement de sommet en une seule action', async () => {
    const { container } = renderView();
    await screen.findByRole('heading', { name: 'Cuisine' });
    fireEvent.click(container.querySelector('.canvas2d-room')!);
    const handle = container.querySelector('.canvas-vertex-handle')!;
    const undoButton = screen.getByRole('button', { name: 'Annuler' });

    fireEvent.dragStart(handle);
    handle.setAttribute('data-konva-drag-x', '25');
    handle.setAttribute('data-konva-drag-y', '25');
    fireEvent.drag(handle);
    expect(undoButton).toBeDisabled();
    handle.setAttribute('data-konva-drag-x', '50');
    handle.setAttribute('data-konva-drag-y', '50');
    fireEvent.dragEnd(handle);

    await waitFor(() => expect(undoButton).toBeEnabled());
    expect(container.querySelector('.canvas-vertex-handle')).toHaveAttribute('cx', '50');
    fireEvent.click(undoButton);
    await waitFor(() => expect(container.querySelector('.canvas-vertex-handle')).toHaveAttribute('cx', '0'));
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir' }));
    await waitFor(() => expect(container.querySelector('.canvas-vertex-handle')).toHaveAttribute('cx', '50'));
  });

  it('désactive les écritures mais conserve le canvas en lecture seule', async () => {
    vi.mocked(canWriteProject).mockResolvedValue(false);
    renderView();
    expect(await screen.findByText('Lecture seule')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Cuisine' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeDisabled();
    expect(screen.getByLabelText('Zoom avant')).toBeEnabled();
  });
});
