import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Menu, NativeSelect } from '@mantine/core';
import { LuLock, LuMagnet, LuRedo2, LuUndo2 } from 'react-icons/lu';
import {
  Canvas2D, CanvasDisplayOptionsMenu, CanvasSnappingOptionsMenu, DEFAULT_CANVAS_DISPLAY_OPTIONS,
  type CanvasDisplayOptions, type CanvasLevelData,
} from '../components/Canvas2D';
import { DashboardLayout } from '../components/DashboardLayout';
import { ActionHistoryProvider, useActionHistory } from '../components/ActionHistory';
import { EditorCreationPanel, EditorDetailPanel } from '../components/EditorPanels';
import { SelectionSyncBridge, useEditorSelection } from '../components/SelectionSyncBridge';
import { usePreferences } from '../components/PreferencesContext';
import { useEditorAutosave } from '../components/useEditorAutosave';
import { getGlobalEditorAccess, type GlobalEditorAccess } from '../domain/globalEditorAccess';
import type { DimensionReference, EditorDimension, EditorNote, Level, Opening, Point, Project, Room, Wall } from '../domain/types';
import { polygonSnapSegments, snapEditorPointWithGuides, translateRoomVertices, validateRoomPolygon } from '../domain/globalGeometry';
import { assertLockedGeometryPreserved, deleteRoomVertex, linkCoincidentWalls, linkedVertexIds, moveLinkedVertex, moveRoomWithLinkedVertices, normalizeCreatedRoomOverlaps, type RoomGeometrySnapshot } from '../domain/roomOverlap';
import { hasSupabaseConfig } from '../lib/supabase';
import { createLevel, listLevelsByProject, softDeleteLevel, updateLevel } from '../services/levels';
import { canWriteProject, getProject } from '../services/projects';
import {
  loadLevelGeometrySnapshot,
  saveLevelRoomSnapshots,
  buildLevelGeometrySnapshot,
  projectCanonicalRoomSnapshots,
  type RoomSnapshot,
} from '../services/rooms';
import { DEFAULT_ROOM_FLOOR_COLOR, DEFAULT_ROOM_TYPE } from '../domain/room';
import { createOpeningFromTemplate } from '../domain/opening';
import { centroid, createRectangleRoomGeometryFromPoints } from '../domain/geometry';
import {
  supabaseViewSettingsGateway,
  type ViewSettingsGateway,
} from '../data/supabase/viewSettings';
import { assertOpeningValidInLevel, setSharedVertexLock } from '../domain/editorGeometry';
import { roomLockState, wallLockState } from '../domain/manualLock';
import { detachWallEndpoint, moveDetachedVertex, reconnectDetachedVertex, splitWallInRooms } from '../domain/editorWallActions';
import type { EditorSelection } from '../domain/editorSelection';
import { DEFAULT_PROJECT_VIEW_SETTINGS, type CanvasSnappingOptions } from '../domain/viewSettings';
import { deleteDimension, deleteNote, listDimensions, listNotes, saveDimension, saveNote } from '../services/editorObjects';

interface GlobalEditor2DViewProps {
  projectId: string;
  initialLevelId?: string;
  onLevelChange?(levelId: string): void;
  viewSettingsGateway?: ViewSettingsGateway;
  onOpenWall?(wallId: string, levelId: string): void;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Le plan n’a pas pu être chargé.';
}

function topologyIdentitiesChanged(before: readonly RoomGeometrySnapshot[], after: readonly RoomGeometrySnapshot[]): boolean {
  const afterByRoomId = new Map(after.map((snapshot) => [snapshot.room.id, snapshot]));
  return before.some((snapshot) => {
    const next = afterByRoomId.get(snapshot.room.id);
    return !next
      || snapshot.vertices.length !== next.vertices.length
      || snapshot.vertices.some((vertex, index) => vertex.id !== next.vertices[index]?.id)
      || snapshot.walls.length !== next.walls.length
      || snapshot.walls.some((wall, index) => wall.id !== next.walls[index]?.id);
  });
}

function sameRoomDraft(before: readonly RoomSnapshot[], after: readonly RoomSnapshot[]): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    return operation();
  }
}

function dimensionPoint(reference: DimensionReference, rooms: readonly RoomSnapshot[]): Point | null {
  if (reference.type === 'point' && Number.isFinite(reference.x) && Number.isFinite(reference.y)) return { x: reference.x!, y: reference.y! };
  if (reference.type === 'vertex' && reference.id) return rooms.flatMap(({ vertices }) => vertices).find(({ id }) => id === reference.id) ?? null;
  if (reference.type === 'wall' && reference.id) {
    const owner = rooms.find(({ walls }) => walls.some(({ id }) => id === reference.id));
    const wall = owner?.walls.find(({ id }) => id === reference.id);
    const start = owner?.vertices.find(({ id }) => id === wall?.startVertexId);
    const end = owner?.vertices.find(({ id }) => id === wall?.endVertexId);
    if (start && end) return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  }
  return null;
}

function projectDimension(dimension: EditorDimension, rooms: readonly RoomSnapshot[]) {
  const start = dimensionPoint(dimension.referenceA, rooms);
  const end = dimensionPoint(dimension.referenceB, rooms);
  return start && end ? { id: dimension.id, levelId: dimension.levelId, start, end, label: dimension.name, type: dimension.type, offsetCm: dimension.offsetCm } : null;
}

function projectNote(note: EditorNote, levels: readonly CanvasLevelData[]): { levelId: string; position: Point } | null {
  const firstLevel = levels[0];
  if (!firstLevel) return null;
  if (note.originType === 'projet' || !note.originId) return { levelId: firstLevel.level.id, position: { x: 0, y: 0 } };
  if (note.originType === 'niveau') {
    const level = levels.find(({ level: candidate }) => candidate.id === note.originId);
    return level ? { levelId: level.level.id, position: { x: 0, y: 0 } } : null;
  }
  for (const level of levels) {
    const room = level.rooms.find(({ room: candidate }) => candidate.id === note.originId);
    if (room) return { levelId: level.level.id, position: centroid(room.vertices) };
    const wallOwner = level.rooms.find(({ walls }) => walls.some(({ id }) => id === note.originId));
    const wall = wallOwner?.walls.find(({ id }) => id === note.originId);
    if (wall && wallOwner) {
      const start = wallOwner.vertices.find(({ id }) => id === wall.startVertexId)!;
      const end = wallOwner.vertices.find(({ id }) => id === wall.endVertexId)!;
      return { levelId: level.level.id, position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } };
    }
    const openingOwner = level.rooms.find(({ openings }) => openings.some(({ id }) => id === note.originId));
    if (openingOwner) return { levelId: level.level.id, position: centroid(openingOwner.vertices) };
    const vertex = level.rooms.flatMap(({ vertices }) => vertices).find(({ id }) => id === note.originId);
    if (vertex) return { levelId: level.level.id, position: vertex };
  }
  return { levelId: firstLevel.level.id, position: { x: 0, y: 0 } };
}

function projectDetachedWalls(canonical: NonNullable<CanvasLevelData['canonical']>): NonNullable<CanvasLevelData['detachedWalls']> {
  return canonical.walls.filter(({ pieceIds }) => pieceIds.length === 0).map((wall) => ({
    id: wall.id,
    wall: { ...wall, pieceId: '', heightProfiles: canonical.profilesByWallId[wall.id] },
    start: canonical.vertices.find(({ id }) => id === wall.startVertexId)!,
    end: canonical.vertices.find(({ id }) => id === wall.endVertexId)!,
  }));
}

export function GlobalEditor2DView({
  projectId,
  initialLevelId = '',
  onLevelChange,
  viewSettingsGateway = supabaseViewSettingsGateway,
  onOpenWall,
}: GlobalEditor2DViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [levelData, setLevelData] = useState<CanvasLevelData[]>([]);
  const [activeLevelId, setActiveLevelId] = useState(initialLevelId);
  const [visibleLevelIds, setVisibleLevelIds] = useState<string[]>([]);
  const [options, setOptions] = useState<CanvasDisplayOptions>(DEFAULT_CANVAS_DISPLAY_OPTIONS);
  const [snapping, setSnapping] = useState<CanvasSnappingOptions>(DEFAULT_PROJECT_VIEW_SETTINGS.snapping);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState('');
  const [viewSettingsError, setViewSettingsError] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const loadSequenceRef = useRef(0);
  const loadedProjectIdRef = useRef('');
  const viewSettingsSaveRef = useRef<Promise<void>>(Promise.resolve());

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
    setViewSettingsError('');
    if (!preserveCurrentPlan) {
      setProject(null); setLevels([]); setLevelData([]); setCanWrite(false); setActiveLevelId(''); setVisibleLevelIds([]); setOptions(DEFAULT_CANVAS_DISPLAY_OPTIONS); setSnapping(DEFAULT_PROJECT_VIEW_SETTINGS.snapping);
    }
    try {
      const settingsResult = viewSettingsGateway.load(projectId)
        .then((value) => ({ value, failed: false as const }))
        .catch(() => ({ value: null, failed: true as const }));
      const [nextProject, nextLevels, writeAllowed, notes] = await Promise.all([getProject(projectId), listLevelsByProject(projectId), canWriteProject(projectId), listNotes(projectId)]);
      const nextData = await Promise.all(nextLevels.map(async (level): Promise<CanvasLevelData> => {
        const [geometry, dimensions] = await Promise.all([
          retryOnce(() => loadLevelGeometrySnapshot(level.id)),
          listDimensions(level.id),
        ]);
        return {
          level,
          rooms: geometry.rooms,
          geometryRevision: geometry.revision,
          canonical: geometry.canonical,
          detachedWalls: geometry.canonical ? projectDetachedWalls(geometry.canonical) : [],
          dimensions: dimensions.map((dimension) => projectDimension(dimension, geometry.rooms)).filter((value): value is NonNullable<typeof value> => Boolean(value)),
        };
      }));
      for (const note of notes) {
        const projection = projectNote(note, nextData);
        const target = nextData.find(({ level }) => level.id === projection?.levelId);
        if (target && projection) {
          target.notes = [...(target.notes ?? []), { id: note.id, levelId: projection.levelId, position: projection.position, text: note.text, originType: note.originType, originId: note.originId }];
        }
      }
      if (sequence !== loadSequenceRef.current) return;
      const initiallyVisible = nextLevels.filter(({ isVisible }) => isVisible).map(({ id }) => id);
      const fallbackVisible = initiallyVisible.length ? initiallyVisible : nextLevels[0] ? [nextLevels[0].id] : [];
      const nextActive = nextLevels.some(({ id }) => id === initialLevelId) ? initialLevelId : fallbackVisible[0] ?? '';
      const loadedSettings = await settingsResult;
      loadedProjectIdRef.current = projectId;
      setProject(nextProject); setLevels(nextLevels); setLevelData(nextData); setVisibleLevelIds(fallbackVisible); setActiveLevelId(nextActive); setCanWrite(writeAllowed);
      if (loadedSettings.failed) setViewSettingsError('Les options de vue n’ont pas pu être relues. Les valeurs par défaut sont utilisées.');
      else { setOptions(loadedSettings.value.display); setSnapping(loadedSettings.value.snapping); }
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

  const changeOptions = (nextOptions: CanvasDisplayOptions) => {
    setOptions(nextOptions);
    setViewSettingsError('');
    viewSettingsSaveRef.current = viewSettingsSaveRef.current
      .catch(() => undefined)
      .then(() => viewSettingsGateway.saveDisplayOptions(projectId, nextOptions))
      .catch(() => {
        setViewSettingsError('Les options d’affichage n’ont pas pu être enregistrées.');
      });
  };

  const changeSnapping = (nextSnapping: CanvasSnappingOptions) => {
    setSnapping(nextSnapping);
    setViewSettingsError('');
    viewSettingsSaveRef.current = viewSettingsSaveRef.current
      .catch(() => undefined)
      .then(() => viewSettingsGateway.saveSnappingOptions(projectId, nextSnapping))
      .catch(() => {
        setViewSettingsError('Les options de magnétisme n’ont pas pu être enregistrées.');
      });
  };

  const activeLevel = useMemo(() => levels.find(({ id }) => id === activeLevelId) ?? null, [activeLevelId, levels]);
  const validObjects = useMemo(() => new Set(levelData.flatMap(({ level, rooms, detachedWalls = [], notes = [], dimensions = [] }) => [
    `level:${level.id}`,
    ...rooms.flatMap(({ room, walls, openings }) => [`room:${room.id}`, ...walls.map(({ id }) => `wall:${id}`), ...openings.map(({ id }) => `opening:${id}`)]),
    ...detachedWalls.map(({ id }) => `wall:${id}`),
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

  return <ActionHistoryProvider key={`${projectId}:${editorSession}`}><SelectionSyncBridge key={projectId} validObjects={validObjects} allowDraftObjects onLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }}><GlobalEditorContent project={project} levels={levels} levelData={levelData} activeLevelId={activeLevelId} visibleLevelIds={visibleLevelIds} options={options} snapping={snapping} loading={loading} error={error} viewSettingsError={viewSettingsError} access={getGlobalEditorAccess(canWrite)} onRetry={async () => { setEditorSession((current) => current + 1); await load(); }} onOptionsChange={changeOptions} onSnappingChange={changeSnapping} onToggleLevel={toggleLevel} onActiveLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }} onOpenWall={onOpenWall} onCreateLevel={async (name, number) => { await createLevel({ projectId, name, number, isVisible: true }); await load(); }} onUpdateLevel={async (level) => { await updateLevel(level); await load(); }} onDeleteLevel={async (level) => { await softDeleteLevel(level); await load(); }} onSaveDimension={async (dimension) => { await saveDimension(dimension); await load(); }} onDeleteDimension={async (id) => { await deleteDimension(id); await load(); }} onSaveNote={async (note) => { await saveNote(note); await load(); }} onDeleteNote={async (id) => { await deleteNote(id); await load(); }} /></SelectionSyncBridge></ActionHistoryProvider>;
}

interface GlobalEditorContentProps { project: Project | null; levels: Level[]; levelData: CanvasLevelData[]; activeLevelId: string; visibleLevelIds: string[]; options: CanvasDisplayOptions; snapping?: CanvasSnappingOptions; loading: boolean; error: string; viewSettingsError?: string; access: GlobalEditorAccess; onRetry(): Promise<void>; onOptionsChange(value: CanvasDisplayOptions): void; onSnappingChange?(value: CanvasSnappingOptions): void; onToggleLevel(id: string, checked: boolean): void; onActiveLevelChange(id: string): void; onOpenWall?(wallId: string, levelId: string): void; onCreateLevel?(name: string, number: number): Promise<void>; onUpdateLevel?(level: Level): Promise<void>; onDeleteLevel?(level: Level): Promise<void>; onSaveDimension?(dimension: EditorDimension): Promise<void>; onDeleteDimension?(id: string): Promise<void>; onSaveNote?(note: EditorNote): Promise<void>; onDeleteNote?(id: string): Promise<void> }

interface PendingTopology {
  levelId: string;
  replacedRoomIds: string[];
  resultRoomIds: string[];
}

type EditorInteraction =
  | { type: 'split-wall'; wallId: string }
  | { type: 'detach-wall'; wallId: string; vertexId?: string }
  | { type: 'reposition-dimension'; dimensionId: string }
  | { type: 'change-note-origin'; noteId: string };

export function GlobalEditorContent({ project, levels, levelData, activeLevelId, visibleLevelIds, options, snapping = DEFAULT_PROJECT_VIEW_SETTINGS.snapping, loading, error, viewSettingsError = '', access, onRetry, onOptionsChange, onSnappingChange, onToggleLevel, onActiveLevelChange, onOpenWall, onCreateLevel, onUpdateLevel, onDeleteLevel, onSaveDimension, onDeleteDimension, onSaveNote, onDeleteNote }: GlobalEditorContentProps) {
  const { preferences } = usePreferences(); const { selection, select, clear: clearSelection } = useEditorSelection(); const { canUndo, canRedo, record, undo, redo } = useActionHistory(); const activeLevel = levels.find(({ id }) => id === activeLevelId) ?? null;
  const [workingLevelData, setWorkingLevelData] = useState(levelData);
  const [creationMode, setCreationMode] = useState(false); const [creationFirstPoint, setCreationFirstPoint] = useState<Point | null>(null); const [creationPreviewPoint, setCreationPreviewPoint] = useState<Point | null>(null); const [geometryError, setGeometryError] = useState('');
  const [interaction, setInteraction] = useState<EditorInteraction | null>(null);
  const [panelDismissKey, setPanelDismissKey] = useState(0);
  const [unsavedSnapshots, setUnsavedSnapshots] = useState<Record<string, RoomSnapshot>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'synced' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const unsavedSnapshotsRef = useRef<Record<string, RoomSnapshot>>({});
  const pendingTopologiesRef = useRef<Map<string, PendingTopology>>(new Map());
  const canonicalDirtyLevelIdsRef = useRef<Set<string>>(new Set());
  const interactionObjectHandledRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const workingLevelDataRef = useRef(levelData);
  const previousLevelDataRef = useRef(levelData);
  const vertexMoveRef = useRef<{
    levelId: string;
    roomId: string;
    vertexId: string;
    before: RoomSnapshot[];
  } | null>(null);
  const detachedVertexMoveRef = useRef<{ vertexId: string; before: NonNullable<CanvasLevelData['canonical']> } | null>(null);
  const selectionLocked = workingLevelData.some(({ rooms }) => rooms.some(({ room, vertices, walls }) => (
    (selection?.type === 'room' && room.id === selection.id && roomLockState(vertices))
    || (selection?.type === 'wall' && walls.some((wall) => (
      wall.id === selection.id && wallLockState(wall, vertices)
    )))
  )));
  const allVertices = workingLevelData.flatMap(({ rooms }) => rooms.flatMap(({ vertices }) => vertices));
  const activeData = workingLevelData.find(({ level }) => level.id === activeLevelId);
  const snapSegments = activeData?.rooms.flatMap(({ vertices }) => polygonSnapSegments(vertices)) ?? [];
  const canonicalVertices = activeData?.canonical?.vertices ?? [];
  const canonicalVerticesById = new Map(canonicalVertices.map((vertex) => [vertex.id, vertex]));
  const canonicalSegments = activeData?.canonical?.walls.flatMap((wall) => {
    const start = canonicalVerticesById.get(wall.startVertexId);
    const end = canonicalVerticesById.get(wall.endVertexId);
    return start && end ? [{ start, end }] : [];
  }) ?? [];
  const snapConfiguredResult = (point: Point, excludedVertexIds = new Set<string>()) => snapEditorPointWithGuides(
    point,
    allVertices.filter(({ id }) => !excludedVertexIds.has(id)),
    snapSegments.filter(({ start, end }) => (
      !excludedVertexIds.has((start as { id?: string }).id ?? '') && !excludedVertexIds.has((end as { id?: string }).id ?? '')
    )),
    snapping,
  );
  const snapConfiguredPoint = (point: Point, excludedVertexIds = new Set<string>()) => (
    snapConfiguredResult(point, excludedVertexIds).point
  );
  const snapDetachedVertexResult = (point: Point, vertexId: string) => snapEditorPointWithGuides(
    point,
    canonicalVertices.filter(({ id }) => id !== vertexId),
    canonicalSegments.filter(({ start, end }) => start.id !== vertexId && end.id !== vertexId),
    snapping,
  );
  const hasUnsavedChanges = Object.keys(unsavedSnapshots).length > 0 || saveStatus === 'dirty' || saveStatus === 'error';
  const creationMessage = !creationMode
    ? ''
    : creationFirstPoint
    ? 'Premier angle placé. Cliquez sur l’angle opposé.'
    : 'Cliquez sur le plan pour placer le premier angle.';
  const interactionMessage = interaction?.type === 'split-wall'
    ? 'Cliquez sur le mur à l’emplacement de la coupe.'
    : interaction?.type === 'detach-wall'
      ? interaction.vertexId ? 'Cliquez sur la nouvelle position de l’extrémité.' : 'Cliquez près de l’extrémité à déplacer.'
      : interaction?.type === 'reposition-dimension'
        ? 'Cliquez pour définir le nouveau décalage de la côte.'
        : interaction?.type === 'change-note-origin'
          ? 'Cliquez sur la nouvelle origine, ou sur le fond pour rattacher la note au projet.'
          : '';

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (!interaction && !creationMode)) return;
      setInteraction(null);
      setCreationMode(false);
      setCreationFirstPoint(null);
      setCreationPreviewPoint(null);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [creationMode, interaction]);

  useEffect(() => {
    if (previousLevelDataRef.current === levelData) return;
    previousLevelDataRef.current = levelData;
    if (!hasUnsavedChanges) setWorkingLevelData(levelData);
  }, [hasUnsavedChanges, levelData]);

  useEffect(() => {
    unsavedSnapshotsRef.current = unsavedSnapshots;
  }, [unsavedSnapshots]);

  useEffect(() => {
    workingLevelDataRef.current = workingLevelData;
  }, [workingLevelData]);

  const upsertLocalSnapshot = useCallback((snapshot: RoomSnapshot) => {
    const nextWorkingLevelData = workingLevelDataRef.current.map((level) => {
      if (level.level.id !== snapshot.room.levelId) return level;
      const roomIndex = level.rooms.findIndex(({ room }) => room.id === snapshot.room.id);
      const nextRooms = roomIndex < 0
        ? [...level.rooms, snapshot]
        : level.rooms.map((candidate, index) => index === roomIndex ? snapshot : candidate);
      const canonical = buildLevelGeometrySnapshot(level.level.id, level.geometryRevision ?? 0, nextRooms, level.canonical);
      return { ...level, rooms: nextRooms, canonical, detachedWalls: projectDetachedWalls(canonical) };
    });
    workingLevelDataRef.current = nextWorkingLevelData;
    setWorkingLevelData(nextWorkingLevelData);
    const nextUnsavedSnapshots = { ...unsavedSnapshotsRef.current, [snapshot.room.id]: snapshot };
    unsavedSnapshotsRef.current = nextUnsavedSnapshots;
    setUnsavedSnapshots(nextUnsavedSnapshots);
    setSaveStatus('dirty');
  }, []);

  const previewTopologyDraft = useCallback((levelId: string, removedRoomIds: string[], snapshots: RoomSnapshot[]) => {
    const removedIds = new Set(removedRoomIds);
    const nextWorkingLevelData = workingLevelDataRef.current.map((level) => {
      if (level.level.id !== levelId) return level;
      const rooms = [...level.rooms.filter(({ room }) => !removedIds.has(room.id)), ...snapshots];
      const canonical = buildLevelGeometrySnapshot(levelId, level.geometryRevision ?? 0, rooms, level.canonical);
      return { ...level, rooms, canonical, detachedWalls: projectDetachedWalls(canonical) };
    });
    workingLevelDataRef.current = nextWorkingLevelData;
    setWorkingLevelData(nextWorkingLevelData);
  }, []);

  const applyTopologyDraft = useCallback((levelId: string, removedRoomIds: string[], snapshots: RoomSnapshot[]) => {
    previewTopologyDraft(levelId, removedRoomIds, snapshots);
    const removedIds = new Set(removedRoomIds);
    const nextUnsavedSnapshots = { ...unsavedSnapshotsRef.current };
    removedIds.forEach((id) => delete nextUnsavedSnapshots[id]);
    snapshots.forEach((snapshot) => { nextUnsavedSnapshots[snapshot.room.id] = snapshot; });
    unsavedSnapshotsRef.current = nextUnsavedSnapshots;
    setUnsavedSnapshots(nextUnsavedSnapshots);
    const previous = pendingTopologiesRef.current.get(levelId);
    pendingTopologiesRef.current.set(levelId, {
      levelId,
      replacedRoomIds: [...new Set([...(previous?.replacedRoomIds ?? []), ...removedRoomIds])],
      resultRoomIds: [...new Set([...(previous?.resultRoomIds ?? []).filter((id) => !removedIds.has(id)), ...snapshots.map(({ room }) => room.id)])],
    });
    setSaveStatus('dirty');
  }, [previewTopologyDraft]);

  const completeLevelTopology = (removedRoomIds: string[], snapshots: readonly RoomGeometrySnapshot[], baseRooms = activeData?.rooms ?? []): RoomSnapshot[] => {
    const removed = new Set(removedRoomIds);
    const completed = linkCoincidentWalls([
      ...baseRooms.filter(({ room }) => !removed.has(room.id)),
      ...snapshots,
    ]) as RoomSnapshot[];
    assertLockedGeometryPreserved(baseRooms, completed);
    return completed;
  };

  const flushUnsavedChanges = useCallback(async (mode: 'auto' | 'manual' = 'auto') => {
    if (savePromiseRef.current) return savePromiseRef.current;
    const capturedByRoomId = { ...unsavedSnapshotsRef.current };
    const snapshots = Object.values(capturedByRoomId);
    const topologies = [...pendingTopologiesRef.current.values()].map((topology) => ({
      ...topology,
      replacedRoomIds: [...topology.replacedRoomIds],
      resultRoomIds: [...topology.resultRoomIds],
    }));
    const canonicalDirtyLevelIds = [...canonicalDirtyLevelIdsRef.current];
    if ((snapshots.length === 0 && topologies.length === 0 && canonicalDirtyLevelIds.length === 0) || access.readOnly) return;
    const saveOperation = (async () => {
      setSaveStatus('saving');
      setSaveError('');
      setGeometryError('');
      try {
        const dirtyLevelIds = new Set([
          ...topologies.map(({ levelId }) => levelId),
          ...snapshots.map(({ room }) => room.levelId),
          ...canonicalDirtyLevelIds,
        ]);
        const persistedByLevelId = new Map<string, Awaited<ReturnType<typeof saveLevelRoomSnapshots>>>();
        for (const levelId of dirtyLevelIds) {
          const level = workingLevelDataRef.current.find(({ level: candidate }) => candidate.id === levelId);
          if (!level) throw new Error('Le brouillon du niveau est introuvable.');
          const persisted = await saveLevelRoomSnapshots(
            levelId,
            level.rooms,
            level.geometryRevision ?? level.rooms[0]?.geometryRevision ?? 0,
            level.canonical,
          );
          persistedByLevelId.set(levelId, persisted);
        }
        setWorkingLevelData((current) => {
          const next = current.map((level) => {
            const persisted = persistedByLevelId.get(level.level.id);
            if (!persisted) return level;
            return {
              ...level,
              rooms: persisted.rooms,
              geometryRevision: persisted.revision,
              canonical: persisted.canonical,
              detachedWalls: persisted.canonical ? projectDetachedWalls(persisted.canonical) : [],
            };
          });
          workingLevelDataRef.current = next;
          return next;
        });
        pendingTopologiesRef.current.clear();
        canonicalDirtyLevelIds.forEach((id) => canonicalDirtyLevelIdsRef.current.delete(id));
        unsavedSnapshotsRef.current = {};
        setUnsavedSnapshots({});
        setSaveStatus('synced');
      } catch (caught) {
        setSaveStatus('error');
        setSaveError(message(caught));
        console.error('Échec de l’enregistrement automatique', caught);
        throw caught;
      }
    })();
    savePromiseRef.current = saveOperation;
    try {
      await saveOperation;
    } finally {
      if (savePromiseRef.current === saveOperation) savePromiseRef.current = null;
    }
  }, [access.readOnly]);

  const autosave = useEditorAutosave({
    source: 'global-editor',
    dirty: hasUnsavedChanges,
    enabled: !access.readOnly,
    save: () => flushUnsavedChanges('auto'),
  });
  const snapVertexPoint = (point: Point, roomId: string, vertexId: string) => {
    const linkedIds = linkedVertexIds(activeData?.rooms ?? [], roomId, vertexId);
    return snapConfiguredPoint(point, linkedIds);
  };
  const snapVertexResult = (point: Point, roomId: string, vertexId: string) => {
    const linkedIds = linkedVertexIds(activeData?.rooms ?? [], roomId, vertexId);
    return snapConfiguredResult(point, linkedIds);
  };
  const handleInteractionPoint = (rawPoint: Point) => {
    if (!interaction || !activeData || access.readOnly) return;
    if (interactionObjectHandledRef.current) {
      interactionObjectHandledRef.current = false;
      return;
    }
    const point = snapConfiguredPoint(rawPoint);
    try {
      if (interaction.type === 'split-wall') {
        const before = activeData.rooms;
        const after = splitWallInRooms(before, interaction.wallId, point);
        const roomIds = before.map(({ room }) => room.id);
        applyTopologyDraft(activeLevelId, roomIds, after);
        record({ label: 'Couper un mur en deux', undo: async () => applyTopologyDraft(activeLevelId, roomIds, before), redo: async () => applyTopologyDraft(activeLevelId, roomIds, after) });
        setInteraction(null);
        return;
      }
      if (interaction.type === 'detach-wall') {
        const owner = activeData.rooms.find(({ walls }) => walls.some(({ id }) => id === interaction.wallId));
        const wall = owner?.walls.find(({ id }) => id === interaction.wallId);
        if (!owner || !wall) throw new Error('Le mur sélectionné est introuvable.');
        if (!interaction.vertexId) {
          const start = owner.vertices.find(({ id }) => id === wall.startVertexId)!;
          const end = owner.vertices.find(({ id }) => id === wall.endVertexId)!;
          const vertexId = Math.hypot(point.x - start.x, point.y - start.y) <= Math.hypot(point.x - end.x, point.y - end.y) ? start.id : end.id;
          if (owner.vertices.find(({ id }) => id === vertexId)?.isLocked) throw new Error('Cette extrémité est verrouillée.');
          setInteraction({ ...interaction, vertexId });
          return;
        }
        if (!activeData.canonical) throw new Error('Le brouillon canonique du niveau est introuvable.');
        const result = detachWallEndpoint(activeData.canonical, activeData.rooms, interaction.wallId, interaction.vertexId, point);
        const beforeLevel = activeData;
        const afterLevel: CanvasLevelData = { ...activeData, rooms: result.rooms, canonical: result.canonical, detachedWalls: projectDetachedWalls(result.canonical) };
        const applyDetachedLevel = (value: CanvasLevelData) => {
          const nextLevels = workingLevelDataRef.current.map((candidate) => candidate.level.id === activeLevelId ? value : candidate);
          workingLevelDataRef.current = nextLevels;
          setWorkingLevelData(nextLevels);
          canonicalDirtyLevelIdsRef.current.add(activeLevelId);
          setSaveStatus('dirty');
        };
        applyDetachedLevel(afterLevel);
        record({ label: 'Détacher un mur et ouvrir la pièce', undo: async () => applyDetachedLevel(beforeLevel), redo: async () => applyDetachedLevel(afterLevel) });
        clearSelection();
        setInteraction(null);
        return;
      }
      if (interaction.type === 'reposition-dimension') {
        const dimension = activeData.dimensions?.find(({ id }) => id === interaction.dimensionId);
        if (!dimension || !onSaveDimension) throw new Error('La côte sélectionnée est introuvable.');
        const dx = dimension.end.x - dimension.start.x;
        const dy = dimension.end.y - dimension.start.y;
        const length = Math.hypot(dx, dy);
        if (length === 0) throw new Error('Une côte de distance nulle ne peut pas être repositionnée.');
        const beforeOffset = dimension.offsetCm ?? 0;
        const nextOffset = ((point.x - dimension.start.x) * -dy + (point.y - dimension.start.y) * dx) / length;
        const toDimension = (offsetCm: number): EditorDimension => ({ id: dimension.id, levelId: dimension.levelId, name: dimension.label ?? 'Nouvelle côte', type: dimension.type ?? 'point-point', distanceCm: length, offsetCm, referenceA: { type: 'point', ...dimension.start }, referenceB: { type: 'point', ...dimension.end } });
        void onSaveDimension(toDimension(nextOffset));
        record({ label: 'Repositionner le décalage', undo: async () => onSaveDimension(toDimension(beforeOffset)), redo: async () => onSaveDimension(toDimension(nextOffset)) });
        setInteraction(null);
        return;
      }
      if (interaction.type === 'change-note-origin') {
        void changeNoteOrigin(null);
      }
    } catch (caught) {
      setGeometryError(message(caught));
    }
  };
  const changeNoteOrigin = (target: EditorSelection | null) => {
    if (interaction?.type !== 'change-note-origin' || !onSaveNote || !project) return;
    const note = activeData?.notes?.find(({ id }) => id === interaction.noteId);
    if (!note) return;
    const originType: EditorNote['originType'] = !target ? 'projet' : target.type === 'room' ? 'pièce' : target.type === 'wall' ? 'mur' : target.type === 'opening' ? 'ouverture' : target.type === 'point' ? 'sommet' : target.type === 'level' ? 'niveau' : 'projet';
    const before = { id: note.id, projectId: project.id, originType: note.originType ?? 'projet', originId: note.originId ?? null, text: note.text } satisfies EditorNote;
    const after = { ...before, originType, originId: originType === 'projet' ? null : target?.id ?? null };
    if (target) interactionObjectHandledRef.current = true;
    void onSaveNote(after);
    record({ label: 'Changer l’origine de la note', undo: async () => onSaveNote(before), redo: async () => onSaveNote(after) });
    setInteraction(null);
  };
  const createAtPoint = async (rawPoint: Point) => {
    if (!creationMode || !activeLevel || access.readOnly) return; const point = snapConfiguredPoint(rawPoint);
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
        if (topologyIdentitiesChanged(combined, linked)) {
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
  const startVertexMove = (roomId: string, vertexId: string) => {
    const level = workingLevelDataRef.current.find(({ level: candidate }) => candidate.id === activeLevelId);
    if (!level || access.readOnly) return;
    vertexMoveRef.current = { levelId: activeLevelId, roomId, vertexId, before: level.rooms };
  };
  const moveVertex = (roomId: string, vertexId: string, rawPoint: Point) => {
    const gesture = vertexMoveRef.current;
    const baseRooms = gesture?.roomId === roomId && gesture.vertexId === vertexId
      ? gesture.before
      : workingLevelDataRef.current.find(({ level }) => level.id === activeLevelId)?.rooms ?? [];
    const snapshot = baseRooms.find(({ room }) => room.id === roomId);
    const linkedIds = linkedVertexIds(baseRooms, roomId, vertexId);
    if (
      !snapshot
      || access.readOnly
      || baseRooms.some(({ vertices }) => (
        vertices.some((vertex) => linkedIds.has(vertex.id) && vertex.isLocked)
      ))
    ) return;
    const point = snapVertexPoint(rawPoint, roomId, vertexId);
    const movedSnapshots = moveLinkedVertex(baseRooms, roomId, vertexId, point) as RoomSnapshot[];
    const linkedSnapshots = linkCoincidentWalls(movedSnapshots) as RoomSnapshot[];
    const issue = linkedSnapshots.map(({ vertices }) => validateRoomPolygon(vertices)).find(Boolean); if (issue) { setGeometryError(issue); return; }
    setGeometryError('');
    try {
      previewTopologyDraft(activeLevelId, baseRooms.map(({ room }) => room.id), linkedSnapshots);
    }
    catch (caught) { setGeometryError(`${message(caught)} La géométrie précédente a été conservée.`); }
  };
  const finishVertexMove = (roomId: string, vertexId: string, rawPoint: Point) => {
    const gesture = vertexMoveRef.current;
    vertexMoveRef.current = null;
    if (!gesture || gesture.roomId !== roomId || gesture.vertexId !== vertexId || gesture.levelId !== activeLevelId || !activeLevel) return;
    const before = gesture.before;
    try {
      const linkedIds = linkedVertexIds(before, roomId, vertexId);
      if (before.some(({ vertices }) => vertices.some((vertex) => linkedIds.has(vertex.id) && vertex.isLocked))) return;
      const point = snapVertexPoint(rawPoint, roomId, vertexId);
      const moved = linkCoincidentWalls(moveLinkedVertex(before, roomId, vertexId, point)) as RoomSnapshot[];
      const issue = moved.map(({ vertices }) => validateRoomPolygon(vertices)).find(Boolean);
      if (issue) throw new Error(issue);
      const movedRoom = moved.find(({ room }) => room.id === roomId);
      if (!movedRoom) return;
      const normalized = normalizeCreatedRoomOverlaps(movedRoom, moved.filter(({ room }) => room.id !== roomId));
      const after = normalized.overlapCount > 0
        ? completeLevelTopology([roomId, ...normalized.replacedRoomIds], normalized.snapshots, moved)
        : moved;
      if (sameRoomDraft(before, after)) {
        previewTopologyDraft(activeLevel.id, before.map(({ room }) => room.id), after);
        return;
      }
      applyTopologyDraft(activeLevel.id, before.map(({ room }) => room.id), after);
      record({
        label: normalized.overlapCount > 0 ? 'Déplacer un sommet et normaliser le chevauchement' : 'Déplacer un sommet',
        undo: async () => applyTopologyDraft(activeLevel.id, after.map(({ room }) => room.id), before),
        redo: async () => applyTopologyDraft(activeLevel.id, before.map(({ room }) => room.id), after),
      });
      if (normalized.overlapCount > 0) {
        const selectedRoom = normalized.snapshots.find(({ room }) => room.id === roomId) ?? normalized.snapshots.find(({ room }) => room.name === 'Zone de chevauchement');
        if (selectedRoom) select({ source: 'canvas', type: 'room', id: selectedRoom.room.id, levelId: activeLevel.id });
      }
    } catch (caught) {
      previewTopologyDraft(activeLevel.id, workingLevelDataRef.current.find(({ level }) => level.id === activeLevel.id)?.rooms.map(({ room }) => room.id) ?? [], before);
      setGeometryError(message(caught));
    }
  };
  const moveRoom = async (roomId: string, delta: Point) => {
    const snapshot = activeData?.rooms.find(({ room }) => room.id === roomId);
    if (
      !snapshot
      || access.readOnly
      || snapshot.vertices.some(({ isLocked }) => isLocked)
      || Math.hypot(delta.x, delta.y) < 1
    ) return;
    const linkedRoomVertexIds = new Set(snapshot.vertices.flatMap((vertex) => [...linkedVertexIds(activeData?.rooms ?? [], roomId, vertex.id)]));
    const excludedVertexIds = new Set(allVertices.filter(({ pieceId }) => pieceId === roomId).map(({ id }) => id));
    linkedRoomVertexIds.forEach((id) => excludedVertexIds.add(id));
    const anchor = snapConfiguredPoint({ x: snapshot.vertices[0].x + delta.x, y: snapshot.vertices[0].y + delta.y }, excludedVertexIds);
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
      const identityChanged = topologyIdentitiesChanged(movedSnapshots, linkedSnapshots);
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
  const updateRoom = (room: Room) => {
    const snapshot = activeData?.rooms.find(({ room: candidate }) => candidate.id === room.id);
    if (!snapshot || access.readOnly) return;
    const next = { ...snapshot, room: { ...room } };
    upsertLocalSnapshot(next);
    record({ label: 'Modifier une pièce', undo: async () => upsertLocalSnapshot(snapshot), redo: async () => upsertLocalSnapshot(next) });
  };
  const updateWall = (wall: Wall) => {
    if (!activeData || access.readOnly) return;
    const detached = activeData.detachedWalls?.find(({ id }) => id === wall.id);
    if (detached && activeData.canonical) {
      const applyDetached = (value: Wall) => {
        const nextLevels = workingLevelDataRef.current.map((level) => level.level.id !== activeLevelId || !level.canonical ? level : {
          ...level,
          canonical: { ...level.canonical, walls: level.canonical.walls.map((candidate) => candidate.id === value.id ? { ...candidate, thicknessCm: value.thicknessCm ?? null, material: value.material ?? null, insulation: value.insulation ?? null, notes: value.notes ?? null } : candidate) },
          detachedWalls: level.detachedWalls?.map((candidate) => candidate.id === value.id ? { ...candidate, wall: { ...candidate.wall, ...value } } : candidate),
        });
        workingLevelDataRef.current = nextLevels;
        setWorkingLevelData(nextLevels);
        canonicalDirtyLevelIdsRef.current.add(activeLevelId);
        setSaveStatus('dirty');
      };
      applyDetached(wall);
      record({ label: 'Modifier un mur détaché', undo: async () => applyDetached(detached.wall), redo: async () => applyDetached(wall) });
      return;
    }
    const before = activeData.rooms;
    const after = before.map((snapshot) => snapshot.walls.some(({ id }) => id === wall.id) ? {
      ...snapshot,
      walls: snapshot.walls.map((candidate) => candidate.id === wall.id ? {
        ...candidate,
        thicknessCm: wall.thicknessCm,
        material: wall.material,
        insulation: wall.insulation,
        notes: wall.notes,
      } : candidate),
    } : snapshot);
    const roomIds = before.map(({ room }) => room.id);
    applyTopologyDraft(activeLevelId, roomIds, after);
    record({ label: 'Modifier un mur', undo: async () => applyTopologyDraft(activeLevelId, roomIds, before), redo: async () => applyTopologyDraft(activeLevelId, roomIds, after) });
  };
  const updateOpening = (opening: Opening) => {
    if (!activeData || access.readOnly) return;
    try {
      assertOpeningValidInLevel(activeData.rooms, opening);
    } catch (caught) {
      setGeometryError(message(caught));
      return;
    }
    const before = activeData.rooms;
    const after = before.map((snapshot) => snapshot.openings.some(({ id }) => id === opening.id) ? {
      ...snapshot,
      openings: snapshot.openings.map((candidate) => candidate.id === opening.id ? opening : candidate),
    } : snapshot);
    const roomIds = before.map(({ room }) => room.id);
    applyTopologyDraft(activeLevelId, roomIds, after);
    record({ label: 'Modifier une ouverture', undo: async () => applyTopologyDraft(activeLevelId, roomIds, before), redo: async () => applyTopologyDraft(activeLevelId, roomIds, after) });
  };
  const createOpening = (templateId: string) => {
    if (!activeData || selection?.type !== 'wall' || access.readOnly) return;
    const owner = activeData.rooms.find(({ walls }) => walls.some(({ id }) => id === selection.id));
    const wall = owner?.walls.find(({ id }) => id === selection.id);
    const template = owner?.openingTemplates?.[templateId];
    const profiles = wall?.heightProfiles;
    if (!owner || !wall || !template || !profiles) return;
    const start = owner.vertices.find(({ id }) => id === wall.startVertexId);
    const end = owner.vertices.find(({ id }) => id === wall.endVertexId);
    if (!start || !end) return;
    const wallLengthCm = Math.hypot(end.x - start.x, end.y - start.y);
    const widthCm = Math.min(90, wallLengthCm);
    const availableHeightCm = Math.min(...[...profiles.gauche, ...profiles.droite].map(({ heightCm }) => heightCm));
    const topologyOpening = createOpeningFromTemplate(template, {
      wallId: wall.id,
      positionCm: Math.max(0, (wallLengthCm - widthCm) / 2),
      widthCm,
      heightCm: Math.min(215, availableHeightCm),
    });
    const opening: Opening = {
      id: topologyOpening.id,
      wallId: topologyOpening.wallId,
      templateId: topologyOpening.templateId,
      type: topologyOpening.type === 'porte' ? 'door' : topologyOpening.type === 'fenêtre' ? 'window' : 'other',
      openingKind: topologyOpening.type,
      placementType: topologyOpening.placementType,
      offsetCm: topologyOpening.positionCm,
      widthCm: topologyOpening.widthCm,
      heightCm: topologyOpening.heightCm,
      bottomCm: topologyOpening.bottomCm,
      orientation: topologyOpening.orientation,
      hingeSide: topologyOpening.hingeSide,
    };
    try {
      assertOpeningValidInLevel(activeData.rooms, opening);
      const before = activeData.rooms;
      const after = before.map((snapshot) => snapshot.walls.some(({ id }) => id === wall.id) ? { ...snapshot, openings: [...snapshot.openings, opening] } : snapshot);
      const roomIds = before.map(({ room }) => room.id);
      applyTopologyDraft(activeLevelId, roomIds, after);
      record({ label: 'Créer une ouverture', undo: async () => applyTopologyDraft(activeLevelId, roomIds, before), redo: async () => applyTopologyDraft(activeLevelId, roomIds, after) });
      select({ source: 'creation-list', type: 'opening', id: opening.id, levelId: activeLevelId });
    } catch (caught) {
      setGeometryError(message(caught));
    }
  };
  const changeSelectionLock = (locked: boolean) => {
    if (!activeData || !selection || access.readOnly) return;
    const selectedRoomSnapshot = selection.type === 'room' ? activeData.rooms.find(({ room }) => room.id === selection.id) : null;
    const selectedWall = selection.type === 'wall' ? activeData.rooms.flatMap(({ walls }) => walls).find(({ id }) => id === selection.id) : null;
    const ids = new Set(selectedRoomSnapshot?.vertices.map(({ id }) => id) ?? (selectedWall ? [selectedWall.startVertexId, selectedWall.endVertexId] : []));
    if (ids.size === 0) return;
    const before = activeData.rooms;
    const after = setSharedVertexLock(before, ids, locked).map((snapshot) => ({
      ...snapshot,
      unlockedVertexIds: locked ? snapshot.unlockedVertexIds : [...new Set([...(snapshot.unlockedVertexIds ?? []), ...ids])],
    }));
    const roomIds = before.map(({ room }) => room.id);
    applyTopologyDraft(activeLevelId, roomIds, after);
    record({ label: locked ? 'Verrouiller la sélection' : 'Déverrouiller la sélection', undo: async () => applyTopologyDraft(activeLevelId, roomIds, before), redo: async () => applyTopologyDraft(activeLevelId, roomIds, after) });
  };
  const deleteSelection = () => {
    if (!activeData || !selection || access.readOnly) return;
    const before = activeData.rooms;
    if (selection.type === 'room') {
      const selected = before.find(({ room }) => room.id === selection.id);
      if (
        !selected
        || roomLockState(selected.vertices)
      ) return;
      if (!window.confirm(`Supprimer la pièce « ${selected.room.name} » ?`)) return;
      try {
        const after = before
          .filter(({ room }) => room.id !== selection.id)
          .map((snapshot) => ({
            ...snapshot,
            walls: snapshot.walls.map((wall) => ({
              ...wall,
              pieceIds: wall.pieceIds?.filter((pieceId) => pieceId !== selection.id),
            })),
          }));
        assertLockedGeometryPreserved(before, after);
        applyTopologyDraft(activeLevelId, before.map(({ room }) => room.id), after);
        clearSelection();
      } catch (caught) {
        setGeometryError(message(caught));
      }
      return;
    }
    if (selection.type === 'opening') {
      if (!window.confirm('Supprimer cette ouverture ?')) return;
      const after = before.map((snapshot) => ({ ...snapshot, openings: snapshot.openings.filter(({ id }) => id !== selection.id) }));
      applyTopologyDraft(activeLevelId, before.map(({ room }) => room.id), after);
      clearSelection();
    }
  };
  const deleteDetachedWall = (wallId: string) => {
    const level = workingLevelDataRef.current.find(({ level: candidate }) => candidate.id === activeLevelId);
    const wall = level?.canonical?.walls.find(({ id }) => id === wallId);
    if (!level?.canonical || !wall || wall.pieceIds.length > 0 || access.readOnly) return;
    if (!window.confirm('Supprimer ce mur détaché ?')) return;
    const vertexIds = new Set([wall.startVertexId, wall.endVertexId]);
    const usedByOtherWall = (vertexId: string) => level.canonical!.walls.some((candidate) => candidate.id !== wallId && (candidate.startVertexId === vertexId || candidate.endVertexId === vertexId));
    const nextCanonical = {
      ...level.canonical,
      vertices: level.canonical.vertices.filter(({ id }) => !vertexIds.has(id) || usedByOtherWall(id)),
      walls: level.canonical.walls.filter(({ id }) => id !== wallId),
      profilesByWallId: Object.fromEntries(Object.entries(level.canonical.profilesByWallId).filter(([id]) => id !== wallId)),
    };
    const beforeDetachedWalls = level.detachedWalls ?? [];
    const afterDetachedWalls = beforeDetachedWalls.filter(({ id }) => id !== wallId);
    const applyDetachedState = (canonical: NonNullable<CanvasLevelData['canonical']>, detachedWalls: NonNullable<CanvasLevelData['detachedWalls']>) => {
      const nextLevels = workingLevelDataRef.current.map((candidate) => candidate.level.id === activeLevelId ? { ...candidate, canonical, detachedWalls } : candidate);
      workingLevelDataRef.current = nextLevels;
      setWorkingLevelData(nextLevels);
      setSaveStatus('dirty');
      canonicalDirtyLevelIdsRef.current.add(activeLevelId);
    };
    applyDetachedState(nextCanonical, afterDetachedWalls);
    record({ label: 'Supprimer un mur détaché', undo: async () => applyDetachedState(level.canonical!, beforeDetachedWalls), redo: async () => applyDetachedState(nextCanonical, afterDetachedWalls) });
    clearSelection();
  };
  const applyDetachedCanonical = (canonical: NonNullable<CanvasLevelData['canonical']>, dirty: boolean) => {
    const nextLevels = workingLevelDataRef.current.map((candidate) => candidate.level.id === activeLevelId ? { ...candidate, rooms: projectCanonicalRoomSnapshots(canonical), canonical, detachedWalls: projectDetachedWalls(canonical) } : candidate);
    workingLevelDataRef.current = nextLevels;
    setWorkingLevelData(nextLevels);
    if (dirty) {
      canonicalDirtyLevelIdsRef.current.add(activeLevelId);
      setSaveStatus('dirty');
    }
  };
  const startDetachedVertexMove = (vertexId: string) => {
    const canonical = workingLevelDataRef.current.find(({ level }) => level.id === activeLevelId)?.canonical;
    if (!canonical || access.readOnly) return;
    detachedVertexMoveRef.current = { vertexId, before: canonical };
  };
  const previewDetachedVertexMove = (vertexId: string, point: Point) => {
    const gesture = detachedVertexMoveRef.current;
    if (!gesture || gesture.vertexId !== vertexId) return;
    try {
      applyDetachedCanonical(moveDetachedVertex(gesture.before, vertexId, point), false);
      setGeometryError('');
    } catch (caught) {
      setGeometryError(message(caught));
    }
  };
  const finishDetachedVertexMove = (vertexId: string, point: Point) => {
    const gesture = detachedVertexMoveRef.current;
    detachedVertexMoveRef.current = null;
    if (!gesture || gesture.vertexId !== vertexId) return;
    try {
      const reconnectTarget = snapping.vertices
        ? gesture.before.vertices.find((candidate) => candidate.id !== vertexId && Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 0.01)
        : undefined;
      const after = reconnectTarget
        ? reconnectDetachedVertex(gesture.before, vertexId, reconnectTarget.id).canonical
        : moveDetachedVertex(gesture.before, vertexId, point);
      applyDetachedCanonical(after, true);
      record({ label: reconnectTarget ? 'Raccorder des murs autonomes' : 'Déplacer un sommet de mur autonome', undo: async () => applyDetachedCanonical(gesture.before, true), redo: async () => applyDetachedCanonical(after, true) });
      setGeometryError('');
    } catch (caught) {
      applyDetachedCanonical(gesture.before, false);
      setGeometryError(message(caught));
    }
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
  const dismissCanvasContexts = () => {
    clearSelection();
    setCreationMode(false);
    setCreationFirstPoint(null);
    setCreationPreviewPoint(null);
    setPanelDismissKey((current) => current + 1);
  };
  return <DashboardLayout>
    <header className="global-editor__header">
      <div><p className="dashboard-eyebrow">Éditeur 2D global</p><h1 className="dashboard-pageTitle">{project?.name ?? 'Plan du projet'}</h1></div>
      <div className="dashboard-header__actions"><Button type="button" variant="default" disabled={access.readOnly || !hasUnsavedChanges || saveStatus === 'saving'} onClick={() => void autosave.saveNow().catch(() => undefined)}>{saveStatus === 'saving' ? 'Enregistrement…' : 'Sauvegarder'}</Button><Button type="button" className="dashboard-iconButton" disabled={access.readOnly || !canUndo} onClick={undo} aria-label="Annuler"><LuUndo2 aria-hidden /></Button><Button type="button" className="dashboard-iconButton" disabled={access.readOnly || !canRedo} onClick={redo} aria-label="Rétablir"><LuRedo2 aria-hidden /></Button></div>
    </header>
    {!loading && access.message ? <Alert color="orange" icon={<LuLock aria-hidden />} role="status">{access.message}</Alert> : null}
    {!loading && hasUnsavedChanges && saveStatus === 'error' ? <Alert color="red" role="status">Échec de l’enregistrement automatique{saveError ? ` : ${saveError}` : '.'} <Button type="button" variant="subtle" color="red" onClick={() => void discardDraftAndReload()}>Abandonner le brouillon et recharger</Button></Alert> : null}
    {selectionLocked ? <Alert color="yellow" icon={<LuLock aria-hidden />} role="status">L’élément sélectionné est verrouillé. Ses informations restent consultables, mais il ne peut pas être modifié.</Alert> : null}
    {geometryError ? <div className="dashboard-banner dashboard-banner--error" role="alert">{geometryError}</div> : null}
    {viewSettingsError ? <div className="dashboard-banner dashboard-banner--error" role="alert">{viewSettingsError}</div> : null}
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
      <Menu position="bottom-end" withinPortal shadow="md">
        <Menu.Target><Button variant="default" size="md" leftSection={<LuMagnet aria-hidden />}>Magnétisme</Button></Menu.Target>
        <Menu.Dropdown><CanvasSnappingOptionsMenu value={snapping} onChange={(value) => onSnappingChange?.(value)} /></Menu.Dropdown>
      </Menu>
    </section>
    <section className="global-editor__body">
      <EditorCreationPanel levels={levels} levelData={workingLevelData} activeLevelId={activeLevelId} projectId={project?.id} readOnly={access.readOnly || saveStatus === 'saving'} selectionLocked={selectionLocked} dismissKey={panelDismissKey} creationMessage={interactionMessage || creationMessage} lengthUnit={preferences.lengthUnit} onStartRoomCreation={() => { setInteraction(null); setCreationMode(true); setCreationFirstPoint(null); setCreationPreviewPoint(null); }} onCreateLevel={async (name, number) => { await autosave.saveNow(); await onCreateLevel?.(name, number); }} onUpdateLevel={async (level) => { await autosave.saveNow(); await onUpdateLevel?.(level); }} onDeleteLevel={async (level) => { if (window.confirm(`Supprimer le niveau « ${level.name} » et son contenu ?`)) { await autosave.saveNow(); await onDeleteLevel?.(level); } }} onSaveDimension={async (dimension) => { await autosave.saveNow(); await onSaveDimension?.(dimension); }} onDeleteDimension={async (id) => { if (window.confirm('Supprimer cette côte ?')) { await autosave.saveNow(); await onDeleteDimension?.(id); } }} onSaveNote={async (note) => { await autosave.saveNow(); await onSaveNote?.(note); }} onDeleteNote={async (id) => { if (window.confirm('Supprimer cette note ?')) { await autosave.saveNow(); await onDeleteNote?.(id); } }} onOpenWall={onOpenWall} onSplitWall={(wallId) => { setCreationMode(false); setInteraction({ type: 'split-wall', wallId }); }} onDetachWall={(wallId) => { setCreationMode(false); setInteraction({ type: 'detach-wall', wallId }); }} onDeleteWall={deleteDetachedWall} onRepositionDimension={(dimensionId) => { setCreationMode(false); setInteraction({ type: 'reposition-dimension', dimensionId }); }} onChangeNoteOrigin={(noteId) => { setCreationMode(false); setInteraction({ type: 'change-note-origin', noteId }); }} onUpdateRoom={updateRoom} onUpdateWall={updateWall} onUpdateOpening={updateOpening} onCreateOpening={createOpening} onToggleSelectionLock={changeSelectionLock} onDeleteSelection={deleteSelection} />
      <div className="global-editor__canvasArea">{loading && !activeLevel ? <div className="dashboard-loading" aria-live="polite">Chargement du plan…</div> : !activeLevel ? <div className="dashboard-emptyState"><h2>Aucun niveau</h2><p>Le projet doit contenir au moins un niveau visible.</p></div> : <Canvas2D levels={workingLevelData} activeLevelId={activeLevel.id} visibleLevelIds={visibleLevelIds} viewportStateKey={`global:${project?.id ?? 'none'}`} options={options} lengthUnit={preferences.lengthUnit} surfaceUnit={preferences.surfaceUnit} selection={selection} onSelect={select} editingEnabled={!access.readOnly && !creationMode && !interaction && saveStatus !== 'saving'} creationActive={creationMode || Boolean(interaction)} creationFirstPoint={creationFirstPoint} creationPreviewPoint={creationPreviewPoint} onCanvasPoint={(point) => interaction ? handleInteractionPoint(point) : void createAtPoint(point)} onInteractionSelect={changeNoteOrigin} onCanvasHover={setCreationPreviewPoint} snapCanvasPoint={snapConfiguredResult} onCanvasBlankClick={dismissCanvasContexts} snapPoint={snapVertexResult} onVertexMoveStart={startVertexMove} onVertexMove={(roomId, vertexId, point) => void moveVertex(roomId, vertexId, point)} onVertexMoveEnd={finishVertexMove} onRoomMove={(roomId, delta) => void moveRoom(roomId, delta)} onVertexLockToggle={(roomId, vertexId) => {
        const vertex = activeData?.rooms.find(({ room }) => room.id === roomId)?.vertices.find(({ id }) => id === vertexId);
        if (!vertex || access.readOnly) return;
        const ids = linkedVertexIds(activeData?.rooms ?? [], roomId, vertexId);
        const before = activeData?.rooms ?? [];
        const locked = !vertex.isLocked;
        const after = setSharedVertexLock(before, ids, locked).map((snapshot) => ({ ...snapshot, unlockedVertexIds: locked ? snapshot.unlockedVertexIds : [...new Set([...(snapshot.unlockedVertexIds ?? []), ...ids])] }));
        const roomIds = before.map(({ room }) => room.id);
        applyTopologyDraft(activeLevelId, roomIds, after);
        record({ label: locked ? 'Verrouiller un sommet' : 'Déverrouiller un sommet', undo: async () => applyTopologyDraft(activeLevelId, roomIds, before), redo: async () => applyTopologyDraft(activeLevelId, roomIds, after) });
      }} onVertexDelete={(roomId, vertexId) => {
        if (!activeData || access.readOnly) return;
        const before = activeData.rooms;
        try {
          const after = deleteRoomVertex(before, roomId, vertexId) as RoomSnapshot[];
          const issue = after.map(({ vertices }) => validateRoomPolygon(vertices)).find(Boolean);
          if (issue) throw new Error(issue);
          const roomIds = before.map(({ room }) => room.id);
          applyTopologyDraft(activeLevelId, roomIds, after);
          record({
            label: 'Supprimer un sommet',
            undo: async () => applyTopologyDraft(activeLevelId, roomIds, before),
            redo: async () => applyTopologyDraft(activeLevelId, roomIds, after),
          });
          setGeometryError('');
        } catch (caught) {
          setGeometryError(message(caught));
        }
      }} snapDetachedPoint={snapDetachedVertexResult} onDetachedVertexMoveStart={startDetachedVertexMove} onDetachedVertexMove={previewDetachedVertexMove} onDetachedVertexMoveEnd={finishDetachedVertexMove} />}</div>
      <EditorDetailPanel data={activeData} lengthUnit={preferences.lengthUnit} surfaceUnit={preferences.surfaceUnit} />
    </section>
  </DashboardLayout>;
}
