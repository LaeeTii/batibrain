import { describe, expect, it } from 'vitest';
import type { Point, Segment } from './types';
import {
  centroid,
  createRectangleRoomGeometryFromPoints,
  distance,
  interiorSegmentLengthCm,
  polygonAreaCm2,
  polygonInteriorAnglesDegrees,
  polygonOrientation,
  polygonPerimeterCm,
  projectPointOnSegment,
  segmentOrientationDegrees,
  vector,
} from './geometry';

describe('création rectangulaire par deux points', () => {
  it('déduit librement les dimensions et l’origine, quel que soit l’ordre des points', () => {
    const result = createRectangleRoomGeometryFromPoints(
      'pièce-1',
      { x: 410, y: 260 },
      { x: 10, y: 60 },
      { wallThicknessCm: 12, wallHeightCm: 280 },
    );
    expect(result.vertices.map(({ x, y }) => [x, y])).toEqual([
      [10, 60], [410, 60], [410, 260], [10, 260],
    ]);
    expect(result.walls.every((wall) => wall.thicknessCm === 12 && wall.heightLeftCm === 280)).toBe(true);
  });

  it('refuse deux points qui ne définissent pas une surface', () => {
    expect(() => createRectangleRoomGeometryFromPoints('pièce-1', { x: 0, y: 0 }, { x: 0, y: 100 }))
      .toThrow('largeur');
  });
});

const rectangle: Point[] = [
  { x: -100, y: -50 },
  { x: 100, y: -50 },
  { x: 100, y: 50 },
  { x: -100, y: 50 },
];

describe('primitives géométriques', () => {
  it('calcule une distance et un vecteur en centimètres', () => {
    expect(distance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
    expect(vector({ x: -3, y: -4 }, { x: 0, y: 0 })).toEqual({ x: 3, y: 4 });
  });

  it('projette un point sur le segment et borne la projection à ses extrémités', () => {
    const segment: Segment = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };

    expect(projectPointOnSegment({ x: 40, y: 25 }, segment)).toEqual({ x: 40, y: 0 });
    expect(projectPointOnSegment({ x: 140, y: 25 }, segment)).toEqual({ x: 100, y: 0 });
  });

  it('retourne le point unique pour la projection sur un segment dégénéré', () => {
    const segment: Segment = { start: { x: -2, y: 7 }, end: { x: -2, y: 7 } };
    expect(projectPointOnSegment({ x: 50, y: 50 }, segment)).toEqual(segment.start);
  });
});

describe('métriques des polygones', () => {
  it('calcule surface, périmètre et centroïde d’un rectangle avec coordonnées négatives', () => {
    expect(polygonAreaCm2(rectangle)).toBe(20_000);
    expect(polygonPerimeterCm(rectangle)).toBe(600);
    expect(centroid(rectangle)).toEqual({ x: 0, y: 0 });
  });

  it('calcule un polygone concave', () => {
    const concave: Point[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];

    expect(polygonAreaCm2(concave)).toBe(12);
    expect(polygonPerimeterCm(concave)).toBe(16);
    expect(centroid(concave).x).toBeCloseTo(5 / 3);
    expect(centroid(concave).y).toBeCloseTo(5 / 3);
    expect(polygonInteriorAnglesDegrees(concave)).toEqual([90, 90, 90, 270, 90, 90]);
  });

  it('préserve les métriques et inverse l’orientation lorsque les sommets sont inversés', () => {
    const reversed = [...rectangle].reverse();
    expect(polygonOrientation(rectangle)).toBe('counterclockwise');
    expect(polygonOrientation(reversed)).toBe('clockwise');
    expect(polygonAreaCm2(reversed)).toBe(polygonAreaCm2(rectangle));
    expect(centroid(reversed)).toEqual(centroid(rectangle));
    expect(polygonInteriorAnglesDegrees(reversed)).toEqual([90, 90, 90, 90]);
  });

  it('retourne des valeurs neutres pour les polygones dégénérés', () => {
    const aligned: Point[] = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
    expect(polygonAreaCm2(aligned)).toBe(0);
    expect(polygonOrientation(aligned)).toBe('degenerate');
    expect(centroid(aligned)).toEqual({ x: 5, y: 0 });
    expect(polygonInteriorAnglesDegrees(aligned)).toEqual([0, 0, 0]);
    expect(polygonPerimeterCm([])).toBe(0);
  });
});

describe('métriques des segments', () => {
  it('calcule la longueur intérieure en retranchant les épaisseurs aux extrémités', () => {
    const segment: Segment = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
    expect(interiorSegmentLengthCm(segment, 10, 20)).toBe(70);
    expect(interiorSegmentLengthCm(segment, 80, 30)).toBe(0);
  });

  it('calcule l’orientation du segment entre 0 et 360 degrés', () => {
    expect(segmentOrientationDegrees({ start: { x: 0, y: 0 }, end: { x: 0, y: -10 } })).toBe(270);
    expect(segmentOrientationDegrees({ start: { x: 2, y: 2 }, end: { x: 2, y: 2 } })).toBeNull();
  });
});
