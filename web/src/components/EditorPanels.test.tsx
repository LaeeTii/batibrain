import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
