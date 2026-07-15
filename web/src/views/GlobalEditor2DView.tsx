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
import { linkCoincidentWalls, linkedVertexIds, moveLinkedVertex, moveRoomWithLinkedVertices, normalizeCreatedRoomOverlaps, reconcilePersistedRoomIds, type RoomGeometrySnapshot } from '../domain/roomOverlap';
import { hasSupabaseConfig } from '../lib/supabase';
import { listLevelsByProject } from '../services/levels';
import { canWriteProject, getProject } from '../services/projects';
import { createRoomComplete, loadLevelRoomSnapshots, replaceRoomGeometriesAtomically, type RoomSnapshot, updateRoomGeometry } from '../services/rooms';
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

function wallIdentitiesChanged(before: readonly RoomGeometrySnapshot[], after: readonly RoomGeometrySnapshot[]): boolean {
  const afterByRoomId = new Map(after.map((snapshot) => [snapshot.room.id, snapshot]));
  return before.some((snapshot) => {
    const next = afterByRoomId.get(snapshot.room.id);
    return !next
      || snapshot.walls.length !== next.walls.length
      || snapshot.walls.some((wall, index) => wall.id !== next.walls[index]?.id);
  });
}

async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    return operation();
  }
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
  const [editorSession, setEditorSession] = useState(0);
  const loadSequenceRef = useRef(0);
  const loadedProjectIdRef = useRef('');

  const load = async () => {
    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;
    if (!projectId) {
      loadedProjectIdRef.current = '';
      setProject(null); setLevels([]); setLevelData([]); setCanWrite(false); setActiveLevelId(''); setVisibleLevelIds([]); setLoading(false);
      return;
    }
    const preserveCurrentPlan = loadedProjectIdRef.current === projectId;
    setLoading(true);
    setError('');
    if (!preserveCurrentPlan) {
      setProject(null); setLevels([]); setLevelData([]); setCanWrite(false); setActiveLevelId(''); setVisibleLevelIds([]);
    }
    try {
      const [nextProject, nextLevels, writeAllowed] = await Promise.all([getProject(projectId), listLevelsByProject(projectId), canWriteProject(projectId)]);
      const nextData = await Promise.all(nextLevels.map(async (level): Promise<CanvasLevelData> => ({
        level,
        rooms: await retryOnce(() => loadLevelRoomSnapshots(level.id)),
      })));
      if (sequence !== loadSequenceRef.current) return;
      const initiallyVisible = nextLevels.filter(({ isVisible }) => isVisible).map(({ id }) => id);
      const fallbackVisible = initiallyVisible.length ? initiallyVisible : nextLevels[0] ? [nextLevels[0].id] : [];
      const nextActive = nextLevels.some(({ id }) => id === initialLevelId) ? initialLevelId : fallbackVisible[0] ?? '';
      loadedProjectIdRef.current = projectId;
      setProject(nextProject); setLevels(nextLevels); setLevelData(nextData); setVisibleLevelIds(fallbackVisible); setActiveLevelId(nextActive); setCanWrite(writeAllowed);
      if (nextActive && nextActive !== initialLevelId) onLevelChange?.(nextActive);
    } catch (caught) {
      if (sequence !== loadSequenceRef.current) return;
      setError(message(caught));
      if (!preserveCurrentPlan) { setProject(null); setLevels([]); setLevelData([]); }
    }
    finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (hasSupabaseConfig()) void load();
    return () => { loadSequenceRef.current += 1; };
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

  return <ActionHistoryProvider key={`${projectId}:${editorSession}`}><SelectionSyncBridge key={projectId} validObjects={validObjects} allowDraftObjects onLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }}><GlobalEditorContent project={project} levels={levels} levelData={levelData} activeLevelId={activeLevelId} visibleLevelIds={visibleLevelIds} options={options} loading={loading} error={error} access={getGlobalEditorAccess(canWrite)} onRetry={async () => { setEditorSession((current) => current + 1); await load(); }} onOptionsChange={setOptions} onToggleLevel={toggleLevel} onActiveLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }} /></SelectionSyncBridge></ActionHistoryProvider>;
}

interface GlobalEditorContentProps { project: Project | null; levels: Level[]; levelData: CanvasLevelData[]; activeLevelId: string; visibleLevelIds: string[]; options: CanvasDisplayOptions; loading: boolean; error: string; access: GlobalEditorAccess; onRetry(): Promise<void>; onOptionsChange(value: CanvasDisplayOptions): void; onToggleLevel(id: string, checked: boolean): void; onActiveLevelChange(id: string): void }

interface PendingTopology {
  levelId: string;
  replacedRoomIds: string[];
  resultRoomIds: string[];
}

export function GlobalEditorContent({ project, levels, levelData, activeLevelId, visibleLevelIds, options, loading, error, access, onRetry, onOptionsChange, onToggleLevel, onActiveLevelChange }: GlobalEditorContentProps) {
  const { setSourceDirty } = useUnsavedChanges();
  const { preferences } = usePreferences(); const { selection, select, clear: clearSelection } = useEditorSelection(); const { canUndo, canRedo, record, undo, redo } = useActionHistory(); const activeLevel = levels.find(({ id }) => id === activeLevelId) ?? null;
  const [workingLevelData, setWorkingLevelData] = useState(levelData);
  const [creationMode, setCreationMode] = useState(false); const [creationFirstPoint, setCreationFirstPoint] = useState<Point | null>(null); const [creationPreviewPoint, setCreationPreviewPoint] = useState<Point | null>(null); const [geometryError, setGeometryError] = useState('');
  const [unsavedSnapshots, setUnsavedSnapshots] = useState<Record<string, RoomSnapshot>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'synced' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const unsavedSnapshotsRef = useRef<Record<string, RoomSnapshot>>({});
  const pendingTopologiesRef = useRef<Map<string, PendingTopology>>(new Map());
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const persistedRoomIdsRef = useRef<Set<string>>(new Set(levelData.flatMap((level) => level.rooms.map((snapshot) => snapshot.room.id))));
  const previousLevelDataRef = useRef(levelData);
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
    if (previousLevelDataRef.current === levelData) return;
    previousLevelDataRef.current = levelData;
    if (!hasUnsavedChanges) setWorkingLevelData(levelData);
  }, [hasUnsavedChanges, levelData]);

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
    const nextUnsavedSnapshots = { ...unsavedSnapshotsRef.current, [snapshot.room.id]: snapshot };
    unsavedSnapshotsRef.current = nextUnsavedSnapshots;
    setUnsavedSnapshots(nextUnsavedSnapshots);
    setSaveStatus('dirty');
  }, []);

  const applyTopologyDraft = useCallback((levelId: string, removedRoomIds: string[], snapshots: RoomSnapshot[]) => {
    const removedIds = new Set(removedRoomIds);
    setWorkingLevelData((current) => current.map((level) => level.level.id !== levelId ? level : {
      ...level,
      rooms: [...level.rooms.filter(({ room }) => !removedIds.has(room.id)), ...snapshots],
    }));
    const nextUnsavedSnapshots = { ...unsavedSnapshotsRef.current };
    removedIds.forEach((id) => delete nextUnsavedSnapshots[id]);
    snapshots.forEach((snapshot) => { nextUnsavedSnapshots[snapshot.room.id] = snapshot; });
    unsavedSnapshotsRef.current = nextUnsavedSnapshots;
    setUnsavedSnapshots(nextUnsavedSnapshots);
    const previous = pendingTopologiesRef.current.get(levelId);
    pendingTopologiesRef.current.set(levelId, {
      levelId,
      replacedRoomIds: [...new Set([...(previous?.replacedRoomIds ?? []), ...removedRoomIds.filter((id) => persistedRoomIdsRef.current.has(id))])],
      resultRoomIds: [...new Set([...(previous?.resultRoomIds ?? []).filter((id) => !removedIds.has(id)), ...snapshots.map(({ room }) => room.id)])],
    });
    setSaveStatus('dirty');
  }, []);

  const completeLevelTopology = (removedRoomIds: string[], snapshots: readonly RoomGeometrySnapshot[], baseRooms = activeData?.rooms ?? []): RoomSnapshot[] => {
    if (baseRooms.some(({ room, walls }) => room.isLocked || walls.some(({ isLocked }) => isLocked))) {
      throw new Error('Le niveau contient une pièce ou un mur verrouillé. Déverrouillez-le avant une normalisation topologique.');
    }
    if (baseRooms.some(({ openings }) => openings.length > 0)) {
      throw new Error('Le niveau contient des ouvertures. Elles doivent être déplacées ou supprimées avant une normalisation topologique.');
    }
    const removed = new Set(removedRoomIds);
    return linkCoincidentWalls([
      ...baseRooms.filter(({ room }) => !removed.has(room.id)),
      ...snapshots,
    ]) as RoomSnapshot[];
  };

  const flushUnsavedChanges = useCallback(async (mode: 'auto' | 'manual' = 'auto') => {
    if (savePromiseRef.current) return savePromiseRef.current;
    const capturedByRoomId = { ...unsavedSnapshotsRef.current };
    const snapshots = Object.values(capturedByRoomId);
    if (snapshots.length === 0 || access.readOnly) return;
    const topologies = [...pendingTopologiesRef.current.values()].map((topology) => ({
      ...topology,
      replacedRoomIds: [...topology.replacedRoomIds],
      resultRoomIds: [...topology.resultRoomIds],
    }));
    const saveOperation = (async () => {
      setSaveStatus('saving');
      setSaveError('');
      setGeometryError('');
      try {
        const persistedByRoomId: Record<string, RoomSnapshot> = {};
        const topologyIds = new Set(topologies.flatMap(({ resultRoomIds }) => resultRoomIds));
        for (const topology of topologies) {
          const topologySnapshots = topology.resultRoomIds.map((id) => capturedByRoomId[id]).filter((snapshot): snapshot is RoomSnapshot => Boolean(snapshot));
          if (topologySnapshots.length !== topology.resultRoomIds.length) throw new Error('Le brouillon topologique est incomplet. Rechargez le plan avant de réessayer.');
          const persisted = await replaceRoomGeometriesAtomically(topology.levelId, topology.replacedRoomIds, topologySnapshots);
          persistedRoomIdsRef.current = reconcilePersistedRoomIds(
            persistedRoomIdsRef.current,
            topology.replacedRoomIds,
            persisted.map((snapshot) => snapshot.room.id),
          );
          persisted.forEach((snapshot) => {
            persistedByRoomId[snapshot.room.id] = snapshot;
          });
        }
        for (const snapshot of snapshots.filter(({ room }) => !topologyIds.has(room.id))) {
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
        pendingTopologiesRef.current.clear();
        unsavedSnapshotsRef.current = {};
        setUnsavedSnapshots({});
        setSaveStatus('synced');
      } catch (caught) {
        setSaveStatus('error');
        setSaveError(message(caught));
        console.error('Échec de l’enregistrement automatique', caught);
      }
    })();
    savePromiseRef.current = saveOperation;
    try {
      await saveOperation;
    } finally {
      if (savePromiseRef.current === saveOperation) savePromiseRef.current = null;
    }
  }, [access.readOnly]);

  useEffect(() => {
    if (access.readOnly || !hasUnsavedChanges) return undefined;
    const interval = window.setInterval(() => {
      void flushUnsavedChanges();
    }, 300_000);
    return () => window.clearInterval(interval);
  }, [access.readOnly, flushUnsavedChanges, hasUnsavedChanges]);
  const snapVertexPoint = (point: Point, roomId: string, vertexId: string) => {
    const linkedIds = linkedVertexIds(activeData?.rooms ?? [], roomId, vertexId);
    return snapGlobalPoint(point, allVertices.filter(({ id }) => !linkedIds.has(id)), null);
  };
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
      const normalized = normalizeCreatedRoomOverlaps(created, activeData?.rooms ?? []);
      if (normalized.overlapCount > 0) {
        const currentRoomIds = activeData?.rooms.map(({ room }) => room.id) ?? [];
        applyTopologyDraft(activeLevel.id, currentRoomIds, completeLevelTopology(normalized.replacedRoomIds, normalized.snapshots));
      } else {
        const currentRooms = activeData?.rooms ?? [];
        const combined = [...currentRooms, created];
        const linked = linkCoincidentWalls(combined) as RoomSnapshot[];
        if (wallIdentitiesChanged(combined, linked)) {
          const currentRoomIds = currentRooms.map(({ room }) => room.id);
          applyTopologyDraft(activeLevel.id, currentRoomIds, completeLevelTopology(currentRoomIds, linked));
        } else {
          upsertLocalSnapshot(created);
        }
      }
      setCreationFirstPoint(null);
      setCreationPreviewPoint(null);
      setCreationMode(false);
      const selectedRoom = normalized.snapshots.find(({ room }) => room.id === created.room.id) ?? normalized.snapshots.find(({ room }) => room.name === 'Zone de chevauchement') ?? created;
      select({ source: 'canvas', type: 'room', id: selectedRoom.room.id, levelId: activeLevel.id });
    }
    catch (caught) { setGeometryError(message(caught)); }
  };
  const moveVertex = async (roomId: string, vertexId: string, rawPoint: Point) => {
    const snapshot = activeData?.rooms.find(({ room }) => room.id === roomId); if (!snapshot || access.readOnly || snapshot.room.isLocked) return;
    const point = snapVertexPoint(rawPoint, roomId, vertexId);
    const movedSnapshots = moveLinkedVertex(activeData?.rooms ?? [], roomId, vertexId, point) as RoomSnapshot[];
    const changedSnapshots = movedSnapshots.filter((candidate, index) => candidate !== activeData?.rooms[index]);
    const linkedSnapshots = linkCoincidentWalls(movedSnapshots) as RoomSnapshot[];
    const identityChanged = wallIdentitiesChanged(movedSnapshots, linkedSnapshots);
    const issue = linkedSnapshots.map(({ vertices }) => validateRoomPolygon(vertices)).find(Boolean); if (issue) { setGeometryError(issue); return; }
    const before = activeData?.rooms.filter(({ room }) => changedSnapshots.some(({ room: changedRoom }) => changedRoom.id === room.id)) ?? [];
    setGeometryError('');
    try {
      if (identityChanged || changedSnapshots.length > 1) {
        const allBefore = activeData?.rooms ?? [];
        const currentRoomIds = allBefore.map(({ room }) => room.id);
        const after = completeLevelTopology(currentRoomIds, linkedSnapshots);
        applyTopologyDraft(activeLevelId, currentRoomIds, after);
        record({
          label: 'Déplacer un sommet mitoyen',
          undo: async () => applyTopologyDraft(activeLevelId, after.map(({ room }) => room.id), allBefore),
          redo: async () => applyTopologyDraft(activeLevelId, allBefore.map(({ room }) => room.id), after),
        });
        return;
      }
      changedSnapshots.forEach(upsertLocalSnapshot);
      record({
        label: 'Déplacer un sommet',
        undo: async () => {
          before.forEach(upsertLocalSnapshot);
        },
        redo: async () => {
          changedSnapshots.forEach(upsertLocalSnapshot);
        },
      });
    }
    catch (caught) { setGeometryError(`${message(caught)} La géométrie précédente a été conservée.`); }
  };
  const normalizeMovedRoom = (roomId: string) => {
    const snapshot = activeData?.rooms.find(({ room }) => room.id === roomId);
    if (!snapshot || !activeLevel) return;
    try {
      const normalized = normalizeCreatedRoomOverlaps(snapshot, activeData?.rooms.filter(({ room }) => room.id !== roomId) ?? []);
      if (normalized.overlapCount === 0) return;
      const removedRoomIds = activeData?.rooms.map(({ room }) => room.id) ?? [];
      const before = activeData?.rooms ?? [];
      const after = completeLevelTopology([roomId, ...normalized.replacedRoomIds], normalized.snapshots);
      applyTopologyDraft(activeLevel.id, removedRoomIds, after);
      record({
        label: 'Normaliser le chevauchement',
        undo: async () => applyTopologyDraft(activeLevel.id, after.map(({ room }) => room.id), before),
        redo: async () => applyTopologyDraft(activeLevel.id, before.map(({ room }) => room.id), after),
      });
      const selectedRoom = normalized.snapshots.find(({ room }) => room.id === roomId) ?? normalized.snapshots.find(({ room }) => room.name === 'Zone de chevauchement');
      if (selectedRoom) select({ source: 'canvas', type: 'room', id: selectedRoom.room.id, levelId: activeLevel.id });
    } catch (caught) {
      setGeometryError(message(caught));
    }
  };
  const moveRoom = async (roomId: string, delta: Point) => {
    const snapshot = activeData?.rooms.find(({ room }) => room.id === roomId); if (!snapshot || access.readOnly || snapshot.room.isLocked || Math.hypot(delta.x, delta.y) < 1) return;
    const linkedRoomVertexIds = new Set(snapshot.vertices.flatMap((vertex) => [...linkedVertexIds(activeData?.rooms ?? [], roomId, vertex.id)]));
    const anchor = snapGlobalPoint({ x: snapshot.vertices[0].x + delta.x, y: snapshot.vertices[0].y + delta.y }, allVertices.filter(({ pieceId, id }) => pieceId !== roomId && !linkedRoomVertexIds.has(id)), null);
    const snappedDelta = { x: anchor.x - snapshot.vertices[0].x, y: anchor.y - snapshot.vertices[0].y };
    const movedSnapshots = moveRoomWithLinkedVertices(activeData?.rooms ?? [], roomId, snappedDelta) as RoomSnapshot[];
    const changedSnapshots = movedSnapshots.filter((candidate, index) => candidate !== activeData?.rooms[index]);
    const next = movedSnapshots.find(({ room }) => room.id === roomId) ?? { ...snapshot, vertices: translateRoomVertices(snapshot.vertices, snappedDelta) };
    try {
      const issue = changedSnapshots.map(({ vertices }) => validateRoomPolygon(vertices)).find(Boolean);
      if (issue) { setGeometryError(issue); return; }
      const normalized = normalizeCreatedRoomOverlaps(next, movedSnapshots.filter(({ room }) => room.id !== roomId));
      if (normalized.overlapCount > 0) {
        const removedRoomIds = activeData?.rooms.map(({ room }) => room.id) ?? [];
        const before = activeData?.rooms ?? [];
        const after = completeLevelTopology([roomId, ...normalized.replacedRoomIds], normalized.snapshots, movedSnapshots);
        applyTopologyDraft(activeLevelId, removedRoomIds, after);
        record({
          label: 'Déplacer une pièce et normaliser le chevauchement',
          undo: async () => applyTopologyDraft(activeLevelId, after.map(({ room }) => room.id), before),
          redo: async () => applyTopologyDraft(activeLevelId, before.map(({ room }) => room.id), after),
        });
        return;
      }
      const linkedSnapshots = linkCoincidentWalls(movedSnapshots) as RoomSnapshot[];
      const identityChanged = wallIdentitiesChanged(movedSnapshots, linkedSnapshots);
      if (identityChanged || changedSnapshots.length > 1) {
        const before = activeData?.rooms ?? [];
        const currentRoomIds = before.map(({ room }) => room.id);
        const after = completeLevelTopology(currentRoomIds, linkedSnapshots);
        applyTopologyDraft(activeLevelId, currentRoomIds, after);
        record({
          label: 'Déplacer une pièce mitoyenne',
          undo: async () => applyTopologyDraft(activeLevelId, after.map(({ room }) => room.id), before),
          redo: async () => applyTopologyDraft(activeLevelId, before.map(({ room }) => room.id), after),
        });
        return;
      }
      changedSnapshots.forEach(upsertLocalSnapshot);
      record({
        label: 'Déplacer une pièce',
        undo: async () => {
          (activeData?.rooms.filter(({ room }) => changedSnapshots.some(({ room: changedRoom }) => changedRoom.id === room.id)) ?? []).forEach(upsertLocalSnapshot);
        },
        redo: async () => {
          changedSnapshots.forEach(upsertLocalSnapshot);
        },
      });
    }
    catch (caught) { setGeometryError(`${message(caught)} La géométrie précédente a été conservée.`); }
  };
  const discardDraftAndReload = async () => {
    if (savePromiseRef.current) await savePromiseRef.current;
    pendingTopologiesRef.current.clear();
    unsavedSnapshotsRef.current = {};
    setUnsavedSnapshots({});
    setWorkingLevelData(levelData);
    setSaveStatus('idle');
    setSaveError('');
    setGeometryError('');
    setCreationMode(false);
    setCreationFirstPoint(null);
    setCreationPreviewPoint(null);
    clearSelection();
    await onRetry();
  };
  return <DashboardLayout>
    <header className="global-editor__header">
      <div><p className="dashboard-eyebrow">Éditeur 2D global</p><h1 className="dashboard-pageTitle">{project?.name ?? 'Plan du projet'}</h1></div>
      <div className="dashboard-header__actions"><Button type="button" variant="default" disabled={access.readOnly || !hasUnsavedChanges || saveStatus === 'saving'} onClick={() => void flushUnsavedChanges('manual')}>{saveStatus === 'saving' ? 'Enregistrement…' : 'Sauvegarder'}</Button><Button type="button" className="dashboard-iconButton" disabled={access.readOnly || !canUndo} onClick={undo} aria-label="Annuler"><LuUndo2 aria-hidden /></Button><Button type="button" className="dashboard-iconButton" disabled={access.readOnly || !canRedo} onClick={redo} aria-label="Rétablir"><LuRedo2 aria-hidden /></Button></div>
    </header>
    {!loading && access.message ? <Alert color="orange" icon={<LuLock aria-hidden />} role="status">{access.message}</Alert> : null}
    {!loading && hasUnsavedChanges && saveStatus === 'error' ? <Alert color="red" role="status">Échec de l’enregistrement automatique{saveError ? ` : ${saveError}` : '.'} <Button type="button" variant="subtle" color="red" onClick={() => void discardDraftAndReload()}>Abandonner le brouillon et recharger</Button></Alert> : null}
    {selectionLocked ? <Alert color="yellow" icon={<LuLock aria-hidden />} role="status">L’élément sélectionné est verrouillé. Ses informations restent consultables, mais il ne peut pas être modifié.</Alert> : null}
    {geometryError ? <div className="dashboard-banner dashboard-banner--error" role="alert">{geometryError}</div> : null}
    {error ? <div className="dashboard-banner dashboard-banner--error" role="alert">{error}<Button type="button" onClick={() => void discardDraftAndReload()}>Abandonner le brouillon et recharger</Button></div> : null}
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
      <EditorCreationPanel levels={levels} levelData={workingLevelData} activeLevelId={activeLevelId} readOnly={access.readOnly || saveStatus === 'saving'} selectionLocked={selectionLocked} creationMessage={creationMessage} onStartRoomCreation={() => { setCreationMode(true); setCreationFirstPoint(null); setCreationPreviewPoint(null); }} />
      <div className="global-editor__canvasArea">{loading && !activeLevel ? <div className="dashboard-loading" aria-live="polite">Chargement du plan…</div> : !activeLevel ? <div className="dashboard-emptyState"><h2>Aucun niveau</h2><p>Le projet doit contenir au moins un niveau visible.</p></div> : <Canvas2D levels={workingLevelData} activeLevelId={activeLevel.id} visibleLevelIds={visibleLevelIds} viewportStateKey={`global:${project?.id ?? 'none'}`} options={options} selection={selection} onSelect={select} editingEnabled={!access.readOnly && !creationMode && saveStatus !== 'saving'} creationActive={creationMode} creationFirstPoint={creationFirstPoint} creationPreviewPoint={creationPreviewPoint} onCanvasPoint={(point) => void createAtPoint(point)} onCanvasHover={(point) => setCreationPreviewPoint(point ? snapGlobalPoint(point, allVertices, null) : null)} snapPoint={snapVertexPoint} onVertexMove={(roomId, vertexId, point) => void moveVertex(roomId, vertexId, point)} onVertexMoveEnd={(roomId) => normalizeMovedRoom(roomId)} onRoomMove={(roomId, delta) => void moveRoom(roomId, delta)} />}</div>
      <EditorDetailPanel data={activeData} />
    </section>
  </DashboardLayout>;
}
