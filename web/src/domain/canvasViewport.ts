import type { Point } from './types';

export interface CanvasViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_CANVAS_ZOOM = 0.25;
export const MAX_CANVAS_ZOOM = 8;

export function fitViewportToPoints(
  points: Point[],
  padding: number,
  minimumWidth: number,
  minimumHeight = minimumWidth,
): CanvasViewport | null {
  if (points.length === 0) return null;

  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(minimumWidth, maxX - minX + padding * 2);
  const height = Math.max(minimumHeight, maxY - minY + padding * 2);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function zoomViewport(
  viewport: CanvasViewport,
  factor: number,
  anchor: Point = { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 },
): CanvasViewport {
  const nextWidth = viewport.width / factor;
  const nextHeight = viewport.height / factor;
  const ratioX = viewport.width === 0 ? 0.5 : (anchor.x - viewport.x) / viewport.width;
  const ratioY = viewport.height === 0 ? 0.5 : (anchor.y - viewport.y) / viewport.height;
  return {
    x: anchor.x - nextWidth * ratioX,
    y: anchor.y - nextHeight * ratioY,
    width: nextWidth,
    height: nextHeight,
  };
}

export function panViewport(viewport: CanvasViewport, delta: Point): CanvasViewport {
  return { ...viewport, x: viewport.x + delta.x, y: viewport.y + delta.y };
}

export function expandViewportToCanvas(
  viewport: CanvasViewport,
  canvasWidth: number,
  canvasHeight: number,
): CanvasViewport {
  if (canvasWidth <= 0 || canvasHeight <= 0 || viewport.width <= 0 || viewport.height <= 0) return viewport;
  const canvasRatio = canvasWidth / canvasHeight;
  const viewportRatio = viewport.width / viewport.height;

  if (viewportRatio < canvasRatio) {
    const width = viewport.height * canvasRatio;
    return { ...viewport, x: viewport.x - (width - viewport.width) / 2, width };
  }

  const height = viewport.width / canvasRatio;
  return { ...viewport, y: viewport.y - (height - viewport.height) / 2, height };
}
