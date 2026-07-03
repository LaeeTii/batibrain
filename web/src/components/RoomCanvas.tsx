import React, { useEffect, useMemo, useRef, useState } from 'react';
import { centroid, formatLengthCm, insertVertexBetween, polygonAreaCm2, polygonPerimeterCm, removeVertex, snapPointToNearbyAxes, updateVertexPosition, updateWallLength, wallsFromVertices } from '../../../shared/src/geometry';
import type { Vertex } from '../../../shared/src/types';

const SNAP_THRESHOLD_CM = 12;

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
  const [snapGuide, setSnapGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [editingWallIndex, setEditingWallIndex] = useState<number | null>(null);
  const [wallLengthDraft, setWallLengthDraft] = useState('');
  const [wallLengthError, setWallLengthError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wallLengthInputRef = useRef<HTMLInputElement | null>(null);
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
  const selectedVertex = selectedVertices.length === 1 ? selectedVertices[0] : null;
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
    const pointerPoint = getSvgPoint(event, svg);

    const draggedVertex = sortedVertices.find((vertex) => vertex.id === dragVertexId);
    if (!draggedVertex) return;

    const snapped = snapPointToNearbyAxes(
      sortedVertices,
      dragVertexId,
      pointerPoint,
      SNAP_THRESHOLD_CM,
    );

    setSnapGuide({ x: snapped.snappedX, y: snapped.snappedY });

    if (draggedVertex.x !== snapped.point.x || draggedVertex.y !== snapped.point.y) {
      didDragRef.current = true;
    }

    onVerticesChange(updateVertexPosition(
      sortedVertices,
      dragVertexId,
      snapped.point.x,
      snapped.point.y,
    ));
  };

  const handleMouseUp = () => {
    if (didDragRef.current) {
      lastDragEndedAtRef.current = Date.now();
      didDragRef.current = false;
    }

    setDragVertexId(null);
    setSnapGuide({ x: null, y: null });
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

  const handleDeleteSelectedVertex = () => {
    if (!selectedVertex) return;

    const next = removeVertex(sortedVertices, selectedVertex.id);
    if (!next) return;

    onVerticesChange(next);
    setSelectedVertexIds([]);
  };

  const canDeleteSelectedVertex = selectedVertex !== null && sortedVertices.length > 3;

  useEffect(() => {
    if (editingWallIndex === null) return;

    wallLengthInputRef.current?.focus();
    wallLengthInputRef.current?.select();
  }, [editingWallIndex]);

  const closeWallLengthEditor = () => {
    setEditingWallIndex(null);
    setWallLengthDraft('');
    setWallLengthError(null);
  };

  const handleWallSelect = (wallIndex: number) => {
    closeWallLengthEditor();
    onWallSelect?.(wallIndex);
  };

  const handleWallLabelEditStart = (wallIndex: number) => {
    const wall = walls[wallIndex];
    if (!wall) return;

    onWallSelect?.(wallIndex);
    setEditingWallIndex(wallIndex);
    setWallLengthDraft((wall.lengthCm / 100).toFixed(2));
    setWallLengthError(null);
  };

  const handleWallLengthCommit = () => {
    if (editingWallIndex === null) return false;

    const parsedMeters = Number(wallLengthDraft.replace(',', '.'));
    if (!Number.isFinite(parsedMeters) || parsedMeters <= 0) {
      setWallLengthError('Longueur invalide');
      return false;
    }

    const next = updateWallLength(sortedVertices, editingWallIndex, parsedMeters * 100);
    if (!next) {
      setWallLengthError('Longueur invalide');
      return false;
    }

    onVerticesChange(next);
    onWallSelect?.(editingWallIndex);
    closeWallLengthEditor();
    return true;
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

        {snapGuide.x !== null && (
          <line
            x1={snapGuide.x}
            y1={0}
            x2={snapGuide.x}
            y2={height}
            stroke="#d83b01"
            strokeWidth={1.5}
            strokeDasharray="6 6"
            pointerEvents="none"
          />
        )}

        {snapGuide.y !== null && (
          <line
            x1={0}
            y1={snapGuide.y}
            x2={width}
            y2={snapGuide.y}
            stroke="#d83b01"
            strokeWidth={1.5}
            strokeDasharray="6 6"
            pointerEvents="none"
          />
        )}

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
          const isEditing = editingWallIndex === wall.index;
          return (
            <g
              key={`wall_${wall.index}`}
              onClick={() => handleWallSelect(wall.index)}
              onDoubleClick={(event) => handleWallDoubleClick(event, wall.index)}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1={wall.start.x}
                y1={wall.start.y}
                x2={wall.end.x}
                y2={wall.end.y}
                stroke={isSelected ? '#d83b01' : '#0e54e9'}
                strokeWidth={isSelected ? 6 : 4}
                strokeLinecap="round"
              />
              {isEditing ? (
                <foreignObject
                  x={middle.x - 42}
                  y={middle.y - 15}
                  width={84}
                  height={30}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  <div style={{ width: '100%', height: '100%' }}>
                    <input
                      ref={wallLengthInputRef}
                      type="text"
                      inputMode="decimal"
                      value={wallLengthDraft}
                      aria-label={`Longueur du mur ${wall.index + 1}`}
                      onChange={(event) => {
                        setWallLengthDraft(event.target.value);
                        if (wallLengthError) {
                          setWallLengthError(null);
                        }
                      }}
                      onBlur={() => {
                        if (!handleWallLengthCommit()) {
                          closeWallLengthEditor();
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleWallLengthCommit();
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault();
                          closeWallLengthEditor();
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '6px',
                        border: `1px solid ${wallLengthError ? '#d83b01' : '#0e54e9'}`,
                        padding: '0 6px',
                        fontSize: '11px',
                        textAlign: 'center',
                        color: '#24292f',
                        background: '#ffffff',
                      }}
                    />
                  </div>
                </foreignObject>
              ) : (
                <g
                  onClick={(event) => {
                    event.stopPropagation();
                    handleWallLabelEditStart(wall.index);
                  }}
                  onDoubleClick={(event) => event.stopPropagation()}
                  style={{ cursor: 'text' }}
                >
                  <rect
                    x={middle.x - 36}
                    y={middle.y - 14}
                    width={72}
                    height={20}
                    rx={6}
                    fill="white"
                    stroke={isSelected ? '#d83b01' : '#d0d7de'}
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
              )}
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
          Clique sur le cartouche d'un mur pour modifier sa longueur directement dans le plan.
        </p>
        <p style={{ color: '#57606a', fontSize: 14 }}>
          Clique sur un sommet pour le supprimer ou sur deux sommets consécutifs pour insérer un sommet au milieu du mur.
        </p>
        <p style={{ color: '#57606a', fontSize: 14 }}>
          Pendant le déplacement, un sommet s'aligne automatiquement sur les axes des autres points s'il passe à moins de {SNAP_THRESHOLD_CM} cm.
        </p>
        <button
          type="button"
          onClick={handleDeleteSelectedVertex}
          disabled={!canDeleteSelectedVertex}
          style={{
            width: '100%',
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid #d0d7de',
            background: canDeleteSelectedVertex ? '#d83b01' : '#f6f8fa',
            color: canDeleteSelectedVertex ? 'white' : '#8c959f',
            cursor: canDeleteSelectedVertex ? 'pointer' : 'not-allowed',
          }}
        >
          Supprimer le sommet sélectionné
        </button>
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
        {selectedVertex !== null && sortedVertices.length <= 3 && (
          <p style={{ color: '#d83b01', fontSize: 14 }}>
            Une pièce doit conserver au moins 3 sommets.
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
