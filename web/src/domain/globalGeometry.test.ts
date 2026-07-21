import { describe, expect, it } from 'vitest';
import type { Vertex } from './types';
import { snapEditorPoint, snapEditorPointWithGuides, snapGlobalPoint, translateRoomVertices, validateRoomPolygon } from './globalGeometry';

const rectangle: Vertex[] = [{ id: 'a', pieceId: 'r', order: 0, x: 0, y: 0 }, { id: 'b', pieceId: 'r', order: 1, x: 100, y: 0 }, { id: 'c', pieceId: 'r', order: 2, x: 100, y: 100 }, { id: 'd', pieceId: 'r', order: 3, x: 0, y: 100 }];

describe('édition géométrique globale', () => {
  it('refuse un contour auto-intersecté', () => expect(validateRoomPolygon([rectangle[0], rectangle[2], rectangle[1], rectangle[3]].map((v, order) => ({ ...v, order })))).toMatch(/auto-intersecter/));
  it('magnétise vers un sommet puis vers la grille', () => { expect(snapGlobalPoint({ x: 96, y: 4 }, rectangle, null)).toEqual({ x: 100, y: 0 }); expect(snapGlobalPoint({ x: 48, y: 52 }, [], null)).toEqual({ x: 50, y: 50 }); });
  it('respecte les sources et la distance de capture configurées', () => {
    const segment = [{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }];
    expect(snapEditorPoint({ x: 48, y: 4 }, [], segment, { grid: false, vertices: false, intersections: false, walls: false, midpoints: true, guides: false, distanceCm: 5 })).toEqual({ x: 50, y: 0 });
    expect(snapEditorPoint({ x: 48, y: 4 }, [], segment, { grid: false, vertices: false, intersections: false, walls: false, midpoints: false, guides: false, distanceCm: 5 })).toEqual({ x: 48, y: 4 });
  });
  it('aligne séparément les axes sur les sommets de référence et expose les guides', () => {
    const result = snapEditorPointWithGuides(
      { x: 97, y: 4 },
      [{ x: 100, y: 80 }, { x: 40, y: 0 }],
      [],
      { grid: false, vertices: false, intersections: false, walls: false, midpoints: false, guides: true, distanceCm: 5 },
    );
    expect(result).toEqual({
      point: { x: 100, y: 0 },
      guides: [{ axis: 'vertical', value: 100 }, { axis: 'horizontal', value: 0 }],
    });
  });
  it('déplace une pièce sans modifier son ordre', () => expect(translateRoomVertices(rectangle, { x: 10, y: -5 })[2]).toMatchObject({ order: 2, x: 110, y: 95 }));
});
