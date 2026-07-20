import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { WallElevationCanvas } from './WallElevationCanvas';

describe('WallElevationCanvas', () => {
  const points = [
    { id: 'p1', wallId: 'wall', faceSide: 'gauche' as const, order: 0, positionCm: 0, heightCm: 250 },
    { id: 'p2', wallId: 'wall', faceSide: 'gauche' as const, order: 1, positionCm: 400, heightCm: 250 },
  ];

  it('rend les mesures et les contrôles de zoom partagés', () => {
    const { container } = render(<MantineProvider><WallElevationCanvas wallLengthCm={400} points={points} openings={[]} /></MantineProvider>);
    expect(screen.getByLabelText('Zoom avant')).toBeInTheDocument();
    expect(screen.getByLabelText(/Échelle graphique/)).toBeInTheDocument();
    expect(container.querySelector('.wall-elevation-floor')?.getAttribute('points')).toMatch(/,520(?: |$)/);
  });

  it('permet de sélectionner une ouverture', () => {
    const onSelectOpening = vi.fn();
    const { container } = render(<MantineProvider><WallElevationCanvas
      wallLengthCm={400}
      points={points}
      openings={[{ id: 'opening', wallId: 'wall', type: 'door', offsetCm: 20, widthCm: 90, bottomCm: 0, heightCm: 210 }]}
      onSelectOpening={onSelectOpening}
    /></MantineProvider>);
    const rectangles = container.querySelectorAll('rect');
    fireEvent.click(rectangles[1]);
    expect(onSelectOpening).toHaveBeenCalledWith('opening');
  });

  it('distingue les limites pleines des guides intermédiaires pointillés', () => {
    const { container } = render(<MantineProvider><WallElevationCanvas
      wallLengthCm={400}
      points={[
        points[0],
        { id: 'p-middle', wallId: 'wall', faceSide: 'gauche', order: 1, positionCm: 200, heightCm: 280 },
        { ...points[1], order: 2 },
      ]}
      openings={[]}
    /></MantineProvider>);

    const endpointGuides = container.querySelectorAll('.wall-profile-guide--endpoint');
    const intermediateGuides = container.querySelectorAll('.wall-profile-guide--intermediate');
    expect(endpointGuides).toHaveLength(2);
    expect(intermediateGuides).toHaveLength(1);
    expect(endpointGuides[0]).not.toHaveAttribute('stroke-dasharray');
    expect(intermediateGuides[0]).toHaveAttribute('stroke-dasharray', '7 5');
  });

  it('affiche le profil de la face opposée en filigrane', () => {
    const { container } = render(<MantineProvider><WallElevationCanvas
      wallLengthCm={400}
      points={points}
      oppositePoints={[
        { ...points[0], id: 'opposite-1', faceSide: 'droite', heightCm: 300 },
        { ...points[1], id: 'opposite-2', faceSide: 'droite', heightCm: 280 },
      ]}
      openings={[]}
    /></MantineProvider>);

    const watermark = container.querySelector('.wall-opposite-profile-watermark');
    expect(watermark).toBeInTheDocument();
    expect(watermark?.tagName).toBe('polygon');
    expect(watermark).toHaveAttribute('stroke-dasharray', '10 7');
  });
});
