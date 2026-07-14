import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useUnsavedChanges } from '../components/UnsavedChangesContext';
import { getGlobalEditorAccess, type GlobalEditorAccess } from '../domain/globalEditorAccess';
import type { Level, Project } from '../domain/types';
import type { Point } from '../domain/types';
import { snapGlobalPoint, translateRoomVertices, validateRoomPolygon } from '../domain/globalGeometry';
import { updateVertexPosition } from '../domain/geometry';
import { hasSupabaseConfig } from '../lib/supabase';
import { listLevelsByProject } from '../services/levels';
import { canWriteProject, getProject } from '../services/projects';
import { createRoomComplete, listRoomsByLevel, loadRoomSnapshot, type RoomSnapshot, updateRoomGeometry } from '../services/rooms';
import { DEFAULT_ROOM_FLOOR_COLOR, DEFAULT_ROOM_TYPE } from '../domain/room';
import { createRectangleRoomGeometryFromPoints } from '../domain/geometry';

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

  const load = async () => {
    if (!projectId) { setProject(null); setLevels([]); setLevelData([]); setCanWrite(false); setActiveLevelId(''); setVisibleLevelIds([]); setLoading(false); return; }
    setLoading(true); setError(''); setProject(null); setLevels([]); setLevelData([]); setCanWrite(false);
    try {
      const [nextProject, nextLevels, writeAllowed] = await Promise.all([getProject(projectId), listLevelsByProject(projectId), canWriteProject(projectId)]);
      const nextData = await Promise.all(nextLevels.map(async (level): Promise<CanvasLevelData> => {
        const rooms = await listRoomsByLevel(level.id);
        return { level, rooms: await Promise.all(rooms.map(({ id }) => loadRoomSnapshot(id))) };
      }));
      const initiallyVisible = nextLevels.filter(({ isVisible }) => isVisible).map(({ id }) => id);
      const fallbackVisible = initiallyVisible.length ? initiallyVisible : nextLevels[0] ? [nextLevels[0].id] : [];
      const nextActive = nextLevels.some(({ id }) => id === initialLevelId) ? initialLevelId : fallbackVisible[0] ?? '';
      setProject(nextProject); setLevels(nextLevels); setLevelData(nextData); setVisibleLevelIds(fallbackVisible); setActiveLevelId(nextActive); setCanWrite(writeAllowed);
      if (nextActive && nextActive !== initialLevelId) onLevelChange?.(nextActive);
    } catch (caught) { setError(message(caught)); setProject(null); setLevels([]); setLevelData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (hasSupabaseConfig()) void load(); }, [projectId]);

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

  return <ActionHistoryProvider><SelectionSyncBridge key={projectId} validObjects={validObjects} onLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }}><GlobalEditorContent project={project} levels={levels} levelData={levelData} activeLevelId={activeLevelId} visibleLevelIds={visibleLevelIds} options={options} loading={loading} error={error} access={getGlobalEditorAccess(canWrite)} onRetry={load} onOptionsChange={setOptions} onToggleLevel={toggleLevel} onActiveLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }} /></SelectionSyncBridge></ActionHistoryProvider>;
}

interface GlobalEditorContentProps { project: Project | null; levels: Level[]; levelData: CanvasLevelData[]; activeLevelId: string; visibleLevelIds: string[]; options: CanvasDisplayOptions; loading: boolean; error: string; access: GlobalEditorAccess; onRetry(): Promise<void>; onOptionsChange(value: CanvasDisplayOptions): void; onToggleLevel(id: string, checked: boolean): void; onActiveLevelChange(id: string): void }

export function GlobalEditorContent({ project, levels, levelData, activeLevelId, visibleLevelIds, options, loading, error, access, onRetry, onOptionsChange, onToggleLevel, onActiveLevelChange }: GlobalEditorContentProps) {
  const { setSourceDirty } = useUnsavedChanges();
  const { preferences } = usePreferences(); const { selection, select } = useEditorSelection(); const { canUndo, canRedo, record, undo, redo } = useActionHistory(); const activeLevel = levels.find(({ id }) => id === activeLevelId) ?? null;
  const [workingLevelData, setWorkingLevelData] = useState(levelData);
  const [creationMode, setCreationMode] = useState(false); const [creationFirstPoint, setCreationFirstPoint] = useState<Point | null>(null); const [creationPreviewPoint, setCreationPreviewPoint] = useState<Point | null>(null); const [geometryError, setGeometryError] = useState('');
  const [unsavedSnapshots, setUnsavedSnapshots] = useState<Record<string, RoomSnapshot>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'synced' | 'error'>('idle');
  const unsavedSnapshotsRef = useRef<Record<string, RoomSnapshot>>({});
  const persistedRoomIdsRef = useRef<Set<string>>(new Set());
  const selectionLocked = workingLevelData.some(({ rooms }) => rooms.some(({ room, walls, openings }) => (selection?.type === 'room' && room.id === selection.id && room.isLocked) || (selection?.type === 'wall' && walls.some(({ id, isLocked }) => id === selection.id && isLocked)) || (selection?.type === 'opening' && openings.some(({ id, isLocked }) => id === selection.id && isLocked))));
  const allVertices = workingLevelData.flatMap(({ rooms }) => rooms.flatMap(({ vertices }) => vertices));
  const activeData = workingLevelData.find(({ level }) => level.id === activeLevelId);
  const hasUnsavedChanges = Object.keys(unsavedSnapshots).length > 0;
  const creationMessage = !creationMode
    ? ''
    : creationFirstPoint
    ? 'Premier angle placé. Cliquez sur l’angle opposé.'
    : 'Cliquez sur le plan pour placer le premier angle.';

  useEffect(() => {
    setSourceDirty('global-editor', hasUnsavedChanges);
    return () => setSourceDirty('global-editor', false);
  }, [hasUnsavedChanges, setSourceDirty]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setWorkingLevelData(levelData);
    }
  }, [levelData]);

  useEffect(() => {
    unsavedSnapshotsRef.current = unsavedSnapshots;
  }, [unsavedSnapshots]);

  useEffect(() => {
    persistedRoomIdsRef.current = new Set(levelData.flatMap((level) => level.rooms.map((snapshot) => snapshot.room.id)));
  }, [levelData]);

  const upsertLocalSnapshot = useCallback((snapshot: RoomSnapshot) => {
    setWorkingLevelData((current) => current.map((level) => {
      if (level.level.id !== snapshot.room.levelId) return level;
      const roomIndex = level.rooms.findIndex(({ room }) => room.id === snapshot.room.id);
      if (roomIndex < 0) return { ...level, rooms: [...level.rooms, snapshot] };
      const nextRooms = [...level.rooms];
      nextRooms[roomIndex] = snapshot;
      return { ...level, rooms: nextRooms };
    }));
    setUnsavedSnapshots((current) => ({ ...current, [snapshot.room.id]: snapshot }));
    setSaveStatus('dirty');
  }, []);

  const flushUnsavedChanges = useCallback(async (mode: 'auto' | 'manual' = 'auto') => {
    const snapshots = Object.values(unsavedSnapshotsRef.current);
    if (snapshots.length === 0 || access.readOnly) return;
    setSaveStatus('saving');
    setGeometryError('');
    try {
      const persistedByRoomId: Record<string, RoomSnapshot> = {};
      for (const snapshot of snapshots) {
        const alreadyPersisted = persistedRoomIdsRef.current.has(snapshot.room.id);
        const persisted = alreadyPersisted
          ? await updateRoomGeometry(snapshot)
          : await createRoomComplete(snapshot);
        persistedRoomIdsRef.current.add(snapshot.room.id);
        persistedByRoomId[persisted.room.id] = persisted;
      }
      setWorkingLevelData((current) => current.map((level) => ({
        ...level,
        rooms: level.rooms.map((roomSnapshot) => persistedByRoomId[roomSnapshot.room.id] ?? roomSnapshot),
      })));
      setUnsavedSnapshots({});
      setSaveStatus('synced');
    } catch (caught) {
      setSaveStatus('error');
      console.error('Échec de l’enregistrement automatique', caught);
    }
  }, [access.readOnly]);

  useEffect(() => {
    if (access.readOnly || !hasUnsavedChanges) return undefined;
    const interval = window.setInterval(() => {
      void flushUnsavedChanges();
    }, 300_000);
    return () => window.clearInterval(interval);
  }, [access.readOnly, flushUnsavedChanges, hasUnsavedChanges]);
  const createAtPoint = async (rawPoint: Point) => {
    if (!creationMode || !activeLevel || access.readOnly) return; const point = snapGlobalPoint(rawPoint, allVertices, null);
    if (!creationFirstPoint) { setCreationFirstPoint(point); setCreationPreviewPoint(point); return; }
    setGeometryError('');
    try {
      const roomId = crypto.randomUUID();
      const geometry = createRectangleRoomGeometryFromPoints(roomId, creationFirstPoint, point, { wallThicknessCm: preferences.defaultWallThicknessCm, wallHeightCm: preferences.defaultWallHeightCm });
      const created: RoomSnapshot = {
        room: {
          id: roomId,
          levelId: activeLevel.id,
          name: 'Nouvelle pièce',
          type: DEFAULT_ROOM_TYPE,
          floorColor: DEFAULT_ROOM_FLOOR_COLOR,
          notes: null,
          isSoftDeleted: false,
          isLocked: false,
        },
        vertices: geometry.vertices,
        walls: geometry.walls,
        openings: [],
      };
      upsertLocalSnapshot(created);
      setCreationFirstPoint(null);
      setCreationPreviewPoint(null);
      setCreationMode(false);
      select({ source: 'canvas', type: 'room', id: created.room.id, levelId: activeLevel.id });
    }
    catch (caught) { setGeometryError(message(caught)); }
  };
  const moveVertex = async (roomId: string, vertexId: string, rawPoint: Point) => {
    const snapshot = activeData?.rooms.find(({ room }) => room.id === roomId); if (!snapshot || access.readOnly || snapshot.room.isLocked) return;
    const point = snapGlobalPoint(rawPoint, allVertices, vertexId); const next: RoomSnapshot = { ...snapshot, vertices: updateVertexPosition(snapshot.vertices, vertexId, point.x, point.y) };
    const issue = validateRoomPolygon(next.vertices); if (issue) { setGeometryError(issue); return; }
    setGeometryError('');
    try {
      upsertLocalSnapshot(next);
      record({
        label: 'Déplacer un sommet',
        undo: async () => {
          upsertLocalSnapshot(snapshot);
        },
        redo: async () => {
          upsertLocalSnapshot(next);
        },
      });
    }
    catch (caught) { setGeometryError(`${message(caught)} La géométrie précédente a été conservée.`); }
  };
  const moveRoom = async (roomId: string, delta: Point) => {
    const snapshot = activeData?.rooms.find(({ room }) => room.id === roomId); if (!snapshot || access.readOnly || snapshot.room.isLocked || Math.hypot(delta.x, delta.y) < 1) return;
    const anchor = snapGlobalPoint({ x: snapshot.vertices[0].x + delta.x, y: snapshot.vertices[0].y + delta.y }, allVertices.filter(({ pieceId }) => pieceId !== roomId), null);
    const snappedDelta = { x: anchor.x - snapshot.vertices[0].x, y: anchor.y - snapshot.vertices[0].y }; const next = { ...snapshot, vertices: translateRoomVertices(snapshot.vertices, snappedDelta) };
    try {
      upsertLocalSnapshot(next);
      record({
        label: 'Déplacer une pièce',
        undo: async () => {
          upsertLocalSnapshot(snapshot);
        },
        redo: async () => {
          upsertLocalSnapshot(next);
        },
      });
    }
    catch (caught) { setGeometryError(`${message(caught)} La géométrie précédente a été conservée.`); }
  };
  return <DashboardLayout>
    <header className="global-editor__header">
      <div><p className="dashboard-eyebrow">Éditeur 2D global</p><h1 className="dashboard-pageTitle">{project?.name ?? 'Plan du projet'}</h1></div>
      <div className="dashboard-header__actions"><Button type="button" variant="default" disabled={access.readOnly || !hasUnsavedChanges || saveStatus === 'saving'} onClick={() => void flushUnsavedChanges('manual')}>{saveStatus === 'saving' ? 'Enregistrement…' : 'Sauvegarder'}</Button><Button type="button" className="dashboard-iconButton" disabled={access.readOnly || !canUndo} onClick={undo} aria-label="Annuler"><LuUndo2 aria-hidden /></Button><Button type="button" className="dashboard-iconButton" disabled={access.readOnly || !canRedo} onClick={redo} aria-label="Rétablir"><LuRedo2 aria-hidden /></Button></div>
    </header>
    {!loading && access.message ? <Alert color="orange" icon={<LuLock aria-hidden />} role="status">{access.message}</Alert> : null}
    {!loading && hasUnsavedChanges && saveStatus === 'error' ? <Alert color="red" role="status">Échec de l’enregistrement automatique. Nouvelle tentative dans 5 minutes.</Alert> : null}
    {selectionLocked ? <Alert color="yellow" icon={<LuLock aria-hidden />} role="status">L’élément sélectionné est verrouillé. Ses informations restent consultables, mais il ne peut pas être modifié.</Alert> : null}
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
      <EditorCreationPanel levels={levels} levelData={workingLevelData} activeLevelId={activeLevelId} readOnly={access.readOnly} selectionLocked={selectionLocked} creationMessage={creationMessage} onStartRoomCreation={() => { setCreationMode(true); setCreationFirstPoint(null); setCreationPreviewPoint(null); }} />
      <div className="global-editor__canvasArea">{loading ? <div className="dashboard-loading" aria-live="polite">Chargement du plan…</div> : !activeLevel ? <div className="dashboard-emptyState"><h2>Aucun niveau</h2><p>Le projet doit contenir au moins un niveau visible.</p></div> : <Canvas2D levels={workingLevelData} activeLevelId={activeLevel.id} visibleLevelIds={visibleLevelIds} viewportStateKey={`global:${project?.id ?? 'none'}`} options={options} selection={selection} onSelect={select} editingEnabled={!access.readOnly && !creationMode} creationActive={creationMode} creationFirstPoint={creationFirstPoint} creationPreviewPoint={creationPreviewPoint} onCanvasPoint={(point) => void createAtPoint(point)} onCanvasHover={(point) => setCreationPreviewPoint(point ? snapGlobalPoint(point, allVertices, null) : null)} onVertexMove={(roomId, vertexId, point) => void moveVertex(roomId, vertexId, point)} onRoomMove={(roomId, delta) => void moveRoom(roomId, delta)} />}</div>
      <EditorDetailPanel data={activeData} />
    </section>
  </DashboardLayout>;
}
