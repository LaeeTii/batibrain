import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { CanvasLevelData } from './Canvas2D';
import { EditorCreationPanel } from './EditorPanels';
import { SelectionSyncBridge } from './SelectionSyncBridge';

const data: CanvasLevelData = { level: { id: 'l1', projectId: 'p1', name: 'RDC', number: 0, isVisible: true }, rooms: [] };

describe('EditorCreationPanel', () => {
  it('reste consultable en lecture seule et bloque les créations', () => {
    render(<MantineProvider><SelectionSyncBridge validObjects={new Set(['level:l1'])}><EditorCreationPanel levels={[data.level]} levelData={[data]} activeLevelId="l1" readOnly /></SelectionSyncBridge></MantineProvider>);
    expect(screen.getByText(/Consultation uniquement/)).toBeInTheDocument();
    expect(screen.getAllByText('Création disponible dans une prochaine étape')[0].closest('button')).toBeDisabled();
  });

  it('conserve la consultation d’un élément verrouillé', () => {
    render(<MantineProvider><SelectionSyncBridge validObjects={new Set(['level:l1'])}><EditorCreationPanel levels={[data.level]} levelData={[data]} activeLevelId="l1" selectionLocked /></SelectionSyncBridge></MantineProvider>);
    expect(screen.getByText(/Élément verrouillé/)).toBeInTheDocument();
    expect(screen.getByText('Création et édition')).toBeInTheDocument();
  });

  it('liste une seule fois un mur lié à deux pièces', async () => {
    const sharedWall = { id: 'mur-partage', pieceId: 'r1', startVertexId: 'a', endVertexId: 'b' };
    const sharedData: CanvasLevelData = {
      ...data,
      rooms: [
        { room: { id: 'r1', levelId: 'l1', name: 'A', type: 'autre', floorColor: '#fff' }, vertices: [], walls: [sharedWall], openings: [] },
        { room: { id: 'r2', levelId: 'l1', name: 'B', type: 'autre', floorColor: '#fff' }, vertices: [], walls: [{ ...sharedWall, pieceId: 'r2' }], openings: [] },
      ],
    };
    render(<MantineProvider><SelectionSyncBridge validObjects={new Set(['level:l1', 'wall:mur-partage'])}><EditorCreationPanel levels={[data.level]} levelData={[sharedData]} activeLevelId="l1" /></SelectionSyncBridge></MantineProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Murs' }));
    expect(await screen.findAllByRole('button', { name: 'Mur mur-part' })).toHaveLength(1);
  });
});
