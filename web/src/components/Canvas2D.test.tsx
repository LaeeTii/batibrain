import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Canvas2D, CanvasDisplayOptionsMenu, DEFAULT_CANVAS_DISPLAY_OPTIONS, type CanvasLevelData } from './Canvas2D';

const renderWithMantine = (component: React.ReactNode) => render(<MantineProvider>{component}</MantineProvider>);

const levels: CanvasLevelData[] = [{
  level: { id: 'niveau-rdc', projectId: 'projet-1', name: 'RDC', number: 0, isVisible: true },
  rooms: [{
    room: { id: 'pièce-1', levelId: 'niveau-rdc', name: 'Cuisine', type: 'cuisine', floorColor: '#E5FFFC' },
    vertices: [
      { id: 'a', pieceId: 'pièce-1', order: 0, x: 10, y: 20 },
      { id: 'b', pieceId: 'pièce-1', order: 1, x: 310, y: 20 },
      { id: 'c', pieceId: 'pièce-1', order: 2, x: 310, y: 220 },
      { id: 'd', pieceId: 'pièce-1', order: 3, x: 10, y: 220 },
    ],
    walls: [], openings: [],
  }],
}];

const levelsWithSharedWall: CanvasLevelData[] = [{
  level: levels[0].level,
  rooms: [
    {
      room: { id: 'a-room', levelId: 'niveau-rdc', name: 'A', type: 'autre', floorColor: '#fff' },
      vertices: [
        { id: 'a1', pieceId: 'a-room', order: 0, x: 0, y: 0 }, { id: 'a2', pieceId: 'a-room', order: 1, x: 100, y: 0 },
        { id: 'a3', pieceId: 'a-room', order: 2, x: 100, y: 100 }, { id: 'a4', pieceId: 'a-room', order: 3, x: 0, y: 100 },
      ],
      walls: [
        { id: 'a-top', pieceId: 'a-room', startVertexId: 'a1', endVertexId: 'a2' },
        { id: 'shared', pieceId: 'a-room', startVertexId: 'a2', endVertexId: 'a3' },
        { id: 'a-bottom', pieceId: 'a-room', startVertexId: 'a3', endVertexId: 'a4' },
        { id: 'a-left', pieceId: 'a-room', startVertexId: 'a4', endVertexId: 'a1' },
      ], openings: [],
    },
    {
      room: { id: 'b-room', levelId: 'niveau-rdc', name: 'B', type: 'autre', floorColor: '#fff' },
      vertices: [
        { id: 'b1', pieceId: 'b-room', order: 0, x: 100, y: 0 }, { id: 'b2', pieceId: 'b-room', order: 1, x: 200, y: 0 },
        { id: 'b3', pieceId: 'b-room', order: 2, x: 200, y: 100 }, { id: 'b4', pieceId: 'b-room', order: 3, x: 100, y: 100 },
      ],
      walls: [
        { id: 'b-top', pieceId: 'b-room', startVertexId: 'b1', endVertexId: 'b2' },
        { id: 'b-right', pieceId: 'b-room', startVertexId: 'b2', endVertexId: 'b3' },
        { id: 'b-bottom', pieceId: 'b-room', startVertexId: 'b3', endVertexId: 'b4' },
        { id: 'shared', pieceId: 'b-room', startVertexId: 'b4', endVertexId: 'b1' },
      ], openings: [],
    },
  ],
}];

describe('Canvas2D', () => {
  it('affiche le nom, la surface, l’icône métier, le repère et l’échelle', () => {
    renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} />);
    expect(screen.getByText('Cuisine')).toBeInTheDocument();
    expect(screen.getByText('6.00 m²')).toBeInTheDocument();
    expect(screen.getByText('0,0')).toBeInTheDocument();
    expect(screen.getByLabelText(/Échelle graphique/)).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom avant')).toBeInTheDocument();
  });

  it('affiche la grille lorsqu’elle est activée', () => {
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} />);
    expect(container.querySelector('.canvas-grid')).toBeInTheDocument();
  });

  it('respecte les options masquant surfaces, icônes et grille', () => {
    const options = { ...DEFAULT_CANVAS_DISPLAY_OPTIONS, grid: false, surfaces: false, roomIcons: false };
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} options={options} />);
    expect(screen.queryByText('6.00 m²')).not.toBeInTheDocument();
    expect(container.querySelector('foreignObject')).not.toBeInTheDocument();
    expect(container.querySelector('.canvas2d-background')).toHaveAttribute('fill', '#fff');
    expect(container.querySelector('.canvas-grid')).not.toBeInTheDocument();
  });

  it('priorise les clics de création même au-dessus d’une pièce existante', () => {
    const onCanvasPoint = vi.fn(); const onSelect = vi.fn();
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} creationActive onCanvasPoint={onCanvasPoint} onSelect={onSelect} />);
    const svg = container.querySelector('svg')!; vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700, toJSON: () => ({}) });
    fireEvent.click(container.querySelector('polygon')!, { clientX: 500, clientY: 350 });
    expect(onCanvasPoint).toHaveBeenCalledOnce(); expect(onSelect).not.toHaveBeenCalled();
  });

  it('termine la création lorsque le clic tombe sur l’aperçu du rectangle', () => {
    const onCanvasPoint = vi.fn();
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} creationActive creationFirstPoint={{ x: 25, y: 25 }} creationPreviewPoint={{ x: 225, y: 175 }} onCanvasPoint={onCanvasPoint} />);
    fireEvent.click(container.querySelector('.canvas2d-creationPreview')!, { clientX: 225, clientY: 175 });
    expect(onCanvasPoint).toHaveBeenCalledOnce();
  });

  it('affiche les quatre futurs murs et un curseur dédié après le premier point', () => {
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} creationActive creationFirstPoint={{ x: 25, y: 25 }} creationPreviewPoint={{ x: 225, y: 175 }} />);
    expect(container.querySelector('.canvas2d')).toHaveClass('canvas2d--creating');
    expect(container.querySelector('.canvas2d-creationPreview')).toHaveAttribute('points', '25,25 225,25 225,175 25,175');
  });

  it('conserve la sélection normale hors mode création', () => {
    const onSelect = vi.fn(); const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} onSelect={onSelect} />);
    fireEvent.click(container.querySelector('polygon')!);
    expect(onSelect).toHaveBeenCalledWith({ source: 'canvas', type: 'room', id: 'pièce-1', levelId: 'niveau-rdc' });
  });

  it('place les poignées de la pièce sélectionnée au-dessus du rendu des pièces', () => {
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} editingEnabled selection={{ source: 'canvas', type: 'room', id: 'pièce-1', levelId: 'niveau-rdc' }} />);
    expect(container.querySelectorAll('.canvas-vertex-handle')).toHaveLength(4);
    expect(container.querySelector('.canvas-vertex-handles')?.parentElement?.lastElementChild).toBe(container.querySelector('.canvas-vertex-handles'));
  });

  it('rend un mur mitoyen une seule fois', () => {
    const { container } = renderWithMantine(<Canvas2D levels={levelsWithSharedWall} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} />);
    expect(container.querySelectorAll('.canvas-level-wall')).toHaveLength(7);
  });
});

describe('CanvasDisplayOptionsMenu', () => {
  it('expose toutes les options avec un état accessible', () => {
    const onChange = vi.fn();
    renderWithMantine(<CanvasDisplayOptionsMenu value={DEFAULT_CANVAS_DISPLAY_OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Notes' }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CANVAS_DISPLAY_OPTIONS, notes: false });
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
  });
});
