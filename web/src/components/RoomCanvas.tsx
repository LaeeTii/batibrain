import React, { useMemo, useRef, useState } from 'react';
import { centroid, formatLengthCm, insertVertexBetween, polygonAreaCm2, polygonPerimeterCm, wallsFromVertices } from '../../../shared/src/geometry';
import type { Vertex } from '../../../shared/src/types';

export interface RoomCanvasProps {
  vertices: Vertex[];
  width?: number;
  height?: number;
  selectedWallIndex?: number | null;
  onVerticesChange: (next: Vertex[]) => void;
  onWallSelect?: (wallIndex: number) => void;
}

function toPointsAttribute(vertices: Vertex[]): string {
  return vertices.map((v) => `${v.x},${v.y}`).join(' ');
}

function midpoint(a: Vertex, b: Vertex) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function getSvgPoint(event: { clientX: number; clientY: number }, svg: SVGSVGElement) {
  const screenMatrix = svg.getScreenCTM();
  if (!screenMatrix) {
    const rect = svg.getBoundingClientRect();
    const scaleX = svg.viewBox.baseVal.width / rect.width;
    const scaleY = svg.viewBox.baseVal.height / rect.height;

    return {
      x: Math.round((event.clientX - rect.left) * scaleX),
      y: Math.round((event.clientY - rect.top) * scaleY),
    };
  }

  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformedPoint = point.matrixTransform(screenMatrix.inverse());

  return {
    x: Math.round(transformedPoint.x),
    y: Math.round(transformedPoint.y),
  };
}

function projectPointOntoSegment(point: { x: number; y: number }, start: Vertex, end: Vertex) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx ** 2 + dy ** 2;

  if (lengthSquared === 0) {
    return { x: start.x, y: start.y };
  }

  const ratio = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  return {
    x: Math.round(start.x + dx * clampedRatio),
    y: Math.round(start.y + dy * clampedRatio),
  };
}

export function RoomCanvas({
  vertices,
  width = 900,
  height = 700,
  selectedWallIndex = null,
  onVerticesChange,
  onWallSelect,
}: RoomCanvasProps) {
  const [dragVertexId, setDragVertexId] = useState<string | null>(null);
  const [selectedVertexIds, setSelectedVertexIds] = useState<string[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const didDragRef = useRef(false);
  const lastDragEndedAtRef = useRef(0);

  const sortedVertices = useMemo(
    () => [...vertices].sort((a, b) => a.order - b.order),
    [vertices],
  );

  const walls = useMemo(() => wallsFromVertices(sortedVertices), [sortedVertices]);
  const areaM2 = useMemo(() => polygonAreaCm2(sortedVertices) / 10000, [sortedVertices]);
  const perimeterM = useMemo(() => polygonPerimeterCm(sortedVertices) / 100, [sortedVertices]);
  const center = useMemo(() => centroid(sortedVertices), [sortedVertices]);
  const selectedVertices = useMemo(
    () => sortedVertices.filter((vertex) => selectedVertexIds.includes(vertex.id)),
    [selectedVertexIds, sortedVertices],
  );
  const selectedVertexWall = useMemo(() => {
    if (selectedVertexIds.length !== 2) return null;

    return walls.find(
      (wall) => selectedVertexIds.includes(wall.start.id) && selectedVertexIds.includes(wall.end.id),
    ) ?? null;
  }, [selectedVertexIds, walls]);

  const handleSvgDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { x, y } = getSvgPoint(event, svg);

    const next = [
      ...sortedVertices,
      {
        id: `v_${crypto.randomUUID()}`,
        pieceId: sortedVertices[0]?.pieceId ?? 'piece_demo',
        order: sortedVertices.length,
        x,
        y,
      },
    ];

    onVerticesChange(next);
  };

  const handleWallDoubleClick = (
    event: React.MouseEvent<SVGGElement>,
    wallIndex: number,
  ) => {
    event.stopPropagation();

    const svg = svgRef.current;
    const wall = walls[wallIndex];
    if (!svg || !wall) return;

    const clickPoint = getSvgPoint(event, svg);
    const projectedPoint = projectPointOntoSegment(clickPoint, wall.start, wall.end);
    const nextVertexId = `v_${crypto.randomUUID()}`;
    const next = insertVertexBetween(
      sortedVertices,
      wall.start.id,
      wall.end.id,
      {
        id: nextVertexId,
        pieceId: wall.start.pieceId,
        x: projectedPoint.x,
        y: projectedPoint.y,
      },
    );

    if (!next) return;

    onVerticesChange(next);
    setSelectedVertexIds([nextVertexId]);
    onWallSelect?.(wall.index);
  };

  const handleVertexMouseDown = (
    event: React.MouseEvent<SVGCircleElement>,
    vertexId: string,
  ) => {
    event.stopPropagation();
    didDragRef.current = false;
    setDragVertexId(vertexId);
  };

  const handleVertexClick = (
    event: React.MouseEvent<SVGCircleElement>,
    vertexId: string,
  ) => {
    event.stopPropagation();

    if (Date.now() - lastDragEndedAtRef.current < 150) {
      return;
    }

    setSelectedVertexIds((current) => {
      if (current.includes(vertexId)) {
        return current.filter((id) => id !== vertexId);
      }

      if (current.length < 2) {
        return [...current, vertexId];
      }

      return [current[1], vertexId];
    });
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!dragVertexId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const { x, y } = getSvgPoint(event, svg);

    const draggedVertex = sortedVertices.find((vertex) => vertex.id === dragVertexId);
    if (!draggedVertex) return;
    if (draggedVertex.x !== x || draggedVertex.y !== y) {
      didDragRef.current = true;
    }

    onVerticesChange(
      sortedVertices.map((vertex) =>
        vertex.id === dragVertexId ? { ...vertex, x, y } : vertex,
      ),
    );
  };

  const handleMouseUp = () => {
    if (didDragRef.current) {
      lastDragEndedAtRef.current = Date.now();
      didDragRef.current = false;
    }

    setDragVertexId(null);
  };

  const handleInsertVertexBetweenSelection = () => {
    if (!selectedVertexWall) return;

    const nextVertexId = `v_${crypto.randomUUID()}`;
    const next = insertVertexBetween(
      sortedVertices,
      selectedVertexWall.start.id,
      selectedVertexWall.end.id,
      {
        id: nextVertexId,
        pieceId: selectedVertexWall.start.pieceId,
        x: Math.round((selectedVertexWall.start.x + selectedVertexWall.end.x) / 2),
        y: Math.round((selectedVertexWall.start.y + selectedVertexWall.end.y) / 2),
      },
    );

    if (!next) return;

    onVerticesChange(next);
    setSelectedVertexIds([nextVertexId]);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        onDoubleClick={handleSvgDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ border: '1px solid #d0d7de', background: '#fafbfc', borderRadius: 8 }}
      >
        <defs>
          <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#eceff3" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="url(#grid)" />

        {sortedVertices.length >= 3 && (
          <polygon
            points={toPointsAttribute(sortedVertices)}
            fill="rgba(14, 84, 233, 0.10)"
            stroke="#0e54e9"
            strokeWidth={2}
          />
        )}

        {walls.map((wall) => {
          const middle = midpoint(wall.start, wall.end);
          const isSelected = selectedWallIndex === wall.index;
          return (
            <g
              key={`wall_${wall.index}`}
              onDoubleClick={(event) => handleWallDoubleClick(event, wall.index)}
            >
              <line
                x1={wall.start.x}
                y1={wall.start.y}
                x2={wall.end.x}
                y2={wall.end.y}
                stroke={isSelected ? '#d83b01' : '#0e54e9'}
                strokeWidth={isSelected ? 6 : 4}
                strokeLinecap="round"
                onClick={() => onWallSelect?.(wall.index)}
                style={{ cursor: 'pointer' }}
              />
              <rect
                x={middle.x - 36}
                y={middle.y - 14}
                width={72}
                height={20}
                rx={6}
                fill="white"
                stroke="#d0d7de"
              />
              <text
                x={middle.x}
                y={middle.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill="#24292f"
              >
                {formatLengthCm(wall.lengthCm)}
              </text>
            </g>
          );
        })}

        {sortedVertices.map((vertex, index) => (
          <g key={vertex.id}>
            <circle
              cx={vertex.x}
              cy={vertex.y}
              r={selectedVertexIds.includes(vertex.id) ? 10 : 8}
              fill={selectedVertexIds.includes(vertex.id) ? '#d83b01' : 'white'}
              stroke={selectedVertexIds.includes(vertex.id) ? '#8a2b00' : '#0e54e9'}
              strokeWidth={3}
              onMouseDown={(event) => handleVertexMouseDown(event, vertex.id)}
              onClick={(event) => handleVertexClick(event, vertex.id)}
              style={{ cursor: 'grab' }}
            />
            <text
              x={vertex.x + 12}
              y={vertex.y - 12}
              fontSize={12}
              fill="#57606a"
            >
              v{index}
            </text>
          </g>
        ))}

        {sortedVertices.length >= 3 && (
          <text
            x={center.x}
            y={center.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={16}
            fontWeight={700}
            fill="#0e54e9"
          >
            {areaM2.toFixed(2)} m²
          </text>
        )}
      </svg>

      <aside style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 16, background: 'white' }}>
        <h3 style={{ marginTop: 0 }}>Métadonnées</h3>
        <p><strong>Sommets :</strong> {sortedVertices.length}</p>
        <p><strong>Surface :</strong> {areaM2.toFixed(2)} m²</p>
        <p><strong>Périmètre :</strong> {perimeterM.toFixed(2)} m</p>
        <p style={{ color: '#57606a', fontSize: 14 }}>
          Double-clique dans le plan pour ajouter un sommet. Double-clique sur un mur pour insérer un sommet sur ce segment.
        </p>
        <p style={{ color: '#57606a', fontSize: 14 }}>
          Clique sur deux sommets consécutifs pour activer l'insertion d'un sommet au milieu du mur.
        </p>
        <button
          type="button"
          onClick={handleInsertVertexBetweenSelection}
          disabled={!selectedVertexWall}
          style={{
            width: '100%',
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid #d0d7de',
            background: selectedVertexWall ? '#0e54e9' : '#f6f8fa',
            color: selectedVertexWall ? 'white' : '#8c959f',
            cursor: selectedVertexWall ? 'pointer' : 'not-allowed',
          }}
        >
          Insérer un sommet entre les sommets sélectionnés
        </button>
        {selectedVertexIds.length > 0 && (
          <p style={{ color: '#57606a', fontSize: 14 }}>
            Sélection : {selectedVertices.map((vertex) => `v${vertex.order}`).join(', ')}
          </p>
        )}
        {selectedVertexIds.length === 2 && !selectedVertexWall && (
          <p style={{ color: '#d83b01', fontSize: 14 }}>
            Les deux sommets sélectionnés doivent être consécutifs dans le polygone.
          </p>
        )}
        <h4>Murs</h4>
        <ol style={{ paddingLeft: 18 }}>
          {walls.map((wall) => (
            <li key={wall.index}>
              Mur {wall.index + 1} — {formatLengthCm(wall.lengthCm)}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
