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

export interface ProjectViewSettings {
  display: CanvasDisplayOptions;
  snapping: {
    grid: boolean;
    vertices: boolean;
    intersections: boolean;
    walls: boolean;
    midpoints: boolean;
    distanceCm: number;
  };
}

export const DEFAULT_PROJECT_VIEW_SETTINGS: ProjectViewSettings = {
  display: DEFAULT_CANVAS_DISPLAY_OPTIONS,
  snapping: {
    grid: true,
    vertices: true,
    intersections: true,
    walls: true,
    midpoints: true,
    distanceCm: 10,
  },
};
