import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import type { RoomSnapshot } from '../services/rooms';
import { RoomCard } from './RoomCard';

const SNAPSHOT: RoomSnapshot = {
  room: {
    id: 'pièce-1',
    levelId: 'niveau-1',
    name: 'Salon',
    type: 'salon',
    floorColor: '#ffffff',
  },
  vertices: [
    { id: 'a', pieceId: 'pièce-1', order: 0, x: 0, y: 0 },
    { id: 'b', pieceId: 'pièce-1', order: 1, x: 300, y: 0 },
    { id: 'c', pieceId: 'pièce-1', order: 2, x: 300, y: 200 },
    { id: 'd', pieceId: 'pièce-1', order: 3, x: 0, y: 200 },
  ],
  walls: [],
  openings: [],
};

function renderCard(canEdit: boolean) {
  const handlers = {
    onOpen: vi.fn(),
    onAddNote: vi.fn(),
    onDelete: vi.fn(),
    onExport: vi.fn(),
  };
  render(<MantineProvider><RoomCard
    snapshot={SNAPSHOT}
    levelName="Rez-de-chaussée"
    areaM2={6}
    canEdit={canEdit}
    {...handlers}
  /></MantineProvider>);
  return handlers;
}

describe('droits de la carte pièce', () => {
  it('conserve consultation et export sans exposer d’écriture en lecture seule', () => {
    const handlers = renderCard(false);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir Salon' }));
    expect(handlers.onOpen).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Exporter Salon' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter une note à Salon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer Salon' })).not.toBeInTheDocument();
  });

  it('expose les actions métier avec un droit d’écriture', () => {
    renderCard(true);

    expect(screen.getByRole('button', { name: 'Ajouter une note à Salon' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer Salon' })).toBeInTheDocument();
  });
});
