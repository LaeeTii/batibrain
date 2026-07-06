import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { centroid, formatLengthCm, polygonAreaCm2, wallsFromVertices } from '../../../shared/src/geometry';
import type { Opening, Vertex } from '../../../shared/src/types';
import type { RoomSnapshot } from '../services/rooms';

const PLAN_PADDING_CM = 140;
const GRID_MINOR_STEP_CM = 50;
const GRID_MAJOR_STEP_CM = 100;
const ROOM_FILL_COLORS = ['#d47a52', '#8fa35d', '#5b88c7', '#d4a94b', '#8c7bc8', '#c27b98'];
const RULER_OFFSET = 70;

interface LevelPlanCanvasProps {
  snapshots: RoomSnapshot[];
  highlightedRoomId?: string;
  showGrid?: boolean;
  showMeasurements?: boolean;
  height?: number;
  exportSvgRef?: React.MutableRefObject<SVGSVGElement | null>;
  onFocusRoom?: (roomId: string) => void;
  onOpenRoom?: (roomId: string) => void;
}

interface ViewBoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PanState {
  clientX: number;
  clientY: number;
  viewport: ViewBoxState;
}

function sortVertices(vertices: Vertex[]): Vertex[] {
  return [...vertices].sort((left, right) => left.order - right.order);
}

function buildPolygonPoints(vertices: Vertex[]): string {
  return vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getViewBox(verticesGroups: Vertex[][]): ViewBoxState {
  const allVertices = verticesGroups.flat();

  if (allVertices.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    };
  }

  const xs = allVertices.map((vertex) => vertex.x);
  const ys = allVertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX - PLAN_PADDING_CM,
    y: minY - PLAN_PADDING_CM,
    width: Math.max(300, maxX - minX) + PLAN_PADDING_CM * 2,
    height: Math.max(220, maxY - minY) + PLAN_PADDING_CM * 2,
  };
}

function getSvgPoint(event: { clientX: number; clientY: number }, svg: SVGSVGElement) {
  const screenMatrix = svg.getScreenCTM();
  if (!screenMatrix) {
    const rect = svg.getBoundingClientRect();
    const scaleX = svg.viewBox.baseVal.width / rect.width;
    const scaleY = svg.viewBox.baseVal.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX + svg.viewBox.baseVal.x,
      y: (event.clientY - rect.top) * scaleY + svg.viewBox.baseVal.y,
    };
  }

  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformedPoint = point.matrixTransform(screenMatrix.inverse());

  return {
    x: transformedPoint.x,
    y: transformedPoint.y,
  };
}

function buildOpeningSegment(start: Vertex, end: Vertex, opening: Opening) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const wallLength = Math.hypot(deltaX, deltaY);

  if (wallLength === 0) {
    return null;
  }

  const startRatio = clamp(opening.offsetCm / wallLength, 0, 1);
  const endRatio = clamp((opening.offsetCm + opening.widthCm) / wallLength, startRatio, 1);

  return {
    x1: start.x + deltaX * startRatio,
    y1: start.y + deltaY * startRatio,
    x2: start.x + deltaX * endRatio,
    y2: start.y + deltaY * endRatio,
  };
}

export function LevelPlanCanvas({
  snapshots,
  highlightedRoomId,
  showGrid = true,
  showMeasurements = true,
  height,
  exportSvgRef,
  onFocusRoom,
  onOpenRoom,
}: LevelPlanCanvasProps) {
  const gridMinorPatternId = useId().replace(/:/g, '');
  const gridMajorPatternId = `${gridMinorPatternId}-major`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewport, setViewport] = useState<ViewBoxState>({ x: 0, y: 0, width: 1200, height: 800 });
  const [panState, setPanState] = useState<PanState | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState('');
  const [hasFocus, setHasFocus] = useState(false);

  const rooms = useMemo(() => snapshots.map((snapshot, index) => {
    const vertices = sortVertices(snapshot.vertices);
    const points = buildPolygonPoints(vertices);
    const verticesById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
    const walls = wallsFromVertices(vertices);
    const openingSegments = snapshot.openings.flatMap((opening) => {
      const wallDefinition = snapshot.walls.find((wall) => wall.id === opening.wallId);
      if (!wallDefinition) {
        return [];
      }

      const start = verticesById.get(wallDefinition.startVertexId);
      const end = verticesById.get(wallDefinition.endVertexId);
      if (!start || !end) {
        return [];
      }

      const segment = buildOpeningSegment(start, end, opening);
      return segment ? [{ segment, opening }] : [];
    });

    return {
      snapshot,
      vertices,
      points,
      walls,
      openingSegments,
      center: centroid(vertices),
      areaLabel: `${(polygonAreaCm2(vertices) / 10000).toFixed(1)} m²`,
      fillColor: ROOM_FILL_COLORS[index % ROOM_FILL_COLORS.length],
    };
  }), [snapshots]);

  const baseViewBox = useMemo(
    () => getViewBox(rooms.map((room) => room.vertices)),
    [rooms],
  );

  useEffect(() => {
    setViewport(baseViewBox);
    setPanState(null);
  }, [baseViewBox]);

  useEffect(() => {
    if (exportSvgRef) {
      exportSvgRef.current = svgRef.current;
    }

    return () => {
      if (exportSvgRef) {
        exportSvgRef.current = null;
      }
    };
  }, [exportSvgRef]);

  function zoomAt(factor: number, anchor: { x: number; y: number }) {
    setViewport((currentViewport) => {
      const aspectRatio = currentViewport.height / currentViewport.width;
      const nextWidth = clamp(
        currentViewport.width * factor,
        Math.max(200, baseViewBox.width * 0.28),
        Math.max(baseViewBox.width * 4.5, 1200),
      );
      const nextHeight = nextWidth * aspectRatio;
      const ratioX = (anchor.x - currentViewport.x) / currentViewport.width;
      const ratioY = (anchor.y - currentViewport.y) / currentViewport.height;

      return {
        x: anchor.x - nextWidth * ratioX,
        y: anchor.y - nextHeight * ratioY,
        width: nextWidth,
        height: nextHeight,
      };
    });
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    if (!hasFocus && !hoveredRoomId && !highlightedRoomId) {
      return;
    }

    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const anchor = getSvgPoint(event.nativeEvent, svg);
    zoomAt(event.deltaY < 0 ? 0.88 : 1.12, anchor);
  }

  function handlePanStart(event: React.MouseEvent<SVGRectElement>) {
    if (event.button !== 0) {
      return;
    }

    setPanState({
      clientX: event.clientX,
      clientY: event.clientY,
      viewport,
    });
  }

  function handlePanMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!panState || !svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const deltaX = ((event.clientX - panState.clientX) * panState.viewport.width) / rect.width;
    const deltaY = ((event.clientY - panState.clientY) * panState.viewport.height) / rect.height;

    setViewport({
      x: panState.viewport.x - deltaX,
      y: panState.viewport.y - deltaY,
      width: panState.viewport.width,
      height: panState.viewport.height,
    });
  }

  function handlePanEnd() {
    setPanState(null);
  }

  const scaleLengthCm = viewport.width > 1600 ? 200 : viewport.width > 900 ? 100 : 50;
  const scaleStartX = viewport.x + 106;
  const scaleEndX = scaleStartX + scaleLengthCm;
  const scaleY = viewport.y + viewport.height - 34;
  const activeRoomId = hoveredRoomId || highlightedRoomId || '';

  return (
    <div className="level-planCanvas" style={{ position: 'relative' }}>
      <div className="level-planCanvas__controls">
        <button
          type="button"
          className="level-planCanvas__zoomButton"
          onClick={() => zoomAt(1.18, { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 })}
        >
          -
        </button>

        <button
          type="button"
          className="level-planCanvas__zoomButton"
          onClick={() => zoomAt(0.82, { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 })}
        >
          +
        </button>

        <button
          type="button"
          className="level-planCanvas__zoomButton"
          onClick={() => setViewport(baseViewBox)}
        >
          [o]
        </button>
      </div>

      <svg
        ref={svgRef}
        className="level-planCanvas__svg"
        viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
        height={height}
        onWheel={handleWheel}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        style={{ cursor: panState ? 'grabbing' : 'grab', outline: 'none' }}
        tabIndex={0}
      >
        <defs>
          <pattern id={gridMinorPatternId} width={GRID_MINOR_STEP_CM} height={GRID_MINOR_STEP_CM} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_MINOR_STEP_CM} 0 L 0 0 0 ${GRID_MINOR_STEP_CM}`} fill="none" stroke="rgba(130, 145, 168, 0.16)" strokeWidth="1" />
          </pattern>
          <pattern id={gridMajorPatternId} width={GRID_MAJOR_STEP_CM} height={GRID_MAJOR_STEP_CM} patternUnits="userSpaceOnUse">
            <rect width={GRID_MAJOR_STEP_CM} height={GRID_MAJOR_STEP_CM} fill={`url(#${gridMinorPatternId})`} />
            <path d={`M ${GRID_MAJOR_STEP_CM} 0 L 0 0 0 ${GRID_MAJOR_STEP_CM}`} fill="none" stroke="rgba(92, 110, 138, 0.26)" strokeWidth="1.5" />
          </pattern>
        </defs>

        <rect
          x={viewport.x}
          y={viewport.y}
          width={viewport.width}
          height={viewport.height}
          fill="#fbfcfe"
          onMouseDown={handlePanStart}
        />

        {showGrid ? (
          <rect
            x={viewport.x}
            y={viewport.y}
            width={viewport.width}
            height={viewport.height}
            fill={`url(#${gridMajorPatternId})`}
            pointerEvents="none"
          />
        ) : null}

        {/** Règles de mesure */}
        <g className="level-planCanvas__rulers">
          {/** Règle horizontale (haut) avec décalage de 30px */}
          <g className="level-planCanvas__ruler level-planCanvas__ruler--horizontal">
            <line
              x1={viewport.x + RULER_OFFSET}
              y1={viewport.y + RULER_OFFSET}
              x2={viewport.x + viewport.width -10}
              y2={viewport.y + RULER_OFFSET}
              stroke="#4a5568"
              strokeWidth={1}
              pointerEvents="none"
            />
            {Array.from({ length: Math.floor(viewport.width / GRID_MAJOR_STEP_CM) + 1 }).map((_, i) => {
              const x = viewport.x + i * GRID_MAJOR_STEP_CM;
              if (x > viewport.x + viewport.width -10 - RULER_OFFSET) return null;
              return (
                <g key={`h-ruler-${i}`} pointerEvents="none">
                  <line
                    x1={x + RULER_OFFSET}
                    y1={viewport.y + RULER_OFFSET -10}
                    x2={x + RULER_OFFSET}
                    y2={viewport.y + RULER_OFFSET}
                    stroke="#4a5568"
                    strokeWidth={1}
                  />
                  <text
                    x={x + RULER_OFFSET}
                    y={viewport.y + RULER_OFFSET - 20}
                    textAnchor="middle"
                    fill="#4a5568"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {formatLengthCm(i * GRID_MAJOR_STEP_CM)}
                  </text>
                </g>
              );
            })}
          </g>

          {/** Règle verticale (gauche) */}
          <g className="level-planCanvas__ruler level-planCanvas__ruler--vertical">
            <line
              x1={viewport.x + RULER_OFFSET}
              y1={viewport.y + RULER_OFFSET}
              x2={viewport.x + RULER_OFFSET}
              y2={viewport.y + viewport.height}
              stroke="#4a5568"
              strokeWidth={1}
              pointerEvents="none"
            />
            {Array.from({ length: Math.floor(viewport.height / GRID_MAJOR_STEP_CM) + 1 }).map((_, i) => {
              const y = viewport.y + i * GRID_MAJOR_STEP_CM;
              if (y > viewport.y + viewport.height) return null;
              return (
                <g key={`v-ruler-${i}`} pointerEvents="none">
                  <line
                    x1={viewport.x + RULER_OFFSET -10}
                    y1={y + RULER_OFFSET}
                    x2={viewport.x + RULER_OFFSET}
                    y2={y + RULER_OFFSET}
                    stroke="#4a5568"
                    strokeWidth={1}
                  />
                  <text
                    x={viewport.x + 50}
                    y={y + 5 + RULER_OFFSET}
                    textAnchor="end"
                    fill="#4a5568"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {formatLengthCm(i * GRID_MAJOR_STEP_CM)}
                  </text>
                </g>
              );
            })}
          </g>
        </g>

        {rooms.map((room) => {
          const isActive = room.snapshot.room.id === activeRoomId;

          return (
            <g key={room.snapshot.room.id}>
              <polygon
                points={room.points}
                fill={room.fillColor}
                fillOpacity={isActive ? 0.34 : 0.2}
                stroke={isActive ? '#243b63' : 'rgba(40, 54, 76, 0.68)'}
                strokeWidth={isActive ? 8 : 6}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                style={{ cursor: onFocusRoom ? 'pointer' : 'default' }}
                onMouseDown={(event) => event.stopPropagation()}
                onMouseEnter={() => setHoveredRoomId(room.snapshot.room.id)}
                onMouseLeave={() => setHoveredRoomId('')}
                onClick={() => onFocusRoom?.(room.snapshot.room.id)}
              />

              {room.walls.map((wall) => (
                <line
                  key={`${room.snapshot.room.id}-${wall.index}`}
                  x1={wall.start.x}
                  y1={wall.start.y}
                  x2={wall.end.x}
                  y2={wall.end.y}
                  stroke={isActive ? 'rgba(36, 59, 99, 0.92)' : 'rgba(44, 55, 76, 0.88)'}
                  strokeWidth={isActive ? 4.2 : 3.4}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              ))}

              {room.openingSegments.map(({ segment, opening }) => (
                <line
                  key={opening.id}
                  x1={segment.x1}
                  y1={segment.y1}
                  x2={segment.x2}
                  y2={segment.y2}
                  stroke={opening.type === 'window' ? '#4f94ff' : opening.type === 'door' ? '#2a8a57' : '#d47a52'}
                  strokeWidth={7}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              ))}

              <text
                x={room.center.x}
                y={room.center.y - 10}
                textAnchor="middle"
                fill="#182133"
                fontSize={22}
                fontWeight={700}
                pointerEvents="none"
                style={{ paintOrder: 'stroke', stroke: 'rgba(255, 255, 255, 0.96)', strokeWidth: 5 }}
              >
                <tspan x={room.center.x} dy="0">{room.snapshot.room.name}</tspan>
                <tspan x={room.center.x} dy="24" fontSize={16} fontWeight={600} fill="rgba(24, 33, 51, 0.74)">
                  {room.areaLabel}
                </tspan>
              </text>

              {showMeasurements ? room.walls.map((wall) => {
                const midX = (wall.start.x + wall.end.x) / 2;
                const midY = (wall.start.y + wall.end.y) / 2;

                return (
                  <text
                    key={`${room.snapshot.room.id}-${wall.index}-measure`}
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    fill="#32435f"
                    fontSize={15}
                    fontWeight={700}
                    pointerEvents="none"
                    style={{ paintOrder: 'stroke', stroke: 'rgba(255, 255, 255, 0.98)', strokeWidth: 4 }}
                  >
                    {formatLengthCm(wall.lengthCm)}
                  </text>
                );
              }) : null}
            </g>
          );
        })}

        <g pointerEvents="none">
          <line
            x1={scaleStartX}
            y1={scaleY}
            x2={scaleEndX}
            y2={scaleY}
            stroke="#182133"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          <line
            x1={scaleStartX}
            y1={scaleY - 8}
            x2={scaleStartX}
            y2={scaleY + 8}
            stroke="#182133"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          <line
            x1={scaleEndX}
            y1={scaleY - 8}
            x2={scaleEndX}
            y2={scaleY + 8}
            stroke="#182133"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          <text
            x={(scaleStartX + scaleEndX) / 2}
            y={scaleY - 12}
            textAnchor="middle"
            fill="#182133"
            fontSize={16}
            fontWeight={700}
            style={{ paintOrder: 'stroke', stroke: 'rgba(255, 255, 255, 0.98)', strokeWidth: 4 }}
          >
            {formatLengthCm(scaleLengthCm)}
          </text>
        </g>
      </svg>
    </div>
  );
}