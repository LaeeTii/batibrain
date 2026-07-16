import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Checkbox } from '@mantine/core';
import {
  LuBetweenHorizontalStart,
  LuDraftingCompass,
  LuEyeOff,
  LuGrid3X3,
  LuRuler,
  LuScan,
  LuShapes,
  LuStickyNote,
  LuZoomIn,
  LuZoomOut,
} from 'react-icons/lu';
import { Layer, Line, Rect, Stage, Text, Circle, Group } from 'react-konva';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import { centroid, polygonAreaCm2, polygonInteriorAnglesDegrees, sortVertices } from '../domain/geometry';
import {
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  expandViewportToCanvas,
  panViewport,
  zoomViewport,
  type CanvasViewport,
} from '../domain/canvasViewport';
import type { Level, Point } from '../domain/types';
import type { EditorSelection } from '../domain/editorSelection';
import { uniqueLevelOpenings, uniqueLevelWalls } from '../domain/roomOverlap';
import type { RoomSnapshot } from '../services/rooms';

type DragState = { x: number; y: number; viewport: CanvasViewport };

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

export interface CanvasNote {
  id: string;
  levelId: string;
  position: Point;
  text: string;
}

export interface CanvasDimension {
  id: string;
  levelId: string;
  start: Point;
  end: Point;
  label?: string;
}

export interface CanvasLevelData {
  level: Level;
  rooms: RoomSnapshot[];
  notes?: CanvasNote[];
  dimensions?: CanvasDimension[];
}

interface Canvas2DProps {
  levels: CanvasLevelData[];
  activeLevelId: string;
  visibleLevelIds: string[];
  viewportStateKey?: string;
  options?: CanvasDisplayOptions;
  height?: number;
  selection?: EditorSelection | null;
  onSelect?(selection: EditorSelection): void;
  editingEnabled?: boolean;
  creationFirstPoint?: Point | null;
  creationPreviewPoint?: Point | null;
  creationActive?: boolean;
  onCanvasPoint?(point: Point): void;
  onCanvasHover?(point: Point | null): void;
  snapPoint?(point: Point, roomId: string, vertexId: string): Point;
  onVertexMove?(roomId: string, vertexId: string, point: Point): void;
  onVertexMoveEnd?(roomId: string, vertexId: string, point: Point): void;
  onRoomMove?(roomId: string, delta: Point): void;
}

const PADDING_CM = 120;
const MIN_VIEW_SIZE_CM = 500;
const GRID_STEP_CM = 5;
const MEASUREMENT_OFFSET_CM = 24;
const viewportStateCache = new Map<string, CanvasViewport>();

function gridLines(viewport: CanvasViewport, stepCm = GRID_STEP_CM) {
  const firstX = Math.floor(viewport.x / stepCm) * stepCm;
  const firstY = Math.floor(viewport.y / stepCm) * stepCm;
  const lastX = viewport.x + viewport.width;
  const lastY = viewport.y + viewport.height;
  const vertical = [] as number[];
  const horizontal = [] as number[];

  for (let x = firstX; x <= lastX; x += stepCm) {
    vertical.push(x);
  }
  for (let y = firstY; y <= lastY; y += stepCm) {
    horizontal.push(y);
  }

  return { vertical, horizontal };
}

function segmentMeasurementPosition(start: Point, end: Point, roomCenter: Point): Point {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  if (length === 0) {
    return midpoint;
  }

  const normal = { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
  const first = { x: midpoint.x + normal.x * MEASUREMENT_OFFSET_CM, y: midpoint.y + normal.y * MEASUREMENT_OFFSET_CM };
  const second = { x: midpoint.x - normal.x * MEASUREMENT_OFFSET_CM, y: midpoint.y - normal.y * MEASUREMENT_OFFSET_CM };
  return Math.hypot(first.x - roomCenter.x, first.y - roomCenter.y) >= Math.hypot(second.x - roomCenter.x, second.y - roomCenter.y)
    ? first
    : second;
}

function initialViewport(levels: CanvasLevelData[], visibleIds: Set<string>): CanvasViewport {
  const vertices = levels
    .filter(({ level }) => visibleIds.has(level.id))
    .flatMap(({ rooms }) => rooms.flatMap(({ vertices: roomVertices }) => roomVertices));

  if (vertices.length === 0) {
    return { x: -500, y: -350, width: 1000, height: 700 };
  }

  const xs = vertices.map(({ x }) => x);
  const ys = vertices.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX - PADDING_CM,
    y: minY - PADDING_CM,
    width: Math.max(MIN_VIEW_SIZE_CM, maxX - minX + PADDING_CM * 2),
    height: Math.max(MIN_VIEW_SIZE_CM, maxY - minY + PADDING_CM * 2),
  };
}

function levelAppearance(levelNumber: number, activeNumber: number) {
  const difference = levelNumber - activeNumber;
  if (difference === 0) {
    return { stroke: '#182133', fill: 'rgba(33,112,121,.16)', opacity: 1 };
  }

  return {
    stroke: difference < 0 ? '#9b6472' : '#637d9f',
    fill: difference < 0 ? 'rgba(155,100,114,.1)' : 'rgba(99,125,159,.1)',
    opacity: Math.max(0.2, 1 - Math.abs(difference) * 0.2),
  };
}

function openingSegment(snapshot: RoomSnapshot, openingId: string) {
  const opening = snapshot.openings.find(({ id }) => id === openingId);
  if (!opening) {
    return null;
  }

  const wall = snapshot.walls.find(({ id }) => id === opening.wallId);
  if (!wall) {
    return null;
  }

  const start = snapshot.vertices.find(({ id }) => id === wall.startVertexId);
  const end = snapshot.vertices.find(({ id }) => id === wall.endVertexId);
  if (!start || !end) {
    return null;
  }

  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) {
    return null;
  }

  const from = opening.offsetCm / length;
  const to = (opening.offsetCm + opening.widthCm) / length;

  return {
    opening,
    x1: start.x + (end.x - start.x) * from,
    y1: start.y + (end.y - start.y) * from,
    x2: start.x + (end.x - start.x) * to,
    y2: start.y + (end.y - start.y) * to,
  };
}

function roomIcon(roomType: string): string {
  switch (roomType) {
    case 'cuisine':
      return 'C';
    case 'chambre':
      return 'Ch';
    case 'salon':
      return 'S';
    case 'salle_de_bain':
      return 'SdB';
    case 'toilettes':
      return 'WC';
    case 'bureau':
      return 'B';
    case 'garage':
      return 'G';
    case 'hall':
      return 'H';
    case 'salle_de_jeu':
      return 'J';
    case 'bibliotheque':
      return 'Bib';
    default:
      return '';
  }
}

export function CanvasOverlayMeasurements({ snapshot, options }: { snapshot: RoomSnapshot; options: CanvasDisplayOptions }) {
  const vertices = sortVertices(snapshot.vertices);
  const angles = polygonInteriorAnglesDegrees(vertices);
  const roomCenter = centroid(vertices);

  return (
    <>
      {options.angles
        ? vertices.map((vertex, index) => (
            Math.abs((angles[index] ?? 90) - 90) > 0.1 ? (
              <Text
                key={`angle-${vertex.id}`}
                x={vertex.x + 12}
                y={vertex.y - 12}
                text={`${(angles[index] ?? 0).toFixed(1)}°`}
                fontSize={11}
                fill="#57606a"
              />
            ) : null
          ))
        : null}
      {options.dimensions
        ? vertices.map((vertex, index) => {
            const next = vertices[(index + 1) % vertices.length];
            if (!next) {
              return null;
            }

            const length = Math.hypot(next.x - vertex.x, next.y - vertex.y);
            const labelPosition = segmentMeasurementPosition(vertex, next, roomCenter);
            return (
              <Text
                key={`length-${vertex.id}`}
                x={labelPosition.x - 35}
                y={labelPosition.y - 6}
                width={70}
                align="center"
                text={`${length.toFixed(1)} cm`}
                fontSize={11}
                fill="#57606a"
              />
            );
          })
        : null}
    </>
  );
}

export function CanvasZoomControls({ onZoomIn, onZoomOut, onReset }: { onZoomIn(): void; onZoomOut(): void; onReset(): void }) {
  return (
    <div className="canvas2d-zoomControls" aria-label="Contrôles de zoom">
      <ActionIcon variant="default" size="lg" onClick={onZoomIn} aria-label="Zoom avant" title="Zoom avant">
        <LuZoomIn aria-hidden />
      </ActionIcon>
      <ActionIcon variant="default" size="lg" onClick={onZoomOut} aria-label="Zoom arrière" title="Zoom arrière">
        <LuZoomOut aria-hidden />
      </ActionIcon>
      <ActionIcon variant="default" size="lg" onClick={onReset} aria-label="Réinitialiser le zoom" title="Réinitialiser le zoom">
        <LuScan aria-hidden />
      </ActionIcon>
    </div>
  );
}

export function CanvasScaleIndicator({ viewportWidth, renderedWidth }: { viewportWidth: number; renderedWidth: number }) {
  const pixelsPerCm = renderedWidth / Math.max(viewportWidth, 1);
  const candidates = [10, 20, 50, 100, 200, 500, 1000];
  const lengthCm = candidates.find((candidate) => candidate * pixelsPerCm >= 70) ?? 1000;

  return (
    <div className="canvas2d-scale" aria-label={`Échelle graphique ${lengthCm} centimètres`}>
      <span style={{ width: `${Math.min(160, lengthCm * pixelsPerCm)}px` }} />
      <strong>{lengthCm} cm</strong>
    </div>
  );
}

export function CanvasDisplayOptionsMenu({ value, onChange }: { value: CanvasDisplayOptions; onChange(value: CanvasDisplayOptions): void }) {
  const items = [
    ['grid', 'Grille', LuGrid3X3],
    ['rulers', 'Règles', LuRuler],
    ['dimensions', 'Côtes', LuBetweenHorizontalStart],
    ['angles', 'Angles', LuDraftingCompass],
    ['notes', 'Notes', LuStickyNote],
    ['surfaces', 'Surfaces', LuScan],
    ['roomIcons', 'Icônes de pièces', LuShapes],
  ] as const;

  return (
    <div className="canvas2d-options" aria-label="Options d’affichage">
      {items.map(([key, label, Icon]) => (
        <div className="canvas2d-options__item" key={key}>
          <Checkbox
            checked={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.currentTarget.checked })}
            aria-label={label}
          />
          <Icon aria-hidden />
          <span>{label}</span>
          {!value[key] ? <LuEyeOff aria-label="Masqué" /> : null}
        </div>
      ))}
    </div>
  );
}

export function Canvas2D({
  levels,
  activeLevelId,
  visibleLevelIds,
  viewportStateKey,
  options = DEFAULT_CANVAS_DISPLAY_OPTIONS,
  height = 700,
  selection = null,
  onSelect,
  editingEnabled = false,
  creationFirstPoint = null,
  creationPreviewPoint = null,
  creationActive = false,
  onCanvasPoint,
  onCanvasHover,
  snapPoint,
  onVertexMove,
  onVertexMoveEnd,
  onRoomMove,
}: Canvas2DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [drag, setDrag] = useState<DragState | null>(null);
  const roomDragRef = useRef<{ roomId: string; start: Point } | null>(null);
  const pointerMovedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const visibleIds = useMemo(() => new Set(visibleLevelIds), [visibleLevelIds]);
  const resetViewport = useMemo(() => initialViewport(levels, visibleIds), [levels, visibleIds]);
  const [viewport, setViewport] = useState(() => (
    viewportStateKey ? (viewportStateCache.get(viewportStateKey) ?? resetViewport) : resetViewport
  ));

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const element = containerRef.current;
    const updateWidth = () => setCanvasWidth(Math.max(320, Math.round(element.getBoundingClientRect().width)));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!viewportStateKey) {
      return;
    }

    const cached = viewportStateCache.get(viewportStateKey);
    if (cached) {
      setViewport(cached);
    }
  }, [viewportStateKey]);

  useEffect(() => {
    if (!viewportStateKey) {
      return;
    }

    viewportStateCache.set(viewportStateKey, viewport);
  }, [viewport, viewportStateKey]);

  const scale = Math.min(canvasWidth / viewport.width, height / viewport.height);
  const offsetX = (canvasWidth - viewport.width * scale) / 2;
  const offsetY = (height - viewport.height * scale) / 2;
  const visibleViewport = useMemo(
    () => expandViewportToCanvas(viewport, canvasWidth, height),
    [canvasWidth, height, viewport],
  );
  const grid = useMemo(() => gridLines(visibleViewport), [visibleViewport]);

  const activeLevel = levels.find(({ level }) => level.id === activeLevelId)?.level;
  const activeNumber = activeLevel?.number ?? 0;
  const selectedEditableRoom = selection?.type === 'room' && selection.levelId === activeLevelId && editingEnabled
    ? levels.find(({ level }) => level.id === activeLevelId)?.rooms.find(({ room }) => room.id === selection.id)
    : undefined;

  const stageToWorld = (stagePoint: Point): Point => ({
    x: (stagePoint.x - offsetX) / scale + viewport.x,
    y: (stagePoint.y - offsetY) / scale + viewport.y,
  });

  const getPointerWorldPoint = (stage: KonvaStage | null): Point | null => {
    const pointer = stage?.getPointerPosition();
    if (!pointer) {
      return null;
    }

    return stageToWorld(pointer);
  };

  const startPan = (clientX: number, clientY: number) => {
    setDrag({ x: clientX, y: clientY, viewport });
  };

  const updatePan = (clientX: number, clientY: number) => {
    if (!drag) {
      return;
    }

    setViewport(
      panViewport(drag.viewport, {
        x: -(clientX - drag.x) / scale,
        y: -(clientY - drag.y) / scale,
      }),
    );
  };

  const changeZoom = (factor: number) => {
    setViewport((current) => {
      const currentZoom = resetViewport.width / current.width;
      const nextZoom = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, currentZoom * factor));
      return zoomViewport(current, nextZoom / currentZoom);
    });
  };

  return (
    <div className={`canvas2d${creationActive ? ' canvas2d--creating' : ''}`} ref={containerRef}>
      <Stage
        width={canvasWidth}
        height={height}
        onMouseDown={(event) => {
          if (!creationActive) {
            return;
          }

          pointerMovedRef.current = false;
          pointerStartRef.current = { x: event.evt.clientX, y: event.evt.clientY };
        }}
        onMouseMove={(event) => {
          const start = pointerStartRef.current;
          if (start && Math.hypot(event.evt.clientX - start.x, event.evt.clientY - start.y) > 3) {
            pointerMovedRef.current = true;
          }

          if (creationActive) {
            onCanvasHover?.(getPointerWorldPoint(event.target.getStage()));
          }

          updatePan(event.evt.clientX, event.evt.clientY);
        }}
        onClick={(event) => {
          if (!creationActive || pointerMovedRef.current || !onCanvasPoint) {
            return;
          }

          const point = getPointerWorldPoint(event.target.getStage());
          if (point) {
            onCanvasPoint(point);
          }
        }}
        onMouseUp={(event) => {
          setDrag(null);
          pointerStartRef.current = null;

          const roomDrag = roomDragRef.current;
          if (roomDrag && onRoomMove) {
            const endPoint = getPointerWorldPoint(event.target.getStage());
            if (endPoint) {
              onRoomMove(roomDrag.roomId, {
                x: endPoint.x - roomDrag.start.x,
                y: endPoint.y - roomDrag.start.y,
              });
            }
          }
          roomDragRef.current = null;
        }}
        onMouseLeave={() => {
          setDrag(null);
          pointerStartRef.current = null;
          if (creationActive) {
            onCanvasHover?.(null);
          }
        }}
      >
        <Layer scaleX={scale} scaleY={scale} x={offsetX - viewport.x * scale} y={offsetY - viewport.y * scale}>
          <Rect
            name="canvas2d-background"
            x={visibleViewport.x}
            y={visibleViewport.y}
            width={visibleViewport.width}
            height={visibleViewport.height}
            fill={options.grid ? '#f8fafc' : '#fff'}
            onMouseDown={(event) => {
              pointerMovedRef.current = false;
              pointerStartRef.current = { x: event.evt.clientX, y: event.evt.clientY };

              if (!creationActive) {
                startPan(event.evt.clientX, event.evt.clientY);
              }
            }}
          />

          {options.grid ? (
            <Group name="canvas-grid" listening={false}>
              {grid.vertical.map((x) => (
                <Line
                  key={`vertical-${x}`}
                  points={[x, visibleViewport.y, x, visibleViewport.y + visibleViewport.height]}
                  stroke={x === 0 ? '#cbd5e1' : '#e2e8f0'}
                  strokeWidth={x === 0 ? 1.5 : 1}
                />
              ))}
              {grid.horizontal.map((y) => (
                <Line
                  key={`horizontal-${y}`}
                  points={[visibleViewport.x, y, visibleViewport.x + visibleViewport.width, y]}
                  stroke={y === 0 ? '#cbd5e1' : '#e2e8f0'}
                  strokeWidth={y === 0 ? 1.5 : 1}
                />
              ))}
            </Group>
          ) : null}

          {options.rulers ? (
            <Group>
              <Text x={8} y={-8} text="0,0" fontSize={11} fill="#64748b" />
              <Text
                x={viewport.x + 15}
                y={viewport.y + 25}
                text={`X : ${Math.round(viewport.x)} -> ${Math.round(viewport.x + viewport.width)} cm`}
                fontSize={12}
                fill="#57606a"
              />
              <Text
                x={viewport.x + 15}
                y={viewport.y + 48}
                text={`Y : ${Math.round(viewport.y)} -> ${Math.round(viewport.y + viewport.height)} cm`}
                fontSize={12}
                fill="#57606a"
              />
            </Group>
          ) : null}

          {levels
            .filter(({ level }) => visibleIds.has(level.id))
            .sort((a, b) => a.level.number - b.level.number)
            .map(({ level, rooms, notes = [], dimensions = [] }) => {
              const appearance = levelAppearance(level.number, activeNumber);
              const walls = uniqueLevelWalls(rooms);
              const openings = uniqueLevelOpenings(rooms);
              const isActiveLevel = level.id === activeLevelId;
              return (
                <Group key={level.id} opacity={appearance.opacity}>
                  {rooms.map((snapshot) => {
                    const vertices = sortVertices(snapshot.vertices);
                    const points = vertices.flatMap((vertex) => [vertex.x, vertex.y]);
                    const center = centroid(vertices);
                    const isRoomSelected = selection?.type === 'room' && selection.id === snapshot.room.id;

                    return (
                      <Group key={snapshot.room.id}>
                        <Line
                          points={points}
                          closed
                          fill={appearance.fill}
                          stroke={isRoomSelected ? '#6757ff' : snapshot.walls.length === 0 ? appearance.stroke : 'rgba(0,0,0,0)'}
                          strokeWidth={isRoomSelected ? 8 : snapshot.walls.length === 0 ? 4 : 0}
                          onClick={() => {
                            if (!creationActive && isActiveLevel) {
                              onSelect?.({ source: 'canvas', type: 'room', id: snapshot.room.id, levelId: level.id });
                            }
                          }}
                          onMouseDown={(event) => {
                            if (!isActiveLevel || !editingEnabled || !isRoomSelected) {
                              return;
                            }

                            const start = getPointerWorldPoint(event.target.getStage());
                            if (start) {
                              roomDragRef.current = { roomId: snapshot.room.id, start };
                            }
                          }}
                        />

                        <Text x={center.x - 26} y={center.y - 12} text={snapshot.room.name} fontSize={14} fill="#0f172a" />
                        {options.surfaces ? (
                          <Text
                            x={center.x - 24}
                            y={center.y + 6}
                            text={`${(polygonAreaCm2(vertices) / 10000).toFixed(2)} m²`}
                            fontSize={12}
                            fill="#334155"
                          />
                        ) : null}
                        {options.roomIcons && snapshot.room.type !== 'autre' ? (
                          <Text x={center.x - 12} y={center.y + 24} text={roomIcon(snapshot.room.type)} fontSize={12} fill="#475569" />
                        ) : null}

                        <CanvasOverlayMeasurements snapshot={snapshot} options={options} />

                      </Group>
                    );
                  })}

                  {walls.map((wall) => {
                    const owner = rooms.find((snapshot) => snapshot.walls.some(({ id }) => id === wall.id));
                    const localWall = owner?.walls.find(({ id }) => id === wall.id);
                    const start = owner?.vertices.find(({ id }) => id === localWall?.startVertexId);
                    const end = owner?.vertices.find(({ id }) => id === localWall?.endVertexId);
                    if (!start || !end) return null;
                    const isWallSelected = selection?.type === 'wall' && selection.id === wall.id;
                    return (
                      <Line
                        key={wall.id}
                        name="canvas-level-wall"
                        points={[start.x, start.y, end.x, end.y]}
                        stroke={isWallSelected ? '#6757ff' : appearance.stroke}
                        strokeWidth={isWallSelected ? 10 : 4}
                        onClick={() => {
                          if (!creationActive && isActiveLevel) onSelect?.({ source: 'canvas', type: 'wall', id: wall.id, levelId: level.id });
                        }}
                      />
                    );
                  })}

                  {openings.map((opening) => {
                    const owner = rooms.find((snapshot) => snapshot.openings.some(({ id }) => id === opening.id));
                    const segment = owner ? openingSegment(owner, opening.id) : null;
                    if (!segment) return null;
                    const isOpeningSelected = selection?.type === 'opening' && selection.id === opening.id;
                    return (
                      <Line
                        key={opening.id}
                        name="canvas-level-opening"
                        points={[segment.x1, segment.y1, segment.x2, segment.y2]}
                        stroke={isOpeningSelected ? '#6757ff' : '#ffffff'}
                        strokeWidth={isOpeningSelected ? 12 : 8}
                        onClick={() => {
                          if (!creationActive && isActiveLevel) onSelect?.({ source: 'canvas', type: 'opening', id: opening.id, levelId: level.id });
                        }}
                      />
                    );
                  })}

                  {options.dimensions
                    ? dimensions.map((dimension) => (
                        <Group key={dimension.id}>
                          <Line points={[dimension.start.x, dimension.start.y, dimension.end.x, dimension.end.y]} stroke="#334155" strokeWidth={1.5} />
                          <Text
                            x={(dimension.start.x + dimension.end.x) / 2}
                            y={(dimension.start.y + dimension.end.y) / 2 - 8}
                            text={dimension.label ?? `${Math.hypot(dimension.end.x - dimension.start.x, dimension.end.y - dimension.start.y).toFixed(1)} cm`}
                            fontSize={11}
                            fill="#334155"
                          />
                        </Group>
                      ))
                    : null}

                  {options.notes
                    ? notes.map((note) => (
                        <Group key={note.id}>
                          <Circle x={note.position.x} y={note.position.y} radius={10} fill="#fde68a" stroke="#f59e0b" strokeWidth={1} />
                          <Text x={note.position.x + 14} y={note.position.y - 5} text={note.text} fontSize={11} fill="#7c2d12" />
                        </Group>
                      ))
                    : null}
                </Group>
              );
            })}

          {selectedEditableRoom ? (
            <Group name="canvas-vertex-handles">
              {sortVertices(selectedEditableRoom.vertices).map((vertex) => (
                <Circle
                  key={vertex.id}
                  name="canvas-vertex-handle"
                  x={vertex.x}
                  y={vertex.y}
                  radius={7}
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth={2}
                  draggable
                  onDragMove={(event) => {
                    const position = snapPoint?.({
                      x: event.target.x(),
                      y: event.target.y(),
                    }, selectedEditableRoom.room.id, vertex.id) ?? {
                      x: event.target.x(),
                      y: event.target.y(),
                    };
                    event.target.position(position);
                    onVertexMove?.(selectedEditableRoom.room.id, vertex.id, position);
                  }}
                  onDragEnd={(event) => {
                    const position = snapPoint?.({
                      x: event.target.x(),
                      y: event.target.y(),
                    }, selectedEditableRoom.room.id, vertex.id) ?? {
                      x: event.target.x(),
                      y: event.target.y(),
                    };
                    event.target.position(position);
                    onVertexMove?.(selectedEditableRoom.room.id, vertex.id, position);
                    onVertexMoveEnd?.(selectedEditableRoom.room.id, vertex.id, position);
                  }}
                />
              ))}
            </Group>
          ) : null}

          {creationFirstPoint && creationPreviewPoint ? (
            <Line
              name="canvas2d-creationPreview"
              points={[
                creationFirstPoint.x,
                creationFirstPoint.y,
                creationPreviewPoint.x,
                creationFirstPoint.y,
                creationPreviewPoint.x,
                creationPreviewPoint.y,
                creationFirstPoint.x,
                creationPreviewPoint.y,
              ]}
              closed
              fill="rgba(14,84,233,0.12)"
              stroke="#0e54e9"
              dash={[8, 6]}
            />
          ) : null}

          {creationFirstPoint ? (
            <Group>
              <Circle x={creationFirstPoint.x} y={creationFirstPoint.y} radius={9} fill="#0e54e9" />
              <Text x={creationFirstPoint.x + 14} y={creationFirstPoint.y - 14} text="Premier angle" fontSize={12} fill="#0e54e9" />
            </Group>
          ) : null}
        </Layer>
      </Stage>

      <CanvasZoomControls
        onZoomIn={() => changeZoom(1.25)}
        onZoomOut={() => changeZoom(0.8)}
        onReset={() => setViewport(resetViewport)}
      />
      <CanvasScaleIndicator viewportWidth={viewport.width} renderedWidth={canvasWidth} />
    </div>
  );
}
