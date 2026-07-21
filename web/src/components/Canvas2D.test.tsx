import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Canvas2D, CanvasDisplayOptionsMenu, CanvasSnappingOptionsMenu, DEFAULT_CANVAS_DISPLAY_OPTIONS, type CanvasLevelData } from './Canvas2D';
import { DEFAULT_PROJECT_VIEW_SETTINGS } from '../domain/viewSettings';

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
  it('rend déplaçables les sommets d’un mur autonome sélectionné', () => {
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const detachedLevels: CanvasLevelData[] = [{
      level: levels[0].level,
      rooms: [],
      detachedWalls: [{
        id: 'mur-autonome',
        start: { id: 'sommet-a', x: 0, y: 0, isLocked: false },
        end: { id: 'sommet-b', x: 200, y: 0, isLocked: false },
        wall: { id: 'mur-autonome', pieceId: '', pieceIds: [], startVertexId: 'sommet-a', endVertexId: 'sommet-b' },
      }],
    }];
    const snapDetachedPoint = vi.fn().mockReturnValue({ point: { x: 20, y: 20 }, guides: [] });
    const { container } = renderWithMantine(<Canvas2D levels={detachedLevels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} selection={{ source: 'canvas', type: 'wall', id: 'mur-autonome', levelId: 'niveau-rdc' }} editingEnabled snapDetachedPoint={snapDetachedPoint} onDetachedVertexMoveStart={onStart} onDetachedVertexMove={onMove} onDetachedVertexMoveEnd={onEnd} />);
    const vertex = container.querySelector('.canvas-detached-vertex')!;
    vertex.setAttribute('data-konva-drag-x', '25');
    vertex.setAttribute('data-konva-drag-y', '30');
    fireEvent.dragStart(vertex);
    fireEvent.drag(vertex);
    fireEvent.dragEnd(vertex);
    expect(onStart).toHaveBeenCalledWith('sommet-a');
    expect(snapDetachedPoint).toHaveBeenCalledWith({ x: 25, y: 30 }, 'sommet-a');
    expect(onMove).toHaveBeenCalledWith('sommet-a', { x: 20, y: 20 });
    expect(onEnd).toHaveBeenCalledWith('sommet-a', { x: 20, y: 20 });
  });

  it('recentre le viewport sur la géométrie chargée après le montage', () => {
    const emptyLevels = [{ ...levels[0], rooms: [] }];
    const { rerender } = renderWithMantine(<Canvas2D levels={emptyLevels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} />);
    expect(screen.getByText(/X : -500 cm/)).toBeInTheDocument();

    rerender(<MantineProvider><Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} /></MantineProvider>);

    expect(screen.getByText(/X : -110 cm → 430 cm/)).toBeInTheDocument();
    expect(screen.getByText(/Y : -130 cm → 370 cm/)).toBeInTheDocument();
  });

  it('affiche le nom, la surface, l’icône métier, le repère et l’échelle', () => {
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} />);
    expect(screen.getByText('Cuisine')).toBeInTheDocument();
    expect(screen.getByText('6 m²')).toBeInTheDocument();
    expect(container.querySelector('polygon')).toHaveAttribute('fill', '#E5FFFC');
    expect(container.querySelector('.canvas2d-roomIcon svg')).toBeInTheDocument();
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
    expect(screen.queryByText('6 m²')).not.toBeInTheDocument();
    expect(container.querySelector('.canvas2d-roomIcon')).not.toBeInTheDocument();
    expect(container.querySelector('foreignObject')).not.toBeInTheDocument();
    expect(container.querySelector('.canvas2d-background')).toHaveAttribute('fill', '#fff');
    expect(container.querySelector('.canvas-grid')).not.toBeInTheDocument();
  });

  it('applique les unités préférées aux longueurs et aux surfaces', () => {
    renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} lengthUnit="m" surfaceUnit="cm2" />);
    expect(screen.getByText(/60.000 cm²/)).toBeInTheDocument();
    expect(screen.getAllByText('3 m')).not.toHaveLength(0);
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

  it('signale uniquement un clic simple sur le fond du plan', () => {
    const onCanvasBlankClick = vi.fn();
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} onCanvasBlankClick={onCanvasBlankClick} />);
    const background = container.querySelector('.canvas2d-background')!;
    const stage = container.querySelector('svg')!;

    fireEvent.mouseDown(background, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(stage, { clientX: 30, clientY: 30 });
    fireEvent.mouseUp(stage, { clientX: 30, clientY: 30 });
    fireEvent.click(background, { clientX: 30, clientY: 30 });
    expect(onCanvasBlankClick).not.toHaveBeenCalled();

    fireEvent.mouseDown(background, { clientX: 40, clientY: 40 });
    fireEvent.mouseUp(stage, { clientX: 40, clientY: 40 });
    fireEvent.click(background, { clientX: 40, clientY: 40 });
    expect(onCanvasBlankClick).toHaveBeenCalledOnce();

    fireEvent.click(container.querySelector('polygon')!);
    expect(onCanvasBlankClick).toHaveBeenCalledOnce();
  });

  it('place les poignées de la pièce sélectionnée au-dessus du rendu des pièces', () => {
    const { container } = renderWithMantine(<Canvas2D levels={levels} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} editingEnabled selection={{ source: 'canvas', type: 'room', id: 'pièce-1', levelId: 'niveau-rdc' }} />);
    expect(container.querySelectorAll('.canvas-vertex-handle')).toHaveLength(4);
    expect(container.querySelector('.canvas-vertex-handles')?.parentElement?.lastElementChild).toBe(container.querySelector('.canvas-vertex-handles'));
  });

  it('distingue l’aperçu du déplacement de sa validation au relâchement', () => {
    const onVertexMoveStart = vi.fn();
    const onVertexMove = vi.fn();
    const onVertexMoveEnd = vi.fn();
    const { container } = renderWithMantine(<Canvas2D
      levels={levels}
      activeLevelId="niveau-rdc"
      visibleLevelIds={['niveau-rdc']}
      editingEnabled
      selection={{ source: 'canvas', type: 'room', id: 'pièce-1', levelId: 'niveau-rdc' }}
      onVertexMoveStart={onVertexMoveStart}
      onVertexMove={onVertexMove}
      onVertexMoveEnd={onVertexMoveEnd}
    />);
    const handle = container.querySelector('.canvas-vertex-handle')!;

    fireEvent.dragStart(handle, { clientX: 10, clientY: 20 });
    handle.setAttribute('data-konva-drag-x', '25');
    handle.setAttribute('data-konva-drag-y', '30');
    fireEvent.drag(handle, { clientX: 25, clientY: 30 });
    handle.setAttribute('data-konva-drag-x', '40');
    handle.setAttribute('data-konva-drag-y', '50');
    fireEvent.drag(handle, { clientX: 40, clientY: 50 });
    handle.setAttribute('data-konva-drag-x', '50');
    handle.setAttribute('data-konva-drag-y', '60');
    fireEvent.dragEnd(handle, { clientX: 50, clientY: 60 });

    expect(onVertexMoveStart).toHaveBeenCalledOnce();
    expect(onVertexMove).toHaveBeenCalledTimes(3);
    expect(onVertexMoveEnd).toHaveBeenCalledOnce();
    expect(onVertexMoveEnd).toHaveBeenCalledWith('pièce-1', 'a', { x: 50, y: 60 });
  });

  it('affiche les guides orthogonaux pendant le déplacement magnétisé d’un sommet', () => {
    const { container } = renderWithMantine(<Canvas2D
      levels={levels}
      activeLevelId="niveau-rdc"
      visibleLevelIds={['niveau-rdc']}
      editingEnabled
      selection={{ source: 'canvas', type: 'room', id: 'pièce-1', levelId: 'niveau-rdc' }}
      snapPoint={() => ({
        point: { x: 310, y: 20 },
        guides: [{ axis: 'vertical', value: 310 }, { axis: 'horizontal', value: 20 }],
      })}
    />);
    const handle = container.querySelector('.canvas-vertex-handle')!;
    handle.setAttribute('data-konva-drag-x', '307');
    handle.setAttribute('data-konva-drag-y', '23');

    fireEvent.drag(handle, { clientX: 307, clientY: 23 });

    expect(container.querySelector('.canvas-snap-guide--vertical')).toHaveAttribute('points', expect.stringContaining('310,'));
    expect(container.querySelector('.canvas-snap-guide--horizontal')).toHaveAttribute('points', expect.stringContaining(',20'));
  });

  it('ouvre au clic droit le menu de verrouillage et de suppression d’un sommet', async () => {
    const onVertexLockToggle = vi.fn();
    const onVertexDelete = vi.fn();
    const { container } = renderWithMantine(<Canvas2D
      levels={levels}
      activeLevelId="niveau-rdc"
      visibleLevelIds={['niveau-rdc']}
      editingEnabled
      selection={{ source: 'canvas', type: 'room', id: 'pièce-1', levelId: 'niveau-rdc' }}
      onVertexLockToggle={onVertexLockToggle}
      onVertexDelete={onVertexDelete}
    />);
    const handle = container.querySelector('.canvas-vertex-handle')!;

    fireEvent.contextMenu(handle, { clientX: 120, clientY: 80 });
    expect(await screen.findByRole('menuitem', { name: 'Verrouiller' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    expect(onVertexDelete).toHaveBeenCalledWith('pièce-1', 'a');
    expect(onVertexLockToggle).not.toHaveBeenCalled();
  });

  it('rend un mur mitoyen une seule fois', () => {
    const { container } = renderWithMantine(<Canvas2D levels={levelsWithSharedWall} activeLevelId="niveau-rdc" visibleLevelIds={['niveau-rdc']} />);
    expect(container.querySelectorAll('.canvas-level-wall')).toHaveLength(7);
  });

  it('rend un niveau plus haut en filigrane au-dessus du niveau actif', () => {
    const upperLevel: CanvasLevelData = {
      level: { ...levels[0].level, id: 'niveau-étage', name: 'Étage', number: 1, altitudeCm: 300 },
      rooms: levels[0].rooms.map((snapshot) => ({
        ...snapshot,
        room: { ...snapshot.room, id: 'pièce-étage', levelId: 'niveau-étage', name: 'Chambre' },
        vertices: snapshot.vertices.map((vertex) => ({
          ...vertex,
          id: `${vertex.id}-étage`,
          pieceId: 'pièce-étage',
          x: vertex.x + 500,
        })),
      })),
    };
    const onSelect = vi.fn();
    const { container } = renderWithMantine(<Canvas2D
      levels={[upperLevel, ...levels]}
      activeLevelId="niveau-rdc"
      visibleLevelIds={['niveau-rdc', 'niveau-étage']}
      onSelect={onSelect}
    />);

    expect(container.querySelectorAll('.canvas2d-context-level')).toHaveLength(1);
    expect(container.querySelectorAll('.canvas2d-context-level .canvas2d-context-room')).toHaveLength(1);
    expect(container.querySelectorAll('.canvas-level-wall')).toHaveLength(0);
    const contextLevel = container.querySelector('.canvas2d-context-level')!;
    const activeLevel = container.querySelector('.canvas2d-active-level')!;
    expect(activeLevel.compareDocumentPosition(contextLevel) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    fireEvent.click(contextLevel.querySelector('polygon')!);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Chambre')).toBeInTheDocument();
    expect(screen.queryByText('6 m²')).toBeInTheDocument();
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

describe('CanvasSnappingOptionsMenu', () => {
  it('expose les six sources et la distance de capture', () => {
    const onChange = vi.fn();
    renderWithMantine(<CanvasSnappingOptionsMenu value={DEFAULT_PROJECT_VIEW_SETTINGS.snapping} onChange={onChange} />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    expect(screen.getByRole('checkbox', { name: 'Guides orthogonaux' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Murs' }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_PROJECT_VIEW_SETTINGS.snapping, walls: false });
    fireEvent.change(screen.getByLabelText('Distance de capture (cm)'), { target: { value: '18' } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_PROJECT_VIEW_SETTINGS.snapping, distanceCm: 18 });
  });
});
