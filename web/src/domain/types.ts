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
  isLocked?: boolean;
}

export interface Project {
  id: Id;
  name: string;
  address?: string | null;
  description?: string | null;
  ownerUserId: Id;
  updatedAt: string;
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
  number: number;
  isVisible: boolean;
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
  isSoftDeleted?: boolean;
  /** État calculé depuis les sommets du contour. */
  isLocked?: boolean;
}

export interface Wall {
  id: Id;
  /** Contexte de projection pour les vues historiques par pièce. */
  pieceId: Id;
  startVertexId: Id;
  endVertexId: Id;
  thicknessCm?: number | null;
  heightLeftCm?: number | null;
  heightRightCm?: number | null;
  material?: string | null;
  insulation?: string | null;
  notes?: string | null;
  /** Relations et profils canoniques conservés par l’adaptateur de vue. */
  pieceIds?: Id[];
  heightProfilesLinked?: boolean;
  heightProfiles?: WallHeightProfiles;
  /** État calculé depuis les deux sommets. */
  isLocked?: boolean;
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
  isLocked?: boolean;
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
  heightProfilesLinked: boolean;
}

export type OpeningType = 'door' | 'window' | 'other';
export type OpeningOrientation = 'normal' | 'inverse';
export type OpeningHingeSide = 'left' | 'right';

export interface Opening {
  id: Id;
  wallId: Id;
  type: OpeningType;
  offsetCm: number;
  widthCm: number;
  bottomCm: number;
  heightCm: number;
  notes?: string | null;
  templateId?: Id;
  openingKind?: OpeningKind;
  placementType?: OpeningPlacementType;
  orientation: OpeningOrientation;
  hingeSide: OpeningHingeSide;
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
  orientation: OpeningOrientation;
  hingeSide: OpeningHingeSide;
}

export interface DerivedWall {
  index: number;
  start: Vertex;
  end: Vertex;
  lengthCm: number;
}

export type DimensionType = 'point-point' | 'wall-wall' | 'point-on-wall';

export interface DimensionReference {
  type: 'point' | 'vertex' | 'wall';
  id?: Id;
  x?: number;
  y?: number;
}

export interface EditorDimension {
  id: Id;
  levelId: Id;
  name: string;
  type: DimensionType;
  distanceCm: number;
  offsetCm: number;
  referenceA: DimensionReference;
  referenceB: DimensionReference;
}

export interface EditorNote {
  id: Id;
  projectId: Id;
  originType: 'projet' | 'niveau' | 'pièce' | 'mur' | 'sommet' | 'ouverture';
  originId: Id | null;
  text: string;
}
