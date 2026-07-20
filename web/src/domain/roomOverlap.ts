import earcut from 'earcut';
import * as clipping from 'polygon-clipping';
import { polygonAreaCm2, sortVertices, syncWallsWithVertices } from './geometry';
import type {
  Opening,
  Point,
  Room,
  Vertex,
  Wall,
  WallFaceSide,
  WallHeightProfilePoint,
  WallHeightProfiles,
} from './types';
import {
  createUniformWallHeightProfiles,
  resizeWallHeightProfiles,
  wallHeightAtPosition,
} from './wallHeightProfile';

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
  const vertices: Vertex[] = points.map((point, order) => ({
    x: normalizeCoordinateCm(point.x),
    y: normalizeCoordinateCm(point.y),
    id: crypto.randomUUID(),
    pieceId: id,
    order,
    isLocked: false,
  }));
  const sourceVertices = new Map(source.vertices.map((vertex) => [vertex.id, vertex]));
  const walls: Wall[] = syncWallsWithVertices(vertices, []).map((wall) => {
    const start = vertices.find(({ id: vertexId }) => vertexId === wall.startVertexId)!;
    const end = vertices.find(({ id: vertexId }) => vertexId === wall.endVertexId)!;
    const sourceMatch = source.walls.find((candidate) => {
      const sourceStart = sourceVertices.get(candidate.startVertexId);
      const sourceEnd = sourceVertices.get(candidate.endVertexId);
      return Boolean(
        sourceStart
        && sourceEnd
        && pointOnSegment(start, sourceStart, sourceEnd)
        && pointOnSegment(end, sourceStart, sourceEnd),
      );
    });
    if (!sourceMatch) {
      const fallback = source.walls[0];
      return {
        ...wall,
        thicknessCm: fallback?.thicknessCm ?? 10,
        heightLeftCm: fallback?.heightLeftCm ?? fallback?.heightRightCm ?? 250,
        heightRightCm: fallback?.heightRightCm ?? fallback?.heightLeftCm ?? 250,
      };
    }

    const sourceStart = sourceVertices.get(sourceMatch.startVertexId)!;
    const sourceEnd = sourceVertices.get(sourceMatch.endVertexId)!;
    const sourceLengthCm = Math.hypot(sourceEnd.x - sourceStart.x, sourceEnd.y - sourceStart.y);
    const startPositionCm = distanceAlongSegment(start, sourceStart, sourceEnd);
    const endPositionCm = distanceAlongSegment(end, sourceStart, sourceEnd);
    const targetLengthCm = Math.abs(endPositionCm - startPositionCm);
    const exactSegment = targetLengthCm === sourceLengthCm;
    const sourceProfiles = sourceMatch.heightProfiles
      ?? createUniformWallHeightProfiles(
        sourceMatch.id,
        sourceLengthCm,
        sourceMatch.heightLeftCm ?? sourceMatch.heightRightCm ?? 250,
      );
    const profiles = sliceWallProfiles(
      exactSegment ? sourceMatch.id : wall.id,
      sourceProfiles,
      sourceLengthCm,
      startPositionCm,
      endPositionCm,
      exactSegment,
    );
    return {
      ...sourceMatch,
      id: exactSegment ? sourceMatch.id : wall.id,
      pieceId: id,
      startVertexId: wall.startVertexId,
      endVertexId: wall.endVertexId,
      heightLeftCm: profiles.gauche[0]?.heightCm ?? sourceMatch.heightLeftCm,
      heightRightCm: profiles.droite[0]?.heightCm ?? sourceMatch.heightRightCm,
      heightProfiles: profiles,
    };
  });
  return { room: { ...source.room, id, name }, vertices, walls, openings: [] };
}

function distanceAlongSegment(point: Point, start: Point, end: Point): number {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) return 0;
  return ((point.x - start.x) * (end.x - start.x)
    + (point.y - start.y) * (end.y - start.y)) / length;
}

function sliceWallProfiles(
  wallId: string,
  profiles: WallHeightProfiles,
  sourceLengthCm: number,
  startPositionCm: number,
  endPositionCm: number,
  preserveIds: boolean,
): WallHeightProfiles {
  const reversed = endPositionCm < startPositionCm;
  const rangeStartCm = reversed
    ? sourceLengthCm - startPositionCm
    : startPositionCm;
  const rangeEndCm = reversed
    ? sourceLengthCm - endPositionCm
    : endPositionCm;
  const sourceLeft = reversed
    ? reverseProfileForSlice(profiles.droite, sourceLengthCm)
    : profiles.gauche;
  const sourceRight = reversed
    ? reverseProfileForSlice(profiles.gauche, sourceLengthCm)
    : profiles.droite;
  return {
    wallId,
    gauche: sliceFaceProfile(wallId, 'gauche', sourceLeft, rangeStartCm, rangeEndCm, preserveIds),
    droite: sliceFaceProfile(wallId, 'droite', sourceRight, rangeStartCm, rangeEndCm, preserveIds),
  };
}

function reverseProfileForSlice(
  profile: readonly WallHeightProfilePoint[],
  lengthCm: number,
): WallHeightProfilePoint[] {
  return [...profile].reverse().map((point, order) => ({
    ...point,
    order,
    positionCm: lengthCm - point.positionCm,
  }));
}

function sliceFaceProfile(
  wallId: string,
  faceSide: WallFaceSide,
  profile: readonly WallHeightProfilePoint[],
  rangeStartCm: number,
  rangeEndCm: number,
  preserveIds: boolean,
): WallHeightProfilePoint[] {
  const internal = profile.filter(({ positionCm }) => (
    positionCm > rangeStartCm && positionCm < rangeEndCm
  ));
  const positions = [rangeStartCm, ...internal.map(({ positionCm }) => positionCm), rangeEndCm];
  return positions.map((positionCm, order) => {
    const existing = profile.find((point) => point.positionCm === positionCm);
    return {
      id: preserveIds && existing ? existing.id : crypto.randomUUID(),
      wallId,
      faceSide,
      order,
      positionCm: positionCm - rangeStartCm,
      heightCm: wallHeightAtPosition(profile, positionCm) ?? existing?.heightCm ?? 250,
      isLocked: preserveIds && existing?.isLocked === true,
    };
  });
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
  const vertexIdByPoint = new Map<string, string>();
  const snapshotsWithSharedVertices = snapshots.map((snapshot) => {
    const idRemap = new Map<string, string>();
    const vertices = snapshot.vertices.map((vertex) => {
      const key = coordinateKey(vertex);
      const sharedId = vertexIdByPoint.get(key) ?? vertex.id;
      vertexIdByPoint.set(key, sharedId);
      idRemap.set(vertex.id, sharedId);
      return sharedId === vertex.id ? vertex : { ...vertex, id: sharedId };
    });
    const walls = snapshot.walls.map((wall) => ({
      ...wall,
      startVertexId: idRemap.get(wall.startVertexId) ?? wall.startVertexId,
      endVertexId: idRemap.get(wall.endVertexId) ?? wall.endVertexId,
    }));
    return {
      ...snapshot,
      vertices,
      walls: syncWallsWithVertices(vertices, walls),
    };
  });
  const wallIdBySegment = new Map<string, string>();
  const primarySegmentByWallId = new Map<string, string>();
  const replacementIdsByWallId = new Map<string, Map<string, string>>();
  return snapshotsWithSharedVertices.map((snapshot) => {
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
        if (sharedId === wall.id) return wall;
        return {
          ...wall,
          id: sharedId,
          heightProfiles: wall.heightProfiles ? {
            wallId: sharedId,
            gauche: wall.heightProfiles.gauche.map((point) => ({
              ...point,
              wallId: sharedId,
            })),
            droite: wall.heightProfiles.droite.map((point) => ({
              ...point,
              wallId: sharedId,
            })),
          } : undefined,
        };
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
  return moveVerticesAndResizeProfiles(
    snapshots,
    new Map([...ids].map((id) => [id, normalizedPoint])),
  );
}

export function moveRoomWithLinkedVertices(snapshots: readonly RoomGeometrySnapshot[], roomId: string, delta: Point): RoomGeometrySnapshot[] {
  const source = snapshots.find(({ room }) => room.id === roomId);
  if (!source) return [...snapshots];
  if (source.vertices.some(({ isLocked }) => isLocked)) {
    throw new Error('Une pièce contenant un sommet verrouillé ne peut pas être déplacée.');
  }
  const targets = new Map<string, Point>();
  for (const vertex of source.vertices) {
    const point = {
      x: normalizeCoordinateCm(vertex.x + delta.x),
      y: normalizeCoordinateCm(vertex.y + delta.y),
    };
    linkedVertexIds(snapshots, roomId, vertex.id).forEach((id) => targets.set(id, point));
  }
  return moveVerticesAndResizeProfiles(snapshots, targets);
}

function moveVerticesAndResizeProfiles(
  snapshots: readonly RoomGeometrySnapshot[],
  targets: ReadonlyMap<string, Point>,
): RoomGeometrySnapshot[] {
  if (snapshots.some(({ vertices }) => (
    vertices.some((vertex) => targets.has(vertex.id) && vertex.isLocked)
  ))) {
    throw new Error('Un sommet verrouillé ne peut pas être déplacé.');
  }

  return snapshots.map((snapshot) => {
    const previousVertices = new Map(snapshot.vertices.map((vertex) => [vertex.id, vertex]));
    const vertices = snapshot.vertices.map((vertex) => {
      const target = targets.get(vertex.id);
      return target ? { ...vertex, ...target } : vertex;
    });
    if (!vertices.some((vertex, index) => vertex !== snapshot.vertices[index])) return snapshot;

    const verticesById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
    const walls = snapshot.walls.map((wall) => {
      if (!wall.heightProfiles) return wall;
      const previousStart = previousVertices.get(wall.startVertexId);
      const previousEnd = previousVertices.get(wall.endVertexId);
      const start = verticesById.get(wall.startVertexId);
      const end = verticesById.get(wall.endVertexId);
      if (!previousStart || !previousEnd || !start || !end) return wall;
      const previousLengthCm = Math.hypot(
        previousEnd.x - previousStart.x,
        previousEnd.y - previousStart.y,
      );
      const lengthCm = Math.hypot(end.x - start.x, end.y - start.y);
      if (Math.abs(previousLengthCm - lengthCm) < 1e-9) return wall;
      return {
        ...wall,
        heightProfiles: resizeWallHeightProfiles(
          { id: wall.id, heightProfilesLinked: wall.heightProfilesLinked ?? true },
          wall.heightProfiles,
          previousLengthCm,
          lengthCm,
        ),
      };
    });
    return { ...snapshot, vertices, walls };
  });
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
  if (affected.some(({ vertices }) => vertices.some(({ isLocked }) => isLocked))) {
    throw new Error('Une pièce contenant un sommet verrouillé ne peut pas être découpée.');
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
