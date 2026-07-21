import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('place la liste compacte après le bloc d’édition', async () => {
    const onUpdateRoom = vi.fn();
    const roomData: CanvasLevelData = {
      ...data,
      rooms: [{
        room: { id: 'r1', levelId: 'l1', name: 'Cuisine', type: 'cuisine', floorColor: '#fff' },
        vertices: [],
        walls: [],
        openings: [],
      }],
    };
    const { container } = render(<MantineProvider><SelectionSyncBridge validObjects={new Set(['level:l1', 'room:r1'])}><EditorCreationPanel levels={[data.level]} levelData={[roomData]} activeLevelId="l1" onUpdateRoom={onUpdateRoom} /></SelectionSyncBridge></MantineProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Pièces' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cuisine' }));

    const nameField = await screen.findByLabelText('Nom');
    const listItem = screen.getByRole('button', { name: 'Cuisine' });
    const list = listItem.closest<HTMLElement>('.editor-panel__object-list')!;
    expect(container).toContainElement(list);
    expect(list).toContainElement(listItem);
    expect(nameField.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(listItem).toHaveClass('mantine-Button-root');

    fireEvent.change(screen.getByLabelText('Couleur du sol'), { target: { value: '#123456' } });
    expect(onUpdateRoom).toHaveBeenCalledWith(expect.objectContaining({ floorColor: '#123456' }));
  });

  it('ferme la section active à la demande du canvas', () => {
    const view = (dismissKey: number) => <MantineProvider><SelectionSyncBridge validObjects={new Set(['level:l1'])}><EditorCreationPanel levels={[data.level]} levelData={[data]} activeLevelId="l1" dismissKey={dismissKey} /></SelectionSyncBridge></MantineProvider>;
    const { rerender } = render(view(0));
    fireEvent.click(screen.getByRole('button', { name: 'Pièces' }));
    expect(screen.getByRole('button', { name: 'Retour' })).toBeInTheDocument();

    rerender(view(1));
    expect(screen.queryByRole('button', { name: 'Retour' })).not.toBeInTheDocument();
  });

  it('expose les actions métier du mur sélectionné', async () => {
    const onSplitWall = vi.fn();
    const onDetachWall = vi.fn();
    const wallData: CanvasLevelData = { ...data, rooms: [{ room: { id: 'r1', levelId: 'l1', name: 'Pièce', type: 'autre', floorColor: '#fff' }, vertices: [], walls: [{ id: 'w1', pieceId: 'r1', pieceIds: ['r1'], startVertexId: 'a', endVertexId: 'b' }], openings: [] }] };
    render(<MantineProvider><SelectionSyncBridge validObjects={new Set(['wall:w1'])}><EditorCreationPanel levels={[data.level]} levelData={[wallData]} activeLevelId="l1" onSplitWall={onSplitWall} onDetachWall={onDetachWall} /></SelectionSyncBridge></MantineProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Murs' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mur w1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Couper en deux' }));
    fireEvent.click(screen.getByRole('button', { name: 'Détacher' }));
    expect(onSplitWall).toHaveBeenCalledWith('w1');
    expect(onDetachWall).toHaveBeenCalledWith('w1');
  });

  it('inverse séparément le sens et le côté ouvrant', async () => {
    const onUpdateOpening = vi.fn();
    const opening = { id: 'o1', wallId: 'w1', type: 'door' as const, offsetCm: 10, widthCm: 90, bottomCm: 0, heightCm: 210, orientation: 'normal' as const, hingeSide: 'left' as const };
    const openingData: CanvasLevelData = { ...data, rooms: [{ room: { id: 'r1', levelId: 'l1', name: 'Pièce', type: 'autre', floorColor: '#fff' }, vertices: [], walls: [], openings: [opening] }] };
    render(<MantineProvider><SelectionSyncBridge validObjects={new Set(['opening:o1'])}><EditorCreationPanel levels={[data.level]} levelData={[openingData]} activeLevelId="l1" onUpdateOpening={onUpdateOpening} /></SelectionSyncBridge></MantineProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvertures' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Porte o1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Inverser le sens' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrant gauche' }));
    expect(onUpdateOpening).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'inverse' }));
    expect(onUpdateOpening).toHaveBeenCalledWith(expect.objectContaining({ hingeSide: 'right' }));
  });
});
