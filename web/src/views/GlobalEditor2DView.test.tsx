import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionHistoryProvider } from '../components/ActionHistory';
import { DEFAULT_CANVAS_DISPLAY_OPTIONS, type CanvasLevelData } from '../components/Canvas2D';
import { SelectionSyncBridge } from '../components/SelectionSyncBridge';
import { PreferencesProvider } from '../components/PreferencesContext';
import { DEFAULT_USER_PREFERENCES } from '../domain/userPreferences';
import type { Project } from '../domain/types';
import type { GlobalEditorAccess } from '../domain/globalEditorAccess';
import { GlobalEditorContent } from './GlobalEditor2DView';

const project: Project = { id: 'p1', name: 'Maison', ownerUserId: 'u1', updatedAt: '2026-07-14T10:00:00Z' };
const data: CanvasLevelData = { level: { id: 'l1', projectId: 'p1', name: 'RDC', number: 0, isVisible: true }, rooms: [{ room: { id: 'r1', levelId: 'l1', name: 'Cuisine', type: 'cuisine', floorColor: '#E5FFFC', isLocked: true }, vertices: [{ id: 'a', pieceId: 'r1', order: 0, x: 0, y: 0 }, { id: 'b', pieceId: 'r1', order: 1, x: 200, y: 0 }, { id: 'c', pieceId: 'r1', order: 2, x: 200, y: 200 }], walls: [], openings: [] }] };

function renderContent(access: GlobalEditorAccess = { readOnly: false, reason: null, message: null }) {
  const gateway = { load: vi.fn().mockResolvedValue(DEFAULT_USER_PREFERENCES), save: vi.fn() };
  return render(<MantineProvider><PreferencesProvider gateway={gateway}><ActionHistoryProvider><SelectionSyncBridge validObjects={new Set(['level:l1', 'room:r1'])}><GlobalEditorContent project={project} levels={[data.level]} levelData={[data]} activeLevelId="l1" visibleLevelIds={['l1']} options={DEFAULT_CANVAS_DISPLAY_OPTIONS} loading={false} error="" access={access} onRetry={vi.fn()} onOptionsChange={vi.fn()} onToggleLevel={vi.fn()} onActiveLevelChange={vi.fn()} /></SelectionSyncBridge></ActionHistoryProvider></PreferencesProvider></MantineProvider>);
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
  });
});
