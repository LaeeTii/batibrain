import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Vertex } from '../domain/types';
import { RoomCanvas } from './RoomCanvas';

const vertices: Vertex[] = [
  { id: 'a', pieceId: 'pièce-1', order: 0, x: 0, y: 0 },
  { id: 'b', pieceId: 'pièce-1', order: 1, x: 300, y: 0 },
  { id: 'c', pieceId: 'pièce-1', order: 2, x: 300, y: 200 },
  { id: 'd', pieceId: 'pièce-1', order: 3, x: 0, y: 200 },
];

describe('RoomCanvas en lecture seule', () => {
  it('conserve la consultation sans émettre de modification géométrique', () => {
    const onVerticesChange = vi.fn();
    const { container } = render(
      <MantineProvider>
        <RoomCanvas
          vertices={vertices}
          readOnly
          onVerticesChange={onVerticesChange}
        />
      </MantineProvider>,
    );

    fireEvent.doubleClick(container.querySelector('svg')!);
    fireEvent.doubleClick(container.querySelector('g[style*="cursor"]')!);

    expect(onVerticesChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Supprimer le sommet sélectionné' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Insérer un sommet entre les sommets sélectionnés' })).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: /Longueur du mur/ })).not.toBeInTheDocument();
  });
});
