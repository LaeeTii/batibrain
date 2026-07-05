import React, { useId, useMemo } from 'react';
import type { Opening, Vertex, Wall } from '../../../shared/src/types';

const PREVIEW_PADDING_CM = 56;

interface RoomPreviewProps {
  vertices: Vertex[];
  walls: Wall[];
  openings: Opening[];
  accentColor: string;
}

function sortVertices(vertices: Vertex[]): Vertex[] {
  return [...vertices].sort((left, right) => left.order - right.order);
}

function buildPolygonPoints(vertices: Vertex[]): string {
  return vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(' ');
}

function getViewBox(vertices: Vertex[]) {
  if (vertices.length === 0) {
    return { minX: 0, minY: 0, width: 240, height: 180 };
  }

  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX: minX - PREVIEW_PADDING_CM,
    minY: minY - PREVIEW_PADDING_CM,
    width: Math.max(140, maxX - minX) + PREVIEW_PADDING_CM * 2,
    height: Math.max(120, maxY - minY) + PREVIEW_PADDING_CM * 2,
  };
}

function buildOpeningSegment(start: Vertex, end: Vertex, opening: Opening) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const wallLength = Math.hypot(deltaX, deltaY);

  if (wallLength === 0) {
    return null;
  }

  const startRatio = Math.max(0, Math.min(1, opening.offsetCm / wallLength));
  const endRatio = Math.max(startRatio, Math.min(1, (opening.offsetCm + opening.widthCm) / wallLength));

  return {
    x1: start.x + deltaX * startRatio,
    y1: start.y + deltaY * startRatio,
    x2: start.x + deltaX * endRatio,
    y2: start.y + deltaY * endRatio,
  };
}

export function RoomPreview({ vertices, walls, openings, accentColor }: RoomPreviewProps) {
  const patternId = useId().replace(/:/g, '');
  const sortedVertices = useMemo(() => sortVertices(vertices), [vertices]);
  const viewBox = useMemo(() => getViewBox(sortedVertices), [sortedVertices]);
  const polygonPoints = useMemo(() => buildPolygonPoints(sortedVertices), [sortedVertices]);
  const openingSegments = useMemo(() => {
    const verticesById = new Map(sortedVertices.map((vertex) => [vertex.id, vertex]));
    const wallsById = new Map(walls.map((wall) => [wall.id, wall]));

    return openings.flatMap((opening) => {
      const wall = wallsById.get(opening.wallId);
      if (!wall) {
        return [];
      }

      const start = verticesById.get(wall.startVertexId);
      const end = verticesById.get(wall.endVertexId);
      if (!start || !end) {
        return [];
      }

      const segment = buildOpeningSegment(start, end, opening);
      return segment ? [segment] : [];
    });
  }, [openings, sortedVertices, walls]);

  return (
    <div className="room-preview" style={{ '--room-preview-accent': accentColor } as React.CSSProperties}>
      <svg
        className="room-preview__svg"
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="Apercu de la piece"
      >
        <defs>
          <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(103, 113, 132, 0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect
          x={viewBox.minX}
          y={viewBox.minY}
          width={viewBox.width}
          height={viewBox.height}
          rx="28"
          fill={`url(#${patternId})`}
        />
        <polygon className="room-preview__shape" points={polygonPoints} />
        {openingSegments.map((segment, index) => (
          <line
            key={`${segment.x1}-${segment.y1}-${segment.x2}-${segment.y2}-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            className="room-preview__opening"
          />
        ))}
      </svg>
    </div>
  );
}