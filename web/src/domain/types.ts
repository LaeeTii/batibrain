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
}

export interface Level {
  id: Id;
  projectId: Id;
  name: string;
  altitudeCm?: number | null;
}

export interface Room {
  id: Id;
  levelId: Id;
  name: string;
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

export interface DerivedWall {
  index: number;
  start: Vertex;
  end: Vertex;
  lengthCm: number;
}
