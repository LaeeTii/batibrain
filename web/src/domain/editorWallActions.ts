import type { Point, Wall, WallHeightProfilePoint, WallHeightProfiles } from './types';
import { assertLevelGeometrySnapshot, type LevelGeometrySnapshot } from './levelGeometry';
import type { RoomGeometrySnapshot } from './roomOverlap';
import { DEFAULT_ROOM_FLOOR_COLOR, DEFAULT_ROOM_NAME, DEFAULT_ROOM_TYPE } from './room';
import { createUniformWallHeightProfiles, resizeWallHeightProfiles } from './wallHeightProfile';

const EPSILON = 0.01;

function interpolateHeight(points: readonly WallHeightProfilePoint[], positionCm: number): number {
  const sorted = [...points].sort((left, right) => left.positionCm - right.positionCm);
  const rightIndex = sorted.findIndex((point) => point.positionCm >= positionCm);
  if (rightIndex <= 0) return sorted[0]?.heightCm ?? 250;
  const left = sorted[rightIndex - 1];
  const right = sorted[rightIndex];
  const ratio = (positionCm - left.positionCm) / (right.positionCm - left.positionCm);
  return left.heightCm + (right.heightCm - left.heightCm) * ratio;
}

function splitFace(
  points: readonly WallHeightProfilePoint[],
  wallId: string,
  newWallId: string,
  cutCm: number,
  wallLengthCm: number,
): [WallHeightProfilePoint[], WallHeightProfilePoint[]] {
  if (points.some(({ isLocked, positionCm }) => isLocked && positionCm > cutCm + EPSILON)) {
    throw new Error('La coupe déplacerait un point de profil verrouillé.');
  }
  const height = interpolateHeight(points, cutCm);
  const faceSide = points[0]?.faceSide ?? 'gauche';
  const left = points.filter(({ positionCm }) => positionCm < cutCm - EPSILON).map((point) => ({ ...point, wallId }));
  const right = points.filter(({ positionCm }) => positionCm > cutCm + EPSILON).map((point) => ({ ...point, wallId: newWallId, positionCm: point.positionCm - cutCm }));
  left.push({ id: crypto.randomUUID(), wallId, faceSide, order: 0, positionCm: cutCm, heightCm: height, isLocked: false });
  right.unshift({ id: crypto.randomUUID(), wallId: newWallId, faceSide, order: 0, positionCm: 0, heightCm: height, isLocked: false });
  if (!right.some(({ positionCm }) => Math.abs(positionCm - (wallLengthCm - cutCm)) < EPSILON)) {
    right.push({ id: crypto.randomUUID(), wallId: newWallId, faceSide, order: 0, positionCm: wallLengthCm - cutCm, heightCm: interpolateHeight(points, wallLengthCm), isLocked: false });
  }
  return [left.map((point, order) => ({ ...point, order })), right.map((point, order) => ({ ...point, order }))];
}

function splitProfiles(profiles: WallHeightProfiles, wallId: string, newWallId: string, cutCm: number, wallLengthCm: number): [WallHeightProfiles, WallHeightProfiles] {
  const [leftGauche, rightGauche] = splitFace(profiles.gauche, wallId, newWallId, cutCm, wallLengthCm);
  const [leftDroite, rightDroite] = splitFace(profiles.droite, wallId, newWallId, cutCm, wallLengthCm);
  return [
    { wallId, gauche: leftGauche, droite: leftDroite },
    { wallId: newWallId, gauche: rightGauche, droite: rightDroite },
  ];
}

export function projectPointOnWall(start: Point, end: Point, point: Point): { point: Point; positionCm: number; lengthCm: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) throw new Error('Le mur sélectionné est invalide.');
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const lengthCm = Math.sqrt(lengthSquared);
  return { point: { x: start.x + ratio * dx, y: start.y + ratio * dy }, positionCm: ratio * lengthCm, lengthCm };
}

export function splitWallInRooms<T extends RoomGeometrySnapshot>(rooms: readonly T[], wallId: string, target: Point): T[] {
  const owner = rooms.find(({ walls }) => walls.some(({ id }) => id === wallId));
  const sourceWall = owner?.walls.find(({ id }) => id === wallId);
  if (!owner || !sourceWall) throw new Error('Le mur sélectionné est introuvable.');
  const start = owner.vertices.find(({ id }) => id === sourceWall.startVertexId);
  const end = owner.vertices.find(({ id }) => id === sourceWall.endVertexId);
  if (!start || !end) throw new Error('Les extrémités du mur sont introuvables.');
  if (start.isLocked || end.isLocked) throw new Error('Un mur verrouillé ne peut pas être coupé.');
  const projected = projectPointOnWall(start, end, target);
  if (projected.positionCm <= EPSILON || projected.lengthCm - projected.positionCm <= EPSILON) {
    throw new Error('Le point de coupe doit être strictement à l’intérieur du mur.');
  }
  const crossing = owner.openings.find((opening) => opening.wallId === wallId && opening.offsetCm < projected.positionCm && opening.offsetCm + opening.widthCm > projected.positionCm);
  if (crossing) throw new Error('Le point de coupe traverse une ouverture.');

  const newVertexId = crypto.randomUUID();
  const newWallId = crypto.randomUUID();
  return rooms.map((snapshot) => {
    const wall = snapshot.walls.find(({ id }) => id === wallId);
    if (!wall) return snapshot;
    const localStart = snapshot.vertices.find(({ id }) => id === wall.startVertexId);
    const localEnd = snapshot.vertices.find(({ id }) => id === wall.endVertexId);
    if (!localStart || !localEnd) throw new Error('Le mur ne possède pas sa géométrie canonique complète.');
    const sameDirection = wall.startVertexId === sourceWall.startVertexId;
    const localCutCm = sameDirection ? projected.positionCm : projected.lengthCm - projected.positionCm;
    const profiles = wall.heightProfiles ?? createUniformWallHeightProfiles(wall.id, projected.lengthCm, wall.heightLeftCm ?? wall.heightRightCm ?? 250);
    const [firstProfiles, secondProfiles] = splitProfiles(profiles, wall.id, newWallId, localCutCm, projected.lengthCm);
    const firstId = sameDirection ? wall.id : newWallId;
    const secondId = sameDirection ? newWallId : wall.id;
    const first: Wall = { ...wall, id: firstId, endVertexId: newVertexId, heightProfiles: firstId === wall.id ? firstProfiles : secondProfiles };
    const second: Wall = { ...wall, id: secondId, startVertexId: newVertexId, heightProfiles: secondId === wall.id ? firstProfiles : secondProfiles };
    const sortedVertices = [...snapshot.vertices].sort((left, right) => left.order - right.order);
    const startIndex = sortedVertices.findIndex(({ id }) => id === wall.startVertexId);
    sortedVertices.splice(startIndex + 1, 0, { id: newVertexId, pieceId: snapshot.room.id, order: startIndex + 1, ...projected.point, isLocked: false });
    const nextOpenings = snapshot.openings.map((opening) => {
      if (opening.wallId !== wallId || opening.offsetCm + opening.widthCm <= localCutCm) return opening;
      return { ...opening, wallId: newWallId, offsetCm: opening.offsetCm - localCutCm };
    });
    return {
      ...snapshot,
      vertices: sortedVertices.map((vertex, order) => ({ ...vertex, order })),
      walls: snapshot.walls.flatMap((candidate) => candidate.id === wallId ? [first, second] : [candidate]),
      openings: nextOpenings,
    } as T;
  });
}

export function detachWallEndpoint<T extends RoomGeometrySnapshot>(
  canonical: LevelGeometrySnapshot,
  rooms: readonly T[],
  wallId: string,
  vertexId: string,
  target: Point,
): { canonical: LevelGeometrySnapshot; rooms: T[]; removedPieceIds: string[] } {
  const wall = canonical.walls.find(({ id }) => id === wallId);
  if (!wall || !wall.pieceIds.length) throw new Error('Le mur doit appartenir à une pièce pour être détaché.');
  if (vertexId !== wall.startVertexId && vertexId !== wall.endVertexId) throw new Error('L’extrémité choisie n’appartient pas au mur.');
  const currentVertex = canonical.vertices.find(({ id }) => id === vertexId);
  const oppositeVertexId = vertexId === wall.startVertexId ? wall.endVertexId : wall.startVertexId;
  const oppositeVertex = canonical.vertices.find(({ id }) => id === oppositeVertexId);
  if (!currentVertex || !oppositeVertex) throw new Error('Les extrémités du mur sont introuvables.');
  if (currentVertex.isLocked) throw new Error('Cette extrémité est verrouillée.');
  const previousLengthCm = Math.hypot(currentVertex.x - oppositeVertex.x, currentVertex.y - oppositeVertex.y);
  const nextLengthCm = Math.hypot(target.x - oppositeVertex.x, target.y - oppositeVertex.y);
  if (nextLengthCm <= EPSILON) throw new Error('Le mur détaché doit conserver une longueur positive.');
  const profiles = canonical.profilesByWallId[wallId];
  if (!profiles) throw new Error('Les profils du mur sont introuvables.');
  if (Math.abs(previousLengthCm - nextLengthCm) > EPSILON && [...profiles.gauche, ...profiles.droite].some(({ isLocked }) => isLocked)) {
    throw new Error('Le détachement modifierait un point de profil verrouillé.');
  }

  const removedPieceIds = [...wall.pieceIds];
  const removed = new Set(removedPieceIds);
  const newVertexId = crypto.randomUUID();
  const nextWalls = canonical.walls.map((candidate) => ({
    ...candidate,
    ...(candidate.id === wallId ? {
      startVertexId: vertexId === wall.startVertexId ? newVertexId : candidate.startVertexId,
      endVertexId: vertexId === wall.endVertexId ? newVertexId : candidate.endVertexId,
    } : {}),
    pieceIds: candidate.pieceIds.filter((pieceId) => !removed.has(pieceId)),
  }));
  const nextWallById = new Map(nextWalls.map((candidate) => [candidate.id, candidate]));
  const referencedVertexIds = new Set(nextWalls.flatMap(({ startVertexId, endVertexId }) => [startVertexId, endVertexId]));
  const nextCanonical: LevelGeometrySnapshot = {
    ...canonical,
    vertices: [
      ...canonical.vertices.filter(({ id }) => id !== newVertexId && referencedVertexIds.has(id)),
      { id: newVertexId, levelId: canonical.levelId, x: target.x, y: target.y, isLocked: false },
    ],
    pieces: canonical.pieces.filter(({ room }) => !removed.has(room.id)),
    walls: nextWalls,
    profilesByWallId: {
      ...canonical.profilesByWallId,
      [wallId]: resizeWallHeightProfiles(wall, profiles, previousLengthCm, nextLengthCm),
    },
    openings: canonical.openings.filter((opening) => {
      const support = nextWallById.get(opening.wallId);
      if (!support) return false;
      return (opening.placementType === 'intérieur' && support.pieceIds.length === 2)
        || (opening.placementType === 'extérieur' && support.pieceIds.length === 1);
    }),
  };
  return {
    canonical: nextCanonical,
    rooms: rooms.filter(({ room }) => !removed.has(room.id)).map((snapshot) => ({
      ...snapshot,
      walls: snapshot.walls.map((candidate) => ({ ...candidate, pieceIds: candidate.pieceIds?.filter((pieceId) => !removed.has(pieceId)) })),
    } as T)),
    removedPieceIds,
  };
}

export function moveDetachedVertex(
  canonical: LevelGeometrySnapshot,
  vertexId: string,
  target: Point,
): LevelGeometrySnapshot {
  const vertex = canonical.vertices.find(({ id }) => id === vertexId);
  if (!vertex) throw new Error('Le sommet détaché est introuvable.');
  if (vertex.isLocked) throw new Error('Ce sommet est verrouillé.');
  const affectedWalls = canonical.walls.filter(({ startVertexId, endVertexId }) => startVertexId === vertexId || endVertexId === vertexId);
  if (!affectedWalls.length) throw new Error('Aucun mur autonome ne référence ce sommet.');
  if (affectedWalls.some(({ pieceIds }) => pieceIds.length > 0)) {
    throw new Error('Ce sommet est encore utilisé par une pièce fermée.');
  }
  const profilesByWallId = { ...canonical.profilesByWallId };
  for (const wall of affectedWalls) {
    const oppositeId = wall.startVertexId === vertexId ? wall.endVertexId : wall.startVertexId;
    const opposite = canonical.vertices.find(({ id }) => id === oppositeId);
    const profiles = profilesByWallId[wall.id];
    if (!opposite || !profiles) throw new Error('La géométrie du mur autonome est incomplète.');
    const previousLengthCm = Math.hypot(vertex.x - opposite.x, vertex.y - opposite.y);
    const nextLengthCm = Math.hypot(target.x - opposite.x, target.y - opposite.y);
    if (nextLengthCm <= EPSILON) throw new Error('Un mur autonome doit conserver une longueur positive.');
    if (Math.abs(previousLengthCm - nextLengthCm) > EPSILON && [...profiles.gauche, ...profiles.droite].some(({ isLocked }) => isLocked)) {
      throw new Error('Le déplacement modifierait un point de profil verrouillé.');
    }
    profilesByWallId[wall.id] = resizeWallHeightProfiles(wall, profiles, previousLengthCm, nextLengthCm);
  }
  return {
    ...canonical,
    vertices: canonical.vertices.map((candidate) => candidate.id === vertexId ? { ...candidate, x: target.x, y: target.y } : candidate),
    profilesByWallId,
  };
}

export function reconnectDetachedVertex(
  canonical: LevelGeometrySnapshot,
  movingVertexId: string,
  targetVertexId: string,
): { canonical: LevelGeometrySnapshot; createdPieceIds: string[] } {
  if (movingVertexId === targetVertexId) throw new Error('Le sommet doit être raccordé à un autre sommet.');
  const moving = canonical.vertices.find(({ id }) => id === movingVertexId);
  const target = canonical.vertices.find(({ id }) => id === targetVertexId);
  if (!moving || !target) throw new Error('Le sommet de raccordement est introuvable.');
  const targetWalls = canonical.walls.filter(({ startVertexId, endVertexId }) => startVertexId === targetVertexId || endVertexId === targetVertexId);
  if (!targetWalls.length || targetWalls.some(({ pieceIds }) => pieceIds.length > 0)) {
    throw new Error('Le sommet cible doit appartenir à un mur autonome.');
  }

  const moved = moveDetachedVertex(canonical, movingVertexId, target);
  const walls = moved.walls.map((wall) => ({
    ...wall,
    startVertexId: wall.startVertexId === movingVertexId ? targetVertexId : wall.startVertexId,
    endVertexId: wall.endVertexId === movingVertexId ? targetVertexId : wall.endVertexId,
  }));
  if (walls.some(({ startVertexId, endVertexId }) => startVertexId === endVertexId)) {
    throw new Error('Le raccordement créerait un mur de longueur nulle.');
  }

  const componentWallIds = new Set<string>();
  const pendingVertexIds = [targetVertexId];
  const visitedVertexIds = new Set<string>();
  while (pendingVertexIds.length) {
    const vertexId = pendingVertexIds.pop()!;
    if (visitedVertexIds.has(vertexId)) continue;
    visitedVertexIds.add(vertexId);
    for (const wall of walls) {
      if (wall.pieceIds.length > 0 || (wall.startVertexId !== vertexId && wall.endVertexId !== vertexId)) continue;
      componentWallIds.add(wall.id);
      pendingVertexIds.push(wall.startVertexId === vertexId ? wall.endVertexId : wall.startVertexId);
    }
  }
  const componentWalls = walls.filter(({ id }) => componentWallIds.has(id));
  const degrees = new Map<string, number>();
  componentWalls.forEach(({ startVertexId, endVertexId }) => {
    degrees.set(startVertexId, (degrees.get(startVertexId) ?? 0) + 1);
    degrees.set(endVertexId, (degrees.get(endVertexId) ?? 0) + 1);
  });

  let vertexIds: string[] | null = null;
  if (componentWalls.length >= 3 && componentWalls.length === degrees.size && [...degrees.values()].every((degree) => degree === 2)) {
    const ordered = [targetVertexId];
    let currentVertexId = targetVertexId;
    let previousWallId: string | null = null;
    for (let index = 0; index < componentWalls.length; index += 1) {
      const nextWall = componentWalls.find((wall) => wall.id !== previousWallId && (wall.startVertexId === currentVertexId || wall.endVertexId === currentVertexId));
      if (!nextWall) break;
      const nextVertexId = nextWall.startVertexId === currentVertexId ? nextWall.endVertexId : nextWall.startVertexId;
      previousWallId = nextWall.id;
      currentVertexId = nextVertexId;
      if (nextVertexId === targetVertexId) {
        if (index === componentWalls.length - 1) vertexIds = ordered;
        break;
      }
      if (ordered.includes(nextVertexId)) break;
      ordered.push(nextVertexId);
    }
  }

  const createdPieceIds: string[] = [];
  let nextWalls = walls;
  let nextPieces = moved.pieces;
  if (vertexIds) {
    const pieceId = crypto.randomUUID();
    createdPieceIds.push(pieceId);
    nextPieces = [...nextPieces, {
      room: {
        id: pieceId,
        levelId: moved.levelId,
        name: DEFAULT_ROOM_NAME,
        type: DEFAULT_ROOM_TYPE,
        floorColor: DEFAULT_ROOM_FLOOR_COLOR,
      },
      vertexIds,
    }];
    nextWalls = walls.map((wall) => componentWallIds.has(wall.id) ? { ...wall, pieceIds: [pieceId] } : wall);
  }

  const nextCanonical: LevelGeometrySnapshot = {
    ...moved,
    vertices: moved.vertices.filter(({ id }) => id !== movingVertexId),
    pieces: nextPieces,
    walls: nextWalls,
  };
  assertLevelGeometrySnapshot(nextCanonical);
  return {
    canonical: nextCanonical,
    createdPieceIds,
  };
}
