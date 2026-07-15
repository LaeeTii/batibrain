import earcut from 'earcut';
import * as clipping from 'polygon-clipping';
import { polygonAreaCm2, sortVertices, syncWallsWithVertices } from './geometry';
import type { Opening, Point, Room, Vertex, Wall } from './types';

const AREA_EPSILON_CM2 = 0.01;
type Ring = clipping.Ring;
type Polygon = clipping.Polygon;
type MultiPolygon = clipping.MultiPolygon;

export interface RoomGeometrySnapshot {
  room: Room;
  vertices: Vertex[];
  walls: Wall[];
  openings: Opening[];
}

function uniqueById<T extends { id: string }>(values: readonly T[]): T[] {
  const result = new Map<string, T>();
  values.forEach((value) => {
    if (!result.has(value.id)) result.set(value.id, value);
  });
  return [...result.values()];
}

export function uniqueLevelWalls(snapshots: readonly RoomGeometrySnapshot[]): Wall[] {
  return uniqueById(snapshots.flatMap(({ walls }) => walls));
}

export function uniqueLevelOpenings(snapshots: readonly RoomGeometrySnapshot[]): Opening[] {
  return uniqueById(snapshots.flatMap(({ openings }) => openings));
}

export function reconcilePersistedRoomIds(
  currentIds: ReadonlySet<string>,
  replacedIds: readonly string[],
  resultIds: readonly string[],
): Set<string> {
  const next = new Set(currentIds);
  replacedIds.forEach((id) => next.delete(id));
  resultIds.forEach((id) => next.add(id));
  return next;
}

function snapshotPolygon(snapshot: RoomGeometrySnapshot): Polygon {
  const ring: Ring = sortVertices(snapshot.vertices).map(({ x, y }) => [x, y]);
  return [[...ring, ring[0]]];
}

function openRing(ring: Ring): Point[] {
  const points = ring.map(([x, y]) => ({ x, y }));
  if (points.length > 1 && points[0].x === points.at(-1)?.x && points[0].y === points.at(-1)?.y) points.pop();
  return points;
}

function triangulate(polygon: Polygon): Polygon[] {
  const coordinates: number[] = [];
  const holes: number[] = [];
  polygon.forEach((ring, index) => {
    if (index > 0) holes.push(coordinates.length / 2);
    openRing(ring).forEach(({ x, y }) => coordinates.push(x, y));
  });
  const indices = earcut(coordinates, holes, 2);
  return Array.from({ length: indices.length / 3 }, (_, index) => {
    const ring = indices.slice(index * 3, index * 3 + 3).map((vertexIndex) => [coordinates[vertexIndex * 2], coordinates[vertexIndex * 2 + 1]] as [number, number]);
    return [[...ring, ring[0]]];
  });
}

function mergeTriangles(polygons: Polygon[]): Polygon[] {
  const result = [...polygons];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let left = 0; left < result.length; left += 1) {
      for (let right = left + 1; right < result.length; right += 1) {
        const union = clipping.union(result[left], result[right]);
        if (union.length === 1 && union[0].length === 1) {
          result.splice(right, 1);
          result[left] = union[0];
          merged = true;
          break outer;
        }
      }
    }
  }
  return result;
}

function simpleRings(geometry: MultiPolygon): Point[][] {
  return geometry.flatMap((polygon) => {
    const pieces = polygon.length === 1 ? [polygon] : mergeTriangles(triangulate(polygon));
    return pieces.map((piece) => openRing(piece[0])).filter((points) => points.length >= 3 && polygonAreaCm2(points) > AREA_EPSILON_CM2);
  });
}

function snapshotFromPoints(source: RoomGeometrySnapshot, points: Point[], id: string, name: string): RoomGeometrySnapshot {
  const vertices: Vertex[] = points.map((point, order) => ({ x: normalizeCoordinateCm(point.x), y: normalizeCoordinateCm(point.y), id: crypto.randomUUID(), pieceId: id, order }));
  const sourceWall = source.walls[0];
  const walls: Wall[] = syncWallsWithVertices(vertices, []).map((wall) => ({
    ...wall,
    thicknessCm: sourceWall?.thicknessCm ?? 10,
    heightLeftCm: sourceWall?.heightLeftCm ?? sourceWall?.heightRightCm ?? 250,
    heightRightCm: sourceWall?.heightRightCm ?? sourceWall?.heightLeftCm ?? 250,
  }));
  return { room: { ...source.room, id, name }, vertices, walls, openings: [] };
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) return false;
  const cross = Math.abs((end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x));
  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  return cross / length < 0.01 && dot >= -0.01 && dot <= length * length + 0.01;
}

function remapOpenings(source: RoomGeometrySnapshot, snapshots: RoomGeometrySnapshot[]): void {
  const sourceVertices = new Map(source.vertices.map((vertex) => [vertex.id, vertex]));
  for (const opening of source.openings) {
    const sourceWall = source.walls.find(({ id }) => id === opening.wallId);
    const start = sourceWall ? sourceVertices.get(sourceWall.startVertexId) : undefined;
    const end = sourceWall ? sourceVertices.get(sourceWall.endVertexId) : undefined;
    if (!start || !end) throw new Error('Une ouverture ne peut pas être rattachée après la découpe.');
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const openingStart = { x: start.x + unit.x * opening.offsetCm, y: start.y + unit.y * opening.offsetCm };
    const openingEnd = { x: start.x + unit.x * (opening.offsetCm + opening.widthCm), y: start.y + unit.y * (opening.offsetCm + opening.widthCm) };
    let attached = false;
    for (const snapshot of snapshots) {
      const vertices = new Map(snapshot.vertices.map((vertex) => [vertex.id, vertex]));
      const target = snapshot.walls.find((wall) => {
        const wallStart = vertices.get(wall.startVertexId);
        const wallEnd = vertices.get(wall.endVertexId);
        return Boolean(wallStart && wallEnd && pointOnSegment(openingStart, wallStart, wallEnd) && pointOnSegment(openingEnd, wallStart, wallEnd));
      });
      if (!target) continue;
      const wallStart = vertices.get(target.startVertexId)!;
      snapshot.openings.push({ ...opening, wallId: target.id, offsetCm: Math.hypot(openingStart.x - wallStart.x, openingStart.y - wallStart.y) });
      attached = true;
      break;
    }
    if (!attached) throw new Error('Le chevauchement couperait une ouverture. Déplacez-la avant de découper la pièce.');
  }
}

function snapshotsFromGeometry(source: RoomGeometrySnapshot, geometry: MultiPolygon, keepSourceId: boolean): RoomGeometrySnapshot[] {
  const snapshots = simpleRings(geometry).map((points, index) => snapshotFromPoints(
    source,
    points,
    keepSourceId && index === 0 ? source.room.id : crypto.randomUUID(),
    index === 0 ? source.room.name : `${source.room.name} ${index + 1}`,
  ));
  remapOpenings(source, snapshots);
  return snapshots;
}

export function normalizeCoordinateCm(value: number): number {
  return Math.round(value * 100) / 100;
}

function coordinateKey(point: Point): string {
  return `${normalizeCoordinateCm(point.x)},${normalizeCoordinateCm(point.y)}`;
}

function segmentKey(start: Point, end: Point): string {
  return [coordinateKey(start), coordinateKey(end)].sort().join('|');
}

export function linkCoincidentWalls(snapshots: RoomGeometrySnapshot[]): RoomGeometrySnapshot[] {
  const wallIdBySegment = new Map<string, string>();
  const primarySegmentByWallId = new Map<string, string>();
  const replacementIdsByWallId = new Map<string, Map<string, string>>();
  return snapshots.map((snapshot) => {
    const vertices = new Map(snapshot.vertices.map((vertex) => [vertex.id, vertex]));
    return {
      ...snapshot,
      walls: snapshot.walls.map((wall) => {
        const start = vertices.get(wall.startVertexId);
        const end = vertices.get(wall.endVertexId);
        if (!start || !end) return wall;
        const key = segmentKey(start, end);
        const primarySegment = primarySegmentByWallId.get(wall.id);
        if (!primarySegment) primarySegmentByWallId.set(wall.id, key);
        let isolatedId = wall.id;
        if (primarySegment && primarySegment !== key) {
          const replacements = replacementIdsByWallId.get(wall.id) ?? new Map<string, string>();
          isolatedId = replacements.get(key) ?? crypto.randomUUID();
          replacements.set(key, isolatedId);
          replacementIdsByWallId.set(wall.id, replacements);
        }
        const sharedId = wallIdBySegment.get(key) ?? isolatedId;
        wallIdBySegment.set(key, sharedId);
        return sharedId === wall.id ? wall : { ...wall, id: sharedId };
      }),
    };
  });
}

export function linkedVertexIds(snapshots: readonly RoomGeometrySnapshot[], roomId: string, vertexId: string): Set<string> {
  const source = snapshots.find(({ room }) => room.id === roomId);
  const sourceVertex = source?.vertices.find(({ id }) => id === vertexId);
  if (!source || !sourceVertex) return new Set([vertexId]);
  const sourceKey = coordinateKey(sourceVertex);
  return new Set(snapshots.flatMap(({ vertices }) => vertices
    .filter((vertex) => coordinateKey(vertex) === sourceKey)
    .map(({ id }) => id)));
}

export function moveLinkedVertex(snapshots: readonly RoomGeometrySnapshot[], roomId: string, vertexId: string, point: Point): RoomGeometrySnapshot[] {
  const ids = linkedVertexIds(snapshots, roomId, vertexId);
  const normalizedPoint = { x: normalizeCoordinateCm(point.x), y: normalizeCoordinateCm(point.y) };
  return snapshots.map((snapshot) => {
    const vertices = snapshot.vertices.map((vertex) => ids.has(vertex.id) ? { ...vertex, ...normalizedPoint } : vertex);
    return vertices.some((vertex, index) => vertex !== snapshot.vertices[index]) ? { ...snapshot, vertices } : snapshot;
  });
}

export function moveRoomWithLinkedVertices(snapshots: readonly RoomGeometrySnapshot[], roomId: string, delta: Point): RoomGeometrySnapshot[] {
  const source = snapshots.find(({ room }) => room.id === roomId);
  if (!source) return [...snapshots];
  return source.vertices.reduce<RoomGeometrySnapshot[]>((current, vertex) => moveLinkedVertex(
    current,
    roomId,
    vertex.id,
    { x: normalizeCoordinateCm(vertex.x + delta.x), y: normalizeCoordinateCm(vertex.y + delta.y) },
  ), [...snapshots]);
}

export interface RoomOverlapNormalization {
  snapshots: RoomGeometrySnapshot[];
  replacedRoomIds: string[];
  overlapCount: number;
}

export function normalizeCreatedRoomOverlaps(created: RoomGeometrySnapshot, existing: readonly RoomGeometrySnapshot[]): RoomOverlapNormalization {
  const createdPolygon = snapshotPolygon(created);
  const affected = existing.filter((snapshot) => clipping.intersection(createdPolygon, snapshotPolygon(snapshot)).some((polygon) => simpleRings([polygon]).length > 0));
  if (affected.length === 0) return { snapshots: [created], replacedRoomIds: [], overlapCount: 0 };
  if (affected.some(({ room }) => room.isLocked)) throw new Error('Une pièce verrouillée ne peut pas être découpée.');
  if (affected.some(({ openings }) => openings.length > 0)) {
    throw new Error('Le chevauchement touche une pièce avec ouverture. Déplacez l’ouverture avant de découper la pièce.');
  }
  const snapshots: RoomGeometrySnapshot[] = [];
  for (const source of affected) {
    const sourcePolygon = snapshotPolygon(source);
    snapshots.push(...snapshotsFromGeometry(source, clipping.difference(sourcePolygon, createdPolygon), true));
    const intersection = clipping.intersection(sourcePolygon, createdPolygon);
    snapshots.push(...simpleRings(intersection).map((points) => snapshotFromPoints(created, points, crypto.randomUUID(), 'Zone de chevauchement')));
  }
  snapshots.push(...snapshotsFromGeometry(created, clipping.difference(createdPolygon, ...affected.map(snapshotPolygon)), true));
  const linkedSnapshots = linkCoincidentWalls(snapshots);
  return { snapshots: linkedSnapshots, replacedRoomIds: affected.map(({ room }) => room.id), overlapCount: linkedSnapshots.filter(({ room }) => room.name === 'Zone de chevauchement').length };
}
