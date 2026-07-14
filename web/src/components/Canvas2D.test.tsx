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

describe('Canvas2D', () => {
  it('affiche le nom, la surface, l’icône métier, le repère et l’échelle', () => {
    renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} />);
    expect(screen.getByText('Cuisine')).toBeInTheDocument();
    expect(screen.getByText('6.00 m²')).toBeInTheDocument();
    expect(screen.getByText('0,0')).toBeInTheDocument();
    expect(screen.getByLabelText(/Échelle graphique/)).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom avant')).toBeInTheDocument();
  });

  it('respecte les options masquant surfaces, icônes et grille', () => {
    const options = { ...DEFAULT_CANVAS_DISPLAY_OPTIONS, grid: false, surfaces: false, roomIcons: false };
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} options={options} />);
    expect(screen.queryByText('6.00 m²')).not.toBeInTheDocument();
    expect(container.querySelector('foreignObject')).not.toBeInTheDocument();
    expect(container.querySelector('.canvas2d-background')).toHaveAttribute('fill', '#fff');
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
