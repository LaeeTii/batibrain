import { describe, expect, it } from 'vitest';
import type { TopologyWall, Vertex } from './types';
import {
  WallTopologyError,
  addPieceToWall,
  createStableWallFaces,
  createWallsFromVertices,
  removePieceFromWall,
  splitWallAtThirdPieceJunction,
  wallQualification,
} from './wall';

function rectangleVertices(): Vertex[] {
  return [
    { id: 'a', pieceId: 'pièce-1', order: 0, x: 0, y: 0 },
    { id: 'b', pieceId: 'pièce-1', order: 1, x: 200, y: 0 },
    { id: 'c', pieceId: 'pièce-1', order: 2, x: 200, y: 200 },
    { id: 'd', pieceId: 'pièce-1', order: 3, x: 0, y: 200 },
  ];
}

function topologyWall(overrides: Partial<TopologyWall> = {}): TopologyWall {
  return {
    id: 'mur-source',
    startVertexId: 'a',
    endVertexId: 'b',
    faces: createStableWallFaces(),
    pieceIds: ['pièce-1'],
    thicknessCm: 10,
    material: null,
    insulation: null,
    notes: null,
    isLocked: false,
    heightProfilesLinked: true,
    ...overrides,
  };
}

describe('génération des murs d’une pièce', () => {
  it('génère un segment par paire de sommets consécutifs avec fermeture implicite', () => {
    let sequence = 0;
    const walls = createWallsFromVertices(rectangleVertices(), {
      createId: () => `mur-${sequence += 1}`,
    });

    expect(walls).toHaveLength(4);
    expect(walls.map(({ startVertexId, endVertexId }) => [startVertexId, endVertexId])).toEqual([
      ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'],
    ]);
    expect(walls.every(({ pieceIds }) => pieceIds.join() === 'pièce-1')).toBe(true);
    expect(walls.every(({ faces }) => (
      faces[0].side === 'gauche' && faces[1].side === 'droite'
    ))).toBe(true);
  });

  it('conserve l’identité, les relations, les faces et les propriétés après déplacement', () => {
    const [existing] = createWallsFromVertices(rectangleVertices(), { createId: () => 'mur-a-b' });
    const customized: TopologyWall = {
      ...existing,
      pieceIds: ['pièce-1', 'pièce-2'],
      thicknessCm: 18,
      material: 'brique',
      notes: 'Mur porteur',
      isLocked: true,
    };
    const moved = rectangleVertices().map((vertex) => (
      vertex.id === 'b' ? { ...vertex, x: 250 } : vertex
    ));
    const [regenerated] = createWallsFromVertices(moved, { existingWalls: [customized] });

    expect(regenerated).toEqual(customized);
    expect(regenerated.faces).not.toBe(customized.faces);
    expect(regenerated.pieceIds).not.toBe(customized.pieceIds);
  });
});

describe('relations mur-pièce', () => {
  it('qualifie un mur selon son nombre de pièces distinctes', () => {
    const detached = topologyWall({ pieceIds: [] });
    const exterior = addPieceToWall(detached, 'pièce-1');
    const interior = addPieceToWall(exterior, 'pièce-2');

    expect(wallQualification(detached)).toBe('detached');
    expect(wallQualification(exterior)).toBe('exterior');
    expect(wallQualification(interior)).toBe('interior');
    expect(wallQualification(removePieceFromWall(interior, 'pièce-2'))).toBe('exterior');
  });

  it('refuse toujours une troisième relation', () => {
    const interior = topologyWall({ pieceIds: ['pièce-1', 'pièce-2'] });
    expect(() => addPieceToWall(interior, 'pièce-3')).toThrow(WallTopologyError);

    try {
      addPieceToWall(interior, 'pièce-3');
    } catch (error) {
      expect(error).toMatchObject({ code: 'too_many_pieces', wallId: 'mur-source' });
    }
  });
});

describe('jonction d’une troisième pièce', () => {
  it('produit trois murs distincts et conserve les propriétés des deux moitiés', () => {
    const source = topologyWall({
      pieceIds: ['pièce-1', 'pièce-2'],
      thicknessCm: 22,
      material: 'pierre',
      insulation: 'liège',
      notes: 'Mitoyen',
      isLocked: true,
    });
    const joining = topologyWall({
      id: 'mur-aboutissant',
      startVertexId: 'c',
      endVertexId: 'jonction',
      pieceIds: ['pièce-3'],
    });
    const verticesById = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 200, y: 0 }],
      ['c', { x: 100, y: 100 }],
      ['jonction', { x: 100, y: 0 }],
    ]);

    const walls = splitWallAtThirdPieceJunction({
      wall: source,
      joiningWall: joining,
      junction: { id: 'jonction', x: 100, y: 0 },
      verticesById,
      createId: () => 'mur-seconde-moitié',
    });

    expect(walls.map(({ id }) => id)).toEqual([
      'mur-source', 'mur-seconde-moitié', 'mur-aboutissant',
    ]);
    expect(walls.map(({ startVertexId, endVertexId }) => [startVertexId, endVertexId])).toEqual([
      ['a', 'jonction'], ['jonction', 'b'], ['c', 'jonction'],
    ]);
    expect(walls.slice(0, 2).every((wall) => (
      wall.thicknessCm === 22
      && wall.material === 'pierre'
      && wall.insulation === 'liège'
      && wall.notes === 'Mitoyen'
      && wall.isLocked
    ))).toBe(true);
    expect(walls.every(({ pieceIds }) => pieceIds.length <= 2)).toBe(true);
  });

  it('refuse une jonction située sur une extrémité', () => {
    const source = topologyWall({ pieceIds: ['pièce-1', 'pièce-2'] });
    const joining = topologyWall({
      id: 'mur-aboutissant',
      startVertexId: 'c',
      endVertexId: 'a',
      pieceIds: ['pièce-3'],
    });

    expect(() => splitWallAtThirdPieceJunction({
      wall: source,
      joiningWall: joining,
      junction: { id: 'a', x: 0, y: 0 },
      verticesById: new Map([['a', { x: 0, y: 0 }], ['b', { x: 200, y: 0 }]]),
    })).toThrowError(expect.objectContaining({ code: 'junction_not_inside_wall' }));
  });
});
