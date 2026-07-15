import { describe, expect, it } from 'vitest';
import { expandViewportToCanvas, panViewport, zoomViewport } from './canvasViewport';

describe('navigation visuelle du canvas', () => {
  it('zoome autour du point d’ancrage sans modifier ce point métier', () => {
    const anchor = { x: 120, y: -40 };
    const result = zoomViewport({ x: 0, y: -100, width: 400, height: 200 }, 2, anchor);
    expect(result).toEqual({ x: 60, y: -70, width: 200, height: 100 });
    expect(anchor).toEqual({ x: 120, y: -40 });
  });

  it('panoramique uniquement le viewport', () => {
    const viewport = { x: 0, y: 0, width: 400, height: 300 };
    const pointMetier = { x: 25, y: 75 };
    expect(panViewport(viewport, { x: -20, y: 35 })).toEqual({ x: -20, y: 35, width: 400, height: 300 });
    expect(pointMetier).toEqual({ x: 25, y: 75 });
  });

  it('étend le viewport sur toute la largeur du canvas', () => {
    expect(expandViewportToCanvas({ x: 0, y: 0, width: 500, height: 500 }, 1000, 500)).toEqual({
      x: -250,
      y: 0,
      width: 1000,
      height: 500,
    });
  });

  it('étend le viewport sur toute la hauteur du canvas', () => {
    expect(expandViewportToCanvas({ x: 0, y: 0, width: 500, height: 250 }, 500, 500)).toEqual({
      x: 0,
      y: -125,
      width: 500,
      height: 500,
    });
  });
});
