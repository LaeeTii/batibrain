import type { Point, Vertex } from './types';
import type { CanvasSnappingOptions } from './viewSettings';

const EPSILON = 1e-7;

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function intersects(a: Point, b: Point, c: Point, d: Point) {
  const abC = orientation(a, b, c); const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a); const cdB = orientation(c, d, b);
  return abC * abD < -EPSILON && cdA * cdB < -EPSILON;
}

export function validateRoomPolygon(vertices: readonly Vertex[]): string | null {
  const sorted = [...vertices].sort((a, b) => a.order - b.order);
  if (sorted.length < 3) return 'Une pièce doit contenir au moins trois sommets.';
  if (sorted.some((vertex, index) => vertex.order !== index || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y))) return 'Les sommets doivent être finis, uniques et ordonnés sans interruption.';
  for (let index = 0; index < sorted.length; index += 1) {
    const next = (index + 1) % sorted.length;
    if (Math.hypot(sorted[next].x - sorted[index].x, sorted[next].y - sorted[index].y) <= EPSILON) return 'Deux sommets consécutifs ne peuvent pas être confondus.';
    for (let other = index + 1; other < sorted.length; other += 1) {
      const otherNext = (other + 1) % sorted.length;
      if (index === other || next === other || otherNext === index) continue;
      if (intersects(sorted[index], sorted[next], sorted[other], sorted[otherNext])) return 'Le contour d’une pièce ne peut pas s’auto-intersecter.';
    }
  }
  return null;
}

export function snapGlobalPoint(point: Point, vertices: readonly Vertex[], movingId: string | null, distanceCm = 12, gridCm = 25): Point {
  return snapEditorPoint(
    point,
    vertices.filter(({ id }) => id !== movingId),
    [],
    { grid: true, vertices: true, intersections: false, walls: false, midpoints: false, guides: false, distanceCm },
    gridCm,
  );
}

export interface SnapSegment {
  start: Point;
  end: Point;
}

export interface SnapGuide {
  axis: 'horizontal' | 'vertical';
  value: number;
}

export interface SnapPointResult {
  point: Point;
  guides: SnapGuide[];
}

export function polygonSnapSegments(vertices: readonly Vertex[]): SnapSegment[] {
  const sorted = [...vertices].sort((left, right) => left.order - right.order);
  return sorted.map((start, index) => ({ start, end: sorted[(index + 1) % sorted.length] })).filter(({ end }) => Boolean(end));
}

function pointOnSegment(point: Point, segment: SnapSegment): Point {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return segment.start;
  const ratio = Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared));
  return { x: segment.start.x + ratio * dx, y: segment.start.y + ratio * dy };
}

function segmentIntersection(left: SnapSegment, right: SnapSegment): Point | null {
  const leftDx = left.end.x - left.start.x;
  const leftDy = left.end.y - left.start.y;
  const rightDx = right.end.x - right.start.x;
  const rightDy = right.end.y - right.start.y;
  const denominator = leftDx * rightDy - leftDy * rightDx;
  if (Math.abs(denominator) <= EPSILON) return null;
  const offsetX = right.start.x - left.start.x;
  const offsetY = right.start.y - left.start.y;
  const leftRatio = (offsetX * rightDy - offsetY * rightDx) / denominator;
  const rightRatio = (offsetX * leftDy - offsetY * leftDx) / denominator;
  if (leftRatio < -EPSILON || leftRatio > 1 + EPSILON || rightRatio < -EPSILON || rightRatio > 1 + EPSILON) return null;
  return { x: left.start.x + leftRatio * leftDx, y: left.start.y + leftRatio * leftDy };
}

function closestAxisValue(value: number, references: readonly number[], distanceCm: number): number | null {
  let closest: number | null = null;
  let closestDistance = distanceCm;
  for (const reference of references) {
    const distance = Math.abs(reference - value);
    if (distance <= closestDistance) {
      closest = reference;
      closestDistance = distance;
    }
  }
  return closest;
}

function guidesAtPoint(point: Point, vertices: readonly Point[]): SnapGuide[] {
  const guides: SnapGuide[] = [];
  if (vertices.some((vertex) => Math.abs(vertex.x - point.x) <= EPSILON)) {
    guides.push({ axis: 'vertical', value: point.x });
  }
  if (vertices.some((vertex) => Math.abs(vertex.y - point.y) <= EPSILON)) {
    guides.push({ axis: 'horizontal', value: point.y });
  }
  return guides;
}

export function snapEditorPointWithGuides(
  point: Point,
  vertices: readonly Point[],
  segments: readonly SnapSegment[],
  options: CanvasSnappingOptions,
  gridCm = 25,
): SnapPointResult {
  const candidates: Point[] = [];
  if (options.vertices) candidates.push(...vertices);
  if (options.midpoints) candidates.push(...segments.map(({ start, end }) => ({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 })));
  if (options.walls) candidates.push(...segments.map((segment) => pointOnSegment(point, segment)));
  if (options.intersections) {
    for (let left = 0; left < segments.length; left += 1) {
      for (let right = left + 1; right < segments.length; right += 1) {
        const intersection = segmentIntersection(segments[left], segments[right]);
        if (intersection) candidates.push(intersection);
      }
    }
  }
  if (options.grid) candidates.push({ x: Math.round(point.x / gridCm) * gridCm, y: Math.round(point.y / gridCm) * gridCm });

  let best = point;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance <= options.distanceCm && distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  if (options.guides) {
    const vertical = closestAxisValue(point.x, vertices.map(({ x }) => x), options.distanceCm);
    const horizontal = closestAxisValue(point.y, vertices.map(({ y }) => y), options.distanceCm);
    const guidedPoint = {
      x: vertical ?? point.x,
      y: horizontal ?? point.y,
    };
    const guideDistance = Math.hypot(guidedPoint.x - point.x, guidedPoint.y - point.y);
    if ((vertical !== null || horizontal !== null) && guideDistance <= bestDistance) {
      return {
        point: guidedPoint,
        guides: [
          ...(vertical === null ? [] : [{ axis: 'vertical' as const, value: vertical }]),
          ...(horizontal === null ? [] : [{ axis: 'horizontal' as const, value: horizontal }]),
        ],
      };
    }
  }

  return {
    point: { ...best },
    guides: options.guides ? guidesAtPoint(best, vertices) : [],
  };
}

export function snapEditorPoint(
  point: Point,
  vertices: readonly Point[],
  segments: readonly SnapSegment[],
  options: CanvasSnappingOptions,
  gridCm = 25,
): Point {
  return snapEditorPointWithGuides(point, vertices, segments, options, gridCm).point;
}

export function translateRoomVertices(vertices: readonly Vertex[], delta: Point): Vertex[] {
  return vertices.map((vertex) => ({ ...vertex, x: vertex.x + delta.x, y: vertex.y + delta.y }));
}
