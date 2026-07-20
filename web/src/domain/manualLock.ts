import type { TopologyWall, Vertex, WallHeightProfilePoint } from './types';

export function manualLockActionLabel(isLocked: boolean): 'Verrouiller' | 'Déverrouiller' {
  return isLocked ? 'Déverrouiller' : 'Verrouiller';
}

export function wallLockState(
  wall: Pick<TopologyWall, 'startVertexId' | 'endVertexId'>,
  vertices: readonly Vertex[],
): boolean {
  const verticesById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  return verticesById.get(wall.startVertexId)?.isLocked === true
    && verticesById.get(wall.endVertexId)?.isLocked === true;
}

export function roomLockState(vertices: readonly Vertex[]): boolean {
  return vertices.length > 0 && vertices.every(({ isLocked }) => isLocked === true);
}

export function profileLockState(points: readonly WallHeightProfilePoint[]): boolean {
  return points.length > 0 && points.every(({ isLocked }) => isLocked === true);
}

export function setVertexLocks(
  vertices: readonly Vertex[],
  vertexIds: ReadonlySet<string>,
  locked: boolean,
): Vertex[] {
  return vertices.map((vertex) => (
    vertexIds.has(vertex.id) ? { ...vertex, isLocked: locked } : vertex
  ));
}

export function setProfilePointLocks(
  points: readonly WallHeightProfilePoint[],
  locked: boolean,
): WallHeightProfilePoint[] {
  return points.map((point) => ({ ...point, isLocked: locked }));
}
