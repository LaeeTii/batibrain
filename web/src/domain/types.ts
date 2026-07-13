export type Id = string;

export interface Point {
  x: number;
  y: number;
}

/** Alias conservé pendant la remise à niveau du prototype frontend. */
export type Point2D = Point;

export interface Segment {
  start: Point;
  end: Point;
}

export interface Polygon {
  vertices: Point[];
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vertex extends Point {
  id: Id;
  pieceId: Id;
  order: number;
}

export interface Project {
  id: Id;
  name: string;
  address?: string | null;
  description?: string | null;
  ownerUserId: Id;
  updatedAt: string;
}

export interface ProjectEditingLock {
  projectId: Id;
  holderUserId: Id | null;
  holderDisplayName: string | null;
  lastActivityAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  heldByCurrentUser: boolean;
  serverNow: string;
}

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  userId: Id;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarStoragePath: string | null;
  avatarUrl: string | null;
  role: UserRole;
}

export interface AdminUserSummary {
  userId: Id;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  ownedProjectCount: number;
}

export interface AccountRequestSummary {
  id: Id;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface Level {
  id: Id;
  projectId: Id;
  name: string;
  altitudeCm?: number | null;
}

export type RoomType =
  | 'cuisine'
  | 'chambre'
  | 'salon'
  | 'salle_de_bain'
  | 'toilettes'
  | 'bureau'
  | 'garage'
  | 'hall'
  | 'salle_de_jeu'
  | 'bibliotheque'
  | 'autre';

export interface Room {
  id: Id;
  levelId: Id;
  name: string;
  type: RoomType;
  floorColor: string;
  notes?: string | null;
}

export interface Wall {
  id: Id;
  pieceId: Id;
  startVertexId: Id;
  endVertexId: Id;
  thicknessCm?: number | null;
  heightLeftCm?: number | null;
  heightRightCm?: number | null;
  material?: string | null;
  insulation?: string | null;
  notes?: string | null;
}

export type WallFaceSide = 'gauche' | 'droite';

export interface WallFace {
  side: WallFaceSide;
}

export interface WallHeightProfilePoint {
  id: Id;
  wallId: Id;
  faceSide: WallFaceSide;
  order: number;
  positionCm: number;
  heightCm: number;
}

export interface WallHeightProfiles {
  wallId: Id;
  gauche: WallHeightProfilePoint[];
  droite: WallHeightProfilePoint[];
}

export interface WallPieceRelation {
  wallId: Id;
  pieceId: Id;
}

/** Modèle topologique V1, indépendant du type Wall du prototype historique. */
export interface TopologyWall {
  id: Id;
  startVertexId: Id;
  endVertexId: Id;
  faces: readonly [WallFace, WallFace];
  pieceIds: Id[];
  thicknessCm: number | null;
  material: string | null;
  insulation: string | null;
  notes: string | null;
  isLocked: boolean;
  heightProfilesLinked: boolean;
}

export type OpeningType = 'door' | 'window' | 'other';

export interface Opening {
  id: Id;
  wallId: Id;
  type: OpeningType;
  offsetCm: number;
  widthCm: number;
  bottomCm: number;
  heightCm: number;
  notes?: string | null;
}

export type OpeningKind = 'porte' | 'fenêtre' | 'baie_vitree' | 'autre';
export type OpeningPlacementType = 'intérieur' | 'extérieur';

export interface OpeningTemplate {
  id: Id;
  name: string;
  type: OpeningKind;
  placementType: OpeningPlacementType;
}

/** Modèle d’ouverture V1, indépendant du type Opening du prototype historique. */
export interface TopologyOpening {
  id: Id;
  wallId: Id;
  templateId: Id;
  type: OpeningKind;
  placementType: OpeningPlacementType;
  positionCm: number;
  widthCm: number;
  heightCm: number;
  bottomCm: number;
  orientation: string | null;
  isLocked: boolean;
}

export interface DerivedWall {
  index: number;
  start: Vertex;
  end: Vertex;
  lengthCm: number;
}
