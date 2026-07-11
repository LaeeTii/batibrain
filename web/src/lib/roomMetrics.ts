import { polygonAreaCm2, syncWallsWithVertices } from '../domain/geometry';
import type { Opening, Vertex, Wall } from '../domain/types';
import type { RoomSnapshot } from '../services/rooms';

export interface RoomMetricSummary {
  roomId: string;
  name: string;
  areaM2: number;
  wallCount: number;
  openingsCount: number;
  doorsCount: number;
  windowsCount: number;
  minHeightCm: number | null;
  maxHeightCm: number | null;
}

export interface LevelOpeningSummary {
  openingId: string;
  roomId: string;
  roomName: string;
  wallId: string;
  wallIndex: number;
  wallLabel: string;
  type: Opening['type'];
  widthCm: number;
  heightCm: number;
  bottomCm: number;
  offsetCm: number;
}

export interface LevelMetricSummary {
  roomCount: number;
  totalAreaM2: number;
  exteriorWallsCount: number;
  openingsCount: number;
  doorsCount: number;
  windowsCount: number;
  minHeightCm: number | null;
  maxHeightCm: number | null;
  rooms: RoomMetricSummary[];
  openings: LevelOpeningSummary[];
}

function sortVertices(vertices: Vertex[]): Vertex[] {
  return [...vertices].sort((left, right) => left.order - right.order);
}

function buildWallKey(snapshot: RoomSnapshot, wallId: string): string | null {
  const wall = snapshot.walls.find((candidate) => candidate.id === wallId);
  if (!wall) {
    return null;
  }

  const verticesById = new Map(snapshot.vertices.map((vertex) => [vertex.id, vertex]));
  const start = verticesById.get(wall.startVertexId);
  const end = verticesById.get(wall.endVertexId);
  if (!start || !end) {
    return null;
  }

  const first = `${start.x},${start.y}`;
  const second = `${end.x},${end.y}`;
  return first <= second ? `${first}|${second}` : `${second}|${first}`;
}

export function getRoomAreaM2(vertices: Vertex[]): number {
  return polygonAreaCm2(sortVertices(vertices)) / 10000;
}

function collectWallHeights(wall: Wall): number[] {
  return [wall.heightLeftCm, wall.heightRightCm].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
}

function summarizeRoom(snapshot: RoomSnapshot): RoomMetricSummary {
  const syncedWalls = syncWallsWithVertices(snapshot.vertices, snapshot.walls);
  const heights = syncedWalls.flatMap(collectWallHeights);
  const doorsCount = snapshot.openings.filter((opening) => opening.type === 'door').length;
  const windowsCount = snapshot.openings.filter((opening) => opening.type === 'window').length;

  return {
    roomId: snapshot.room.id,
    name: snapshot.room.name,
    areaM2: getRoomAreaM2(snapshot.vertices),
    wallCount: syncedWalls.length,
    openingsCount: snapshot.openings.length,
    doorsCount,
    windowsCount,
    minHeightCm: heights.length > 0 ? Math.min(...heights) : null,
    maxHeightCm: heights.length > 0 ? Math.max(...heights) : null,
  };
}

function summarizeOpenings(snapshot: RoomSnapshot): LevelOpeningSummary[] {
  const syncedWalls = syncWallsWithVertices(snapshot.vertices, snapshot.walls);
  const wallIndexById = new Map(syncedWalls.map((wall, index) => [wall.id, index]));

  return snapshot.openings
    .map((opening) => {
      const wallIndex = wallIndexById.get(opening.wallId);
      if (wallIndex === undefined) {
        return null;
      }

      return {
        openingId: opening.id,
        roomId: snapshot.room.id,
        roomName: snapshot.room.name,
        wallId: opening.wallId,
        wallIndex,
        wallLabel: `Mur ${wallIndex + 1}`,
        type: opening.type,
        widthCm: opening.widthCm,
        heightCm: opening.heightCm,
        bottomCm: opening.bottomCm,
        offsetCm: opening.offsetCm,
      };
    })
    .filter((opening): opening is LevelOpeningSummary => opening !== null)
    .sort((left, right) => {
      if (left.roomName !== right.roomName) {
        return left.roomName.localeCompare(right.roomName, 'fr-FR');
      }

      if (left.wallIndex !== right.wallIndex) {
        return left.wallIndex - right.wallIndex;
      }

      return left.offsetCm - right.offsetCm;
    });
}

export function getLevelMetrics(snapshots: RoomSnapshot[]): LevelMetricSummary {
  const rooms = snapshots
    .map((snapshot) => summarizeRoom(snapshot))
    .sort((left, right) => right.areaM2 - left.areaM2);
  const openings = snapshots.flatMap((snapshot) => summarizeOpenings(snapshot));
  const roomHeights = rooms.flatMap((room) => [room.minHeightCm, room.maxHeightCm]).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );

  return {
    roomCount: snapshots.length,
    totalAreaM2: rooms.reduce((sum, room) => sum + room.areaM2, 0),
    exteriorWallsCount: countExteriorWalls(snapshots),
    openingsCount: openings.length,
    doorsCount: rooms.reduce((sum, room) => sum + room.doorsCount, 0),
    windowsCount: rooms.reduce((sum, room) => sum + room.windowsCount, 0),
    minHeightCm: roomHeights.length > 0 ? Math.min(...roomHeights) : null,
    maxHeightCm: roomHeights.length > 0 ? Math.max(...roomHeights) : null,
    rooms,
    openings,
  };
}

export function countExteriorWalls(snapshots: RoomSnapshot[]): number {
  const countsByWallKey = new Map<string, number>();

  for (const snapshot of snapshots) {
    for (const wall of snapshot.walls) {
      const key = buildWallKey(snapshot, wall.id);
      if (!key) {
        continue;
      }

      countsByWallKey.set(key, (countsByWallKey.get(key) ?? 0) + 1);
    }
  }

  return [...countsByWallKey.values()].filter((count) => count === 1).length;
}