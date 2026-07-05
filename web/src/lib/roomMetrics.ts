import { polygonAreaCm2 } from '../../../shared/src/geometry';
import type { Vertex } from '../../../shared/src/types';
import type { RoomSnapshot } from '../services/rooms';

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