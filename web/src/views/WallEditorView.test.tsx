import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../components/PreferencesContext';
import { UnsavedChangesProvider } from '../components/UnsavedChangesContext';
import { DEFAULT_USER_PREFERENCES } from '../domain/userPreferences';
import type { RoomSnapshot } from '../services/rooms';
import { canWriteProject } from '../services/projects';
import { saveLevelRoomSnapshots } from '../services/rooms';
import { WallEditorView } from './WallEditorView';

vi.mock('../lib/supabase', () => ({ hasSupabaseConfig: () => true }));
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
  room: { id: 'room', levelId: 'level', name: 'Cuisine', type: 'cuisine', floorColor: '#fff' },
  vertices: [
    { id: 'v1', pieceId: 'room', order: 0, x: 0, y: 0 },
    { id: 'v2', pieceId: 'room', order: 1, x: 400, y: 0 },
    { id: 'v3', pieceId: 'room', order: 2, x: 400, y: 300 },
  ],
  walls: [{
    id: 'wall', pieceId: 'room', startVertexId: 'v1', endVertexId: 'v2',
    pieceIds: ['room'], thicknessCm: 10, material: null, insulation: null,
    heightProfilesLinked: true,
    heightProfiles: {
      wallId: 'wall',
      gauche: [
        { id: 'g1', wallId: 'wall', faceSide: 'gauche', order: 0, positionCm: 0, heightCm: 250 },
        { id: 'g2', wallId: 'wall', faceSide: 'gauche', order: 1, positionCm: 200, heightCm: 275 },
        { id: 'g3', wallId: 'wall', faceSide: 'gauche', order: 2, positionCm: 400, heightCm: 250 },
      ],
      droite: [
        { id: 'd1', wallId: 'wall', faceSide: 'droite', order: 0, positionCm: 0, heightCm: 250 },
        { id: 'd2', wallId: 'wall', faceSide: 'droite', order: 1, positionCm: 200, heightCm: 275 },
        { id: 'd3', wallId: 'wall', faceSide: 'droite', order: 2, positionCm: 400, heightCm: 250 },
      ],
    },
  }],
  openings: [],
};

function renderView() {
  const gateway = { load: vi.fn().mockResolvedValue(DEFAULT_USER_PREFERENCES), save: vi.fn() };
  return render(<MantineProvider><UnsavedChangesProvider><PreferencesProvider gateway={gateway}>
    <WallEditorView projectId="project" levelId="level" wallId="wall" roomId="room" onBack={vi.fn()} />
  </PreferencesProvider></UnsavedChangesProvider></MantineProvider>);
}

describe('WallEditorView', () => {
  beforeEach(async () => {
    vi.mocked(canWriteProject).mockResolvedValue(true);
    const rooms = await import('../services/rooms');
    vi.mocked(rooms.loadLevelGeometrySnapshot).mockResolvedValue({ levelId: 'level', revision: 2, rooms: [snapshot] });
    vi.mocked(saveLevelRoomSnapshots).mockResolvedValue({ levelId: 'level', revision: 3, rooms: [snapshot] });
  });

  it('charge la face orientée vers la pièce et expose le canvas React-Konva', async () => {
    const { container } = renderView();
    expect(await screen.findByText(/Mur wall/)).toBeInTheDocument();
    expect(screen.getByLabelText('Face affichée')).toHaveValue('gauche');
    expect(screen.getByLabelText('Zoom avant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sauvegarder' })).toBeDisabled();
    expect(container.querySelector('.wall-opposite-profile-watermark')).toBeInTheDocument();

    const profileRows = container.querySelectorAll('.wall-editor__profile-point-row');
    expect(profileRows).toHaveLength(3);
    expect(within(profileRows[0] as HTMLElement).getByText('Gauche')).toBeInTheDocument();
    expect(within(profileRows[1] as HTMLElement).getByText('A')).toBeInTheDocument();
    expect(within(profileRows[2] as HTMLElement).getByText('Droite')).toBeInTheDocument();
    expect(within(profileRows[1] as HTMLElement).getAllByRole('textbox')).toHaveLength(2);
  });

  it('conserve un brouillon de profil puis le sauvegarde par la transaction canonique', async () => {
    renderView();
    const heights = await screen.findAllByLabelText(/^Hauteur /);
    fireEvent.change(heights[0], { target: { value: '260' } });
    const save = screen.getByRole('button', { name: 'Sauvegarder' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(saveLevelRoomSnapshots).toHaveBeenCalledWith('level', expect.any(Array), 2));
  });

  it('conserve les deux faces consultables en lecture seule', async () => {
    vi.mocked(canWriteProject).mockResolvedValue(false);
    renderView();
    expect(await screen.findByText('Lecture seule')).toBeInTheDocument();
    expect(screen.getByLabelText('Face affichée')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sauvegarder' })).toBeDisabled();
  });
});
