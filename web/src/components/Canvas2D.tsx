import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Checkbox } from '@mantine/core';
import {
  LuBetweenHorizontalStart, LuDraftingCompass, LuEyeOff, LuGrid3X3, LuRuler,
  LuScan, LuShapes, LuStickyNote, LuZoomIn, LuZoomOut,
} from 'react-icons/lu';
import { centroid, polygonAreaCm2, polygonInteriorAnglesDegrees, sortVertices } from '../domain/geometry';
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM, panViewport, zoomViewport, type CanvasViewport } from '../domain/canvasViewport';
import type { Level, Point } from '../domain/types';
import type { RoomSnapshot } from '../services/rooms';
import type { EditorSelection } from '../domain/editorSelection';
import { RoomTypeIcon } from './RoomTypeIcon';

export interface CanvasDisplayOptions {
  grid: boolean; rulers: boolean; dimensions: boolean; angles: boolean;
  notes: boolean; surfaces: boolean; roomIcons: boolean;
}
export const DEFAULT_CANVAS_DISPLAY_OPTIONS: CanvasDisplayOptions = {
  grid: true, rulers: true, dimensions: true, angles: true,
  notes: true, surfaces: true, roomIcons: true,
};
export interface CanvasNote { id: string; levelId: string; position: Point; text: string }
export interface CanvasDimension { id: string; levelId: string; start: Point; end: Point; label?: string }
export interface CanvasLevelData { level: Level; rooms: RoomSnapshot[]; notes?: CanvasNote[]; dimensions?: CanvasDimension[] }

interface Canvas2DProps {
  levels: CanvasLevelData[];
  activeLevelId: string;
  visibleLevelIds: string[];
  options?: CanvasDisplayOptions;
  height?: number;
  selection?: EditorSelection | null;
  onSelect?(selection: EditorSelection): void;
}

const PADDING_CM = 120;
const MIN_VIEW_SIZE_CM = 500;

function initialViewport(levels: CanvasLevelData[], visibleIds: Set<string>): CanvasViewport {
  const vertices = levels.filter(({ level }) => visibleIds.has(level.id)).flatMap(({ rooms }) => rooms.flatMap(({ vertices: roomVertices }) => roomVertices));
  if (!vertices.length) return { x: -500, y: -350, width: 1000, height: 700 };
  const xs = vertices.map(({ x }) => x); const ys = vertices.map(({ y }) => y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  return { x: minX - PADDING_CM, y: minY - PADDING_CM, width: Math.max(MIN_VIEW_SIZE_CM, maxX - minX + PADDING_CM * 2), height: Math.max(MIN_VIEW_SIZE_CM, maxY - minY + PADDING_CM * 2) };
}

function levelAppearance(levelNumber: number, activeNumber: number) {
  const difference = levelNumber - activeNumber;
  if (difference === 0) return { stroke: '#182133', fill: 'rgba(33,112,121,.16)', opacity: 1 };
  return { stroke: difference < 0 ? '#9b6472' : '#637d9f', fill: difference < 0 ? 'rgba(155,100,114,.1)' : 'rgba(99,125,159,.1)', opacity: Math.max(.2, 1 - Math.abs(difference) * .2) };
}

function OpeningLines({ snapshot, stroke, levelId, selection, onSelect }: { snapshot: RoomSnapshot; stroke: string; levelId: string; selection: EditorSelection | null; onSelect?(selection: EditorSelection): void }) {
  const vertices = new Map(snapshot.vertices.map((vertex) => [vertex.id, vertex]));
  const walls = new Map(snapshot.walls.map((wall) => [wall.id, wall]));
  return <>{snapshot.openings.map((opening) => {
    const wall = walls.get(opening.wallId); const start = wall ? vertices.get(wall.startVertexId) : undefined; const end = wall ? vertices.get(wall.endVertexId) : undefined;
    if (!start || !end) return null;
    const length = Math.hypot(end.x - start.x, end.y - start.y); if (!length) return null;
    const from = opening.offsetCm / length; const to = (opening.offsetCm + opening.widthCm) / length;
    const selected = selection?.type === 'opening' && selection.id === opening.id;
    return <line className="canvas2d-selectable" key={opening.id} x1={start.x + (end.x - start.x) * from} y1={start.y + (end.y - start.y) * from} x2={start.x + (end.x - start.x) * to} y2={start.y + (end.y - start.y) * to} stroke={selected ? '#6757ff' : stroke} strokeWidth={selected ? 14 : 10} onClick={(event) => { event.stopPropagation(); onSelect?.({ source: 'canvas', type: 'opening', id: opening.id, levelId }); }} />;
  })}</>;
}

export function CanvasOverlayMeasurements({ snapshot, options }: { snapshot: RoomSnapshot; options: CanvasDisplayOptions }) {
  const vertices = sortVertices(snapshot.vertices); const angles = polygonInteriorAnglesDegrees(vertices);
  return <g className="canvas2d-measurements">
    {options.angles ? vertices.map((vertex, index) => Math.abs((angles[index] ?? 90) - 90) > .1 ? <text key={vertex.id} x={vertex.x + 12} y={vertex.y - 12}>{(angles[index] ?? 0).toFixed(1)}°</text> : null) : null}
    {options.dimensions ? vertices.map((vertex, index) => { const next = vertices[(index + 1) % vertices.length]; if (!next) return null; const length = Math.hypot(next.x - vertex.x, next.y - vertex.y); return <text key={`length-${vertex.id}`} x={(vertex.x + next.x) / 2} y={(vertex.y + next.y) / 2 - 8}>{length.toFixed(1)} cm</text>; }) : null}
  </g>;
}

export function CanvasZoomControls({ onZoomIn, onZoomOut, onReset }: { onZoomIn(): void; onZoomOut(): void; onReset(): void }) {
  return <div className="canvas2d-zoomControls" aria-label="Contrôles de zoom"><ActionIcon variant="default" size="lg" onClick={onZoomIn} aria-label="Zoom avant" title="Zoom avant"><LuZoomIn aria-hidden /></ActionIcon><ActionIcon variant="default" size="lg" onClick={onZoomOut} aria-label="Zoom arrière" title="Zoom arrière"><LuZoomOut aria-hidden /></ActionIcon><ActionIcon variant="default" size="lg" onClick={onReset} aria-label="Réinitialiser le zoom" title="Réinitialiser le zoom"><LuScan aria-hidden /></ActionIcon></div>;
}

export function CanvasScaleIndicator({ viewportWidth, renderedWidth }: { viewportWidth: number; renderedWidth: number }) {
  const pixelsPerCm = renderedWidth / Math.max(viewportWidth, 1); const candidates = [10, 20, 50, 100, 200, 500, 1000];
  const lengthCm = candidates.find((candidate) => candidate * pixelsPerCm >= 70) ?? 1000;
  return <div className="canvas2d-scale" aria-label={`Échelle graphique ${lengthCm} centimètres`}><span style={{ width: `${Math.min(160, lengthCm * pixelsPerCm)}px` }} /><strong>{lengthCm} cm</strong></div>;
}

export function CanvasDisplayOptionsMenu({ value, onChange }: { value: CanvasDisplayOptions; onChange(value: CanvasDisplayOptions): void }) {
  const items = [
    ['grid', 'Grille', LuGrid3X3], ['rulers', 'Règles', LuRuler], ['dimensions', 'Côtes', LuBetweenHorizontalStart],
    ['angles', 'Angles', LuDraftingCompass], ['notes', 'Notes', LuStickyNote], ['surfaces', 'Surfaces', LuScan], ['roomIcons', 'Icônes de pièces', LuShapes],
  ] as const;
  return <div className="canvas2d-options" aria-label="Options d’affichage">{items.map(([key, label, Icon]) => <div className="canvas2d-options__item" key={key}><Checkbox checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.currentTarget.checked })} aria-label={label} /><Icon aria-hidden /><span>{label}</span>{!value[key] ? <LuEyeOff aria-label="Masqué" /> : null}</div>)}</div>;
}

export function Canvas2D({ levels, activeLevelId, visibleLevelIds, options = DEFAULT_CANVAS_DISPLAY_OPTIONS, height = 700, selection = null, onSelect }: Canvas2DProps) {
  const visibleIds = useMemo(() => new Set(visibleLevelIds), [visibleLevelIds]); const resetViewport = useMemo(() => initialViewport(levels, visibleIds), [levels, visibleIds]);
  const [viewport, setViewport] = useState(resetViewport); const [drag, setDrag] = useState<{ x: number; y: number } | null>(null); const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => setViewport(resetViewport), [resetViewport]);
  const activeLevel = levels.find(({ level }) => level.id === activeLevelId)?.level; const activeNumber = activeLevel?.number ?? 0;
  const renderedWidth = svgRef.current?.getBoundingClientRect().width ?? 900;
  const pan = (event: React.PointerEvent<SVGSVGElement>) => { if (!drag || !svgRef.current) return; const rect = svgRef.current.getBoundingClientRect(); setViewport((current) => panViewport(current, { x: -(event.clientX - drag.x) * current.width / rect.width, y: -(event.clientY - drag.y) * current.height / rect.height })); setDrag({ x: event.clientX, y: event.clientY }); };
  const changeZoom = (factor: number) => setViewport((current) => {
    const currentZoom = resetViewport.width / current.width;
    const nextZoom = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, currentZoom * factor));
    return zoomViewport(current, nextZoom / currentZoom);
  });
  return <div className="canvas2d"><svg ref={svgRef} height={height} viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`} onPointerDown={(event) => { if (event.target === event.currentTarget || (event.target as Element).classList.contains('canvas2d-background')) { event.currentTarget.setPointerCapture(event.pointerId); setDrag({ x: event.clientX, y: event.clientY }); } }} onPointerMove={pan} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
    <defs><pattern id="canvas2d-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#dce3ec" strokeWidth="1" /></pattern></defs>
    <rect className="canvas2d-background" x={viewport.x} y={viewport.y} width={viewport.width} height={viewport.height} fill={options.grid ? 'url(#canvas2d-grid)' : '#fff'} />
    <g className="canvas2d-origin"><line x1={viewport.x} y1={0} x2={viewport.x + viewport.width} y2={0} /><line x1={0} y1={viewport.y} x2={0} y2={viewport.y + viewport.height} /><text x={8} y={-8}>0,0</text></g>
    {levels.filter(({ level }) => visibleIds.has(level.id)).sort((a, b) => a.level.number - b.level.number).map(({ level, rooms, notes = [], dimensions = [] }) => { const appearance = levelAppearance(level.number, activeNumber); return <g key={level.id} opacity={appearance.opacity} data-editable={level.id === activeLevelId}>
      {rooms.map((snapshot) => { const vertices = sortVertices(snapshot.vertices); const center = centroid(vertices); const roomSelected = selection?.type === 'room' && selection.id === snapshot.room.id; return <g key={snapshot.room.id} className={roomSelected ? 'is-selected' : ''}><polygon className="canvas2d-selectable" points={vertices.map(({ x, y }) => `${x},${y}`).join(' ')} fill={appearance.fill} stroke={roomSelected ? '#6757ff' : appearance.stroke} strokeWidth={roomSelected ? 10 : 6} onClick={(event) => { event.stopPropagation(); if (level.id === activeLevelId) onSelect?.({ source: 'canvas', type: 'room', id: snapshot.room.id, levelId: level.id }); }} />{snapshot.walls.map((wall) => { const start = snapshot.vertices.find(({ id }) => id === wall.startVertexId); const end = snapshot.vertices.find(({ id }) => id === wall.endVertexId); if (!start || !end) return null; const selected = selection?.type === 'wall' && selection.id === wall.id; return <line key={wall.id} className="canvas2d-selectable" x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={selected ? '#6757ff' : 'transparent'} strokeWidth={selected ? 12 : 18} onClick={(event) => { event.stopPropagation(); if (level.id === activeLevelId) onSelect?.({ source: 'canvas', type: 'wall', id: wall.id, levelId: level.id }); }} />; })}<OpeningLines snapshot={snapshot} stroke="#fff" levelId={level.id} selection={selection} onSelect={level.id === activeLevelId ? onSelect : undefined} /><CanvasOverlayMeasurements snapshot={snapshot} options={options} /><text className="canvas2d-roomName" x={center.x} y={center.y}>{snapshot.room.name}</text>{options.surfaces ? <text className="canvas2d-roomSurface" x={center.x} y={center.y + 22}>{(polygonAreaCm2(vertices) / 10000).toFixed(2)} m²</text> : null}{options.roomIcons && snapshot.room.type !== 'autre' ? <foreignObject x={center.x - 10} y={center.y + 28} width={20} height={20}><span className="canvas2d-roomIcon"><RoomTypeIcon type={snapshot.room.type} /></span></foreignObject> : null}</g>; })}
      {options.dimensions ? dimensions.map((dimension) => <g key={dimension.id} className="canvas2d-manualDimension"><line x1={dimension.start.x} y1={dimension.start.y} x2={dimension.end.x} y2={dimension.end.y} /><text x={(dimension.start.x + dimension.end.x) / 2} y={(dimension.start.y + dimension.end.y) / 2 - 8}>{dimension.label ?? `${Math.hypot(dimension.end.x - dimension.start.x, dimension.end.y - dimension.start.y).toFixed(1)} cm`}</text></g>) : null}
      {options.notes ? notes.map((note) => <g key={note.id} className="canvas2d-note"><circle cx={note.position.x} cy={note.position.y} r={12} /><text x={note.position.x + 18} y={note.position.y + 4}>🗒 {note.text}</text></g>) : null}
    </g>; })}
    {options.rulers ? <g className="canvas2d-rulers"><text x={viewport.x + 15} y={viewport.y + 25}>X : {Math.round(viewport.x)} → {Math.round(viewport.x + viewport.width)} cm</text><text x={viewport.x + 15} y={viewport.y + 48}>Y : {Math.round(viewport.y)} → {Math.round(viewport.y + viewport.height)} cm</text></g> : null}
  </svg><CanvasZoomControls onZoomIn={() => changeZoom(1.25)} onZoomOut={() => changeZoom(.8)} onReset={() => setViewport(resetViewport)} /><CanvasScaleIndicator viewportWidth={viewport.width} renderedWidth={renderedWidth} /></div>;
}
