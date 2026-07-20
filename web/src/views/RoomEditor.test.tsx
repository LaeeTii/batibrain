import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../components/PreferencesContext';
import { UnsavedChangesProvider } from '../components/UnsavedChangesContext';
import { DEFAULT_CANVAS_DISPLAY_OPTIONS } from '../components/Canvas2D';
import { DEFAULT_USER_PREFERENCES } from '../domain/userPreferences';
import { canWriteProject } from '../services/projects';
import { loadLevelGeometrySnapshot, saveLevelRoomSnapshots, type RoomSnapshot } from '../services/rooms';
import { RoomEditor } from './RoomEditor';

vi.mock('../lib/supabase', () => ({ hasSupabaseConfig: () => true }));
vi.mock('../data/supabase/viewSettings', () => ({
  supabaseViewSettingsGateway: {
    load: vi.fn().mockResolvedValue({ display: DEFAULT_CANVAS_DISPLAY_OPTIONS }),
    saveDisplayOptions: vi.fn().mockResolvedValue(undefined),
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

function renderView() {
  const gateway = { load: vi.fn().mockResolvedValue(DEFAULT_USER_PREFERENCES), save: vi.fn() };
  return render(<MantineProvider><UnsavedChangesProvider><PreferencesProvider gateway={gateway}>
    <RoomEditor initialProjectId="project" initialLevelId="level" initialRoomId="room" onBack={vi.fn()} />
  </PreferencesProvider></UnsavedChangesProvider></MantineProvider>);
}

describe('RoomEditor2DView', () => {
  beforeEach(() => {
    vi.mocked(canWriteProject).mockResolvedValue(true);
    vi.mocked(loadLevelGeometrySnapshot).mockResolvedValue({ levelId: 'level', revision: 4, rooms: [snapshot] });
    vi.mocked(saveLevelRoomSnapshots).mockResolvedValue({ levelId: 'level', revision: 5, rooms: [snapshot] });
  });

  it('utilise le canvas React-Konva partagé et le contexte explicite', async () => {
    renderView();
    expect(await screen.findByRole('heading', { name: 'Cuisine' })).toBeInTheDocument();
    expect(screen.getByText('Maison · RDC')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom avant')).toBeInTheDocument();
    expect(screen.getByLabelText('Couleur du sol')).toHaveValue('#E5FFFC');
  });

  it('sauvegarde le brouillon de pièce avec la transaction canonique du niveau', async () => {
    renderView();
    const name = await screen.findByLabelText('Nom');
    fireEvent.change(name, { target: { value: 'Cuisine ouverte' } });
    const save = screen.getByRole('button', { name: 'Sauvegarder' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(saveLevelRoomSnapshots).toHaveBeenCalledWith('level', expect.any(Array), 4));
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
