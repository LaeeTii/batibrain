export interface CanvasDisplayOptions {
  grid: boolean;
  rulers: boolean;
  dimensions: boolean;
  angles: boolean;
  notes: boolean;
  surfaces: boolean;
  roomIcons: boolean;
}

export const DEFAULT_CANVAS_DISPLAY_OPTIONS: CanvasDisplayOptions = {
  grid: true,
  rulers: true,
  dimensions: true,
  angles: true,
  notes: true,
  surfaces: true,
  roomIcons: true,
};

export interface CanvasSnappingOptions {
  grid: boolean;
  vertices: boolean;
  intersections: boolean;
  walls: boolean;
  midpoints: boolean;
  guides: boolean;
  distanceCm: number;
}

export interface ProjectViewSettings {
  display: CanvasDisplayOptions;
  snapping: CanvasSnappingOptions;
}

export const DEFAULT_PROJECT_VIEW_SETTINGS: ProjectViewSettings = {
  display: DEFAULT_CANVAS_DISPLAY_OPTIONS,
  snapping: {
    grid: true,
    vertices: true,
    intersections: true,
    walls: true,
    midpoints: true,
    guides: true,
    distanceCm: 10,
  },
};
