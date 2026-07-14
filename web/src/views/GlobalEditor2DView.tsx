import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Menu, NativeSelect } from '@mantine/core';
import { LuLock, LuRedo2, LuUndo2 } from 'react-icons/lu';
import {
  Canvas2D, CanvasDisplayOptionsMenu, DEFAULT_CANVAS_DISPLAY_OPTIONS,
  type CanvasDisplayOptions, type CanvasLevelData,
} from '../components/Canvas2D';
import { DashboardLayout } from '../components/DashboardLayout';
import { ActionHistoryProvider, useActionHistory } from '../components/ActionHistory';
import { EditorCreationPanel, EditorDetailPanel } from '../components/EditorPanels';
import { SelectionSyncBridge, useEditorSelection } from '../components/SelectionSyncBridge';
import { usePreferences } from '../components/PreferencesContext';
import { getProjectEditingLock } from '../data/supabase/editingLock';
import { getGlobalEditorAccess, type GlobalEditorAccess } from '../domain/globalEditorAccess';
import type { Level, Project, ProjectEditingLock } from '../domain/types';
import type { Point } from '../domain/types';
import { snapGlobalPoint, translateRoomVertices, validateRoomPolygon } from '../domain/globalGeometry';
import { updateVertexPosition } from '../domain/geometry';
import { hasSupabaseConfig } from '../lib/supabase';
import { listLevelsByProject } from '../services/levels';
import { canWriteProject, getProject } from '../services/projects';
import { createRectangleRoom, listRoomsByLevel, loadRoomSnapshot, updateRoomGeometryAtomically, type RoomSnapshot } from '../services/rooms';

interface GlobalEditor2DViewProps {
  projectId: string;
  initialLevelId?: string;
  onLevelChange?(levelId: string): void;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Le plan n’a pas pu être chargé.';
}

export function GlobalEditor2DView({ projectId, initialLevelId = '', onLevelChange }: GlobalEditor2DViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [levelData, setLevelData] = useState<CanvasLevelData[]>([]);
  const [activeLevelId, setActiveLevelId] = useState(initialLevelId);
  const [visibleLevelIds, setVisibleLevelIds] = useState<string[]>([]);
  const [options, setOptions] = useState<CanvasDisplayOptions>(DEFAULT_CANVAS_DISPLAY_OPTIONS);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [editingLock, setEditingLock] = useState<ProjectEditingLock | null>(null);

  const load = async () => {
    if (!projectId) { setProject(null); setLevels([]); setLevelData([]); setCanWrite(false); setEditingLock(null); setActiveLevelId(''); setVisibleLevelIds([]); setLoading(false); return; }
    setLoading(true); setError(''); setProject(null); setLevels([]); setLevelData([]); setCanWrite(false); setEditingLock(null);
    try {
      const [nextProject, nextLevels, writeAllowed, nextLock] = await Promise.all([getProject(projectId), listLevelsByProject(projectId), canWriteProject(projectId), getProjectEditingLock(projectId)]);
      const nextData = await Promise.all(nextLevels.map(async (level): Promise<CanvasLevelData> => {
        const rooms = await listRoomsByLevel(level.id);
        return { level, rooms: await Promise.all(rooms.map(({ id }) => loadRoomSnapshot(id))) };
      }));
      const initiallyVisible = nextLevels.filter(({ isVisible }) => isVisible).map(({ id }) => id);
      const fallbackVisible = initiallyVisible.length ? initiallyVisible : nextLevels[0] ? [nextLevels[0].id] : [];
      const nextActive = nextLevels.some(({ id }) => id === initialLevelId) ? initialLevelId : fallbackVisible[0] ?? '';
      setProject(nextProject); setLevels(nextLevels); setLevelData(nextData); setVisibleLevelIds(fallbackVisible); setActiveLevelId(nextActive); setCanWrite(writeAllowed); setEditingLock(nextLock);
      if (nextActive && nextActive !== initialLevelId) onLevelChange?.(nextActive);
    } catch (caught) { setError(message(caught)); setProject(null); setLevels([]); setLevelData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (hasSupabaseConfig()) void load(); }, [projectId]);
  useEffect(() => {
    if (!projectId || !hasSupabaseConfig()) return undefined;
    const refresh = () => void getProjectEditingLock(projectId).then(setEditingLock).catch(() => undefined);
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, [projectId]);

  const activeLevel = useMemo(() => levels.find(({ id }) => id === activeLevelId) ?? null, [activeLevelId, levels]);
  const validObjects = useMemo(() => new Set(levelData.flatMap(({ level, rooms, notes = [], dimensions = [] }) => [
    `level:${level.id}`,
    ...rooms.flatMap(({ room, walls, openings }) => [`room:${room.id}`, ...walls.map(({ id }) => `wall:${id}`), ...openings.map(({ id }) => `opening:${id}`)]),
    ...notes.map(({ id }) => `note:${id}`), ...dimensions.map(({ id }) => `dimension:${id}`),
  ])), [levelData]);
  const toggleLevel = (levelId: string, checked: boolean) => {
    if (checked) { setVisibleLevelIds((current) => [...new Set([...current, levelId])]); return; }
    if (visibleLevelIds.length === 1) return;
    const nextVisible = visibleLevelIds.filter((id) => id !== levelId);
    setVisibleLevelIds(nextVisible);
    if (levelId === activeLevelId) {
      const currentNumber = levels.find(({ id }) => id === levelId)?.number ?? 0;
      const below = levels.filter(({ id, number }) => nextVisible.includes(id) && number < currentNumber).sort((a, b) => b.number - a.number)[0];
      const above = levels.filter(({ id, number }) => nextVisible.includes(id) && number > currentNumber).sort((a, b) => a.number - b.number)[0];
      const nextActive = below?.id ?? above?.id ?? nextVisible[0];
      if (nextActive) { setActiveLevelId(nextActive); onLevelChange?.(nextActive); }
    }
  };

  if (!hasSupabaseConfig()) return <DashboardLayout><div className="dashboard-emptyState" role="alert">Configure Supabase pour afficher le plan.</div></DashboardLayout>;
  if (!projectId) return <DashboardLayout><div className="dashboard-emptyState"><h2>Aucun projet courant</h2><p>Choisis ou crée un projet depuis la barre latérale pour afficher son plan.</p></div></DashboardLayout>;

  return <ActionHistoryProvider><SelectionSyncBridge key={projectId} validObjects={validObjects} onLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }}><GlobalEditorContent project={project} levels={levels} levelData={levelData} activeLevelId={activeLevelId} visibleLevelIds={visibleLevelIds} options={options} loading={loading} error={error} access={getGlobalEditorAccess(canWrite, editingLock)} onRetry={load} onOptionsChange={setOptions} onToggleLevel={toggleLevel} onActiveLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }} /></SelectionSyncBridge></ActionHistoryProvider>;
}

interface GlobalEditorContentProps { project: Project | null; levels: Level[]; levelData: CanvasLevelData[]; activeLevelId: string; visibleLevelIds: string[]; options: CanvasDisplayOptions; loading: boolean; error: string; access: GlobalEditorAccess; onRetry(): Promise<void>; onOptionsChange(value: CanvasDisplayOptions): void; onToggleLevel(id: string, checked: boolean): void; onActiveLevelChange(id: string): void }

export function GlobalEditorContent({ project, levels, levelData, activeLevelId, visibleLevelIds, options, loading, error, access, onRetry, onOptionsChange, onToggleLevel, onActiveLevelChange }: GlobalEditorContentProps) {
  const { preferences } = usePreferences(); const { selection, select } = useEditorSelection(); const { canUndo, canRedo, record, undo, redo } = useActionHistory(); const activeLevel = levels.find(({ id }) => id === activeLevelId) ?? null; const activeData = levelData.find(({ level }) => level.id === activeLevelId);
  const [creationMode, setCreationMode] = useState(false); const [creationFirstPoint, setCreationFirstPoint] = useState<Point | null>(null); const [creationPreviewPoint, setCreationPreviewPoint] = useState<Point | null>(null); const [geometryFeedback, setGeometryFeedback] = useState(''); const [geometryError, setGeometryError] = useState('');
  const selectionLocked = levelData.some(({ rooms }) => rooms.some(({ room, walls, openings }) => (selection?.type === 'room' && room.id === selection.id && room.isLocked) || (selection?.type === 'wall' && walls.some(({ id, isLocked }) => id === selection.id && isLocked)) || (selection?.type === 'opening' && openings.some(({ id, isLocked }) => id === selection.id && isLocked))));
  const allVertices = levelData.flatMap(({ rooms }) => rooms.flatMap(({ vertices }) => vertices));
  const createAtPoint = async (rawPoint: Point) => {
    if (!creationMode || !activeLevel || access.readOnly) return; const point = snapGlobalPoint(rawPoint, allVertices, null);
    if (!creationFirstPoint) { setCreationFirstPoint(point); setCreationPreviewPoint(point); setGeometryFeedback('Premier angle placé. Cliquez sur l’angle opposé.'); return; }
    setGeometryError('');
    try { const created = await createRectangleRoom({ levelId: activeLevel.id, name: 'Nouvelle pièce', firstPoint: creationFirstPoint, secondPoint: point, wallThicknessCm: preferences.defaultWallThicknessCm, wallHeightCm: preferences.defaultWallHeightCm }); setCreationFirstPoint(null); setCreationPreviewPoint(null); setCreationMode(false); setGeometryFeedback('Pièce créée.'); await onRetry(); select({ source: 'canvas', type: 'room', id: created.room.id, levelId: activeLevel.id }); }
    catch (caught) { setGeometryError(message(caught)); }
  };
  const moveVertex = async (roomId: string, vertexId: string, rawPoint: Point) => {
    const snapshot = activeData?.rooms.find(({ room }) => room.id === roomId); if (!snapshot || access.readOnly || snapshot.room.isLocked) return;
    const point = snapGlobalPoint(rawPoint, allVertices, vertexId); const next: RoomSnapshot = { ...snapshot, vertices: updateVertexPosition(snapshot.vertices, vertexId, point.x, point.y) };
    const issue = validateRoomPolygon(next.vertices); if (issue) { setGeometryError(issue); return; }
    setGeometryError('');
    try { await updateRoomGeometryAtomically(next); setGeometryFeedback('Géométrie enregistrée.'); record({ label: 'Déplacer un sommet', undo: async () => { await updateRoomGeometryAtomically(snapshot); await onRetry(); }, redo: async () => { await updateRoomGeometryAtomically(next); await onRetry(); } }); await onRetry(); }
    catch (caught) { setGeometryError(`${message(caught)} La géométrie précédente a été conservée.`); await onRetry(); }
  };
  const moveRoom = async (roomId: string, delta: Point) => {
    const snapshot = activeData?.rooms.find(({ room }) => room.id === roomId); if (!snapshot || access.readOnly || snapshot.room.isLocked || Math.hypot(delta.x, delta.y) < 1) return;
    const anchor = snapGlobalPoint({ x: snapshot.vertices[0].x + delta.x, y: snapshot.vertices[0].y + delta.y }, allVertices.filter(({ pieceId }) => pieceId !== roomId), null);
    const snappedDelta = { x: anchor.x - snapshot.vertices[0].x, y: anchor.y - snapshot.vertices[0].y }; const next = { ...snapshot, vertices: translateRoomVertices(snapshot.vertices, snappedDelta) };
    try { await updateRoomGeometryAtomically(next); setGeometryFeedback('Pièce déplacée.'); record({ label: 'Déplacer une pièce', undo: async () => { await updateRoomGeometryAtomically(snapshot); await onRetry(); }, redo: async () => { await updateRoomGeometryAtomically(next); await onRetry(); } }); await onRetry(); }
    catch (caught) { setGeometryError(`${message(caught)} La géométrie précédente a été conservée.`); await onRetry(); }
  };
  return <DashboardLayout>
    <header className="global-editor__header">
      <div><p className="dashboard-eyebrow">Éditeur 2D global</p><h1 className="dashboard-pageTitle">{project?.name ?? 'Plan du projet'}</h1></div>
      <div className="dashboard-header__actions"><Button type="button" className="dashboard-iconButton" disabled={access.readOnly || !canUndo} onClick={undo} aria-label="Annuler"><LuUndo2 aria-hidden /></Button><Button type="button" className="dashboard-iconButton" disabled={access.readOnly || !canRedo} onClick={redo} aria-label="Rétablir"><LuRedo2 aria-hidden /></Button></div>
    </header>
    {!loading && access.message ? <Alert color="orange" icon={<LuLock aria-hidden />} role="status">{access.message}</Alert> : null}
    {selectionLocked ? <Alert color="yellow" icon={<LuLock aria-hidden />} role="status">L’élément sélectionné est verrouillé. Ses informations restent consultables, mais il ne peut pas être modifié.</Alert> : null}
    {geometryFeedback ? <div className="dashboard-banner dashboard-banner--success" role="status">{geometryFeedback}</div> : null}
    {geometryError ? <div className="dashboard-banner dashboard-banner--error" role="alert">{geometryError}</div> : null}
    {error ? <div className="dashboard-banner dashboard-banner--error" role="alert">{error}<Button type="button" onClick={() => void onRetry()}>Réessayer</Button></div> : null}
    <section className="global-editor__levelBar">
      <Menu position="bottom-start" withinPortal shadow="md">
        <Menu.Target><Button variant="default" size="md">Niveaux affichés</Button></Menu.Target>
      <Menu.Dropdown><div className="global-editor__visibleLevels">{levels.map((level) => <Checkbox key={level.id} label={level.name} checked={visibleLevelIds.includes(level.id)} onChange={(event) => onToggleLevel(level.id, event.currentTarget.checked)} />)}</div></Menu.Dropdown>
      </Menu>
      <div className="global-editor__editableLevel"><span>Niveau éditable</span><NativeSelect size="md" aria-label="Niveau éditable" value={activeLevelId} data={levels.map((level) => ({ value: level.id, label: level.name }))} onChange={(event) => onActiveLevelChange(event.currentTarget.value)} /></div>
      <Menu position="bottom-end" withinPortal shadow="md">
        <Menu.Target><Button className="global-editor__displayMenu" variant="default" size="md">Affichage</Button></Menu.Target>
        <Menu.Dropdown><CanvasDisplayOptionsMenu value={options} onChange={onOptionsChange} /></Menu.Dropdown>
      </Menu>
    </section>
    <section className="global-editor__body">
      <EditorCreationPanel levels={levels} levelData={levelData} activeLevelId={activeLevelId} readOnly={access.readOnly} selectionLocked={selectionLocked} onStartRoomCreation={() => { setCreationMode(true); setCreationFirstPoint(null); setCreationPreviewPoint(null); setGeometryFeedback('Cliquez sur le plan pour placer le premier angle.'); }} />
      <div className="global-editor__canvasArea">{loading ? <div className="dashboard-loading" aria-live="polite">Chargement du plan…</div> : !activeLevel ? <div className="dashboard-emptyState"><h2>Aucun niveau</h2><p>Le projet doit contenir au moins un niveau visible.</p></div> : <Canvas2D levels={levelData} activeLevelId={activeLevel.id} visibleLevelIds={visibleLevelIds} options={options} selection={selection} onSelect={select} editingEnabled={!access.readOnly && !creationMode} creationActive={creationMode} creationFirstPoint={creationFirstPoint} creationPreviewPoint={creationPreviewPoint} onCanvasPoint={(point) => void createAtPoint(point)} onCanvasHover={(point) => setCreationPreviewPoint(point ? snapGlobalPoint(point, allVertices, null) : null)} onVertexMove={(roomId, vertexId, point) => void moveVertex(roomId, vertexId, point)} onRoomMove={(roomId, delta) => void moveRoom(roomId, delta)} />}</div>
      <EditorDetailPanel data={activeData} />
    </section>
  </DashboardLayout>;
}
