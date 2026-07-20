import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  ColorInput,
  Group,
  Menu,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  LuArrowLeft,
  LuArrowUpRight,
  LuCircleCheck,
  LuCloudAlert,
  LuEye,
  LuLoaderCircle,
  LuLock,
  LuRedo2,
  LuTrash2,
  LuUndo2,
} from 'react-icons/lu';
import { ActionHistoryProvider, useActionHistory } from '../components/ActionHistory';
import {
  Canvas2D,
  CanvasDisplayOptionsMenu,
  DEFAULT_CANVAS_DISPLAY_OPTIONS,
  type CanvasDisplayOptions,
  type CanvasLevelData,
} from '../components/Canvas2D';
import { DashboardLayout } from '../components/DashboardLayout';
import { EditorDetailPanel } from '../components/EditorPanels';
import { ManualLockButton } from '../components/ManualLockButton';
import { usePreferences } from '../components/PreferencesContext';
import { SelectionSyncBridge, useEditorSelection } from '../components/SelectionSyncBridge';
import { useEditorAutosave } from '../components/useEditorAutosave';
import {
  assertOpeningValidInLevel,
  setSharedVertexLock,
} from '../domain/editorGeometry';
import { validateRoomPolygon } from '../domain/globalGeometry';
import type { EditorSelection } from '../domain/editorSelection';
import type { Level, Opening, Point, Project, RoomType, Wall } from '../domain/types';
import {
  centimetersToDisplay,
  displayToCentimeters,
  formatLength,
} from '../domain/userPreferences';
import {
  assertLockedGeometryPreserved,
  linkCoincidentWalls,
  linkedVertexIds,
  moveLinkedVertex,
  moveRoomWithLinkedVertices,
} from '../domain/roomOverlap';
import { hasSupabaseConfig } from '../lib/supabase';
import { supabaseViewSettingsGateway } from '../data/supabase/viewSettings';
import { getLevel } from '../services/levels';
import { canWriteProject, getProject } from '../services/projects';
import {
  loadLevelGeometrySnapshot,
  saveLevelRoomSnapshots,
  type RoomSnapshot,
} from '../services/rooms';
import type { DashboardRoomTarget } from './RoomsDashboard';

type HistoryUpdateMode = 'push' | 'replace';

interface RoomEditorProps {
  initialProjectId?: string;
  initialLevelId?: string;
  initialRoomId?: string;
  onBack?: () => void;
  onContextChange?: (target: DashboardRoomTarget, historyMode?: HistoryUpdateMode) => void;
  onOpenWall?: (target: { projectId: string; levelId: string; roomId: string; wallId: string }) => void;
}

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  ['cuisine', 'Cuisine'], ['chambre', 'Chambre'], ['salon', 'Salon'],
  ['salle_de_bain', 'Salle de bain'], ['toilettes', 'Toilettes'], ['bureau', 'Bureau'],
  ['garage', 'Garage'], ['hall', 'Hall'], ['salle_de_jeu', 'Salle de jeu'],
  ['bibliotheque', 'Bibliothèque'], ['autre', 'Autre'],
].map(([value, label]) => ({ value: value as RoomType, label }));

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'La pièce n’a pas pu être chargée.';
}

export function RoomEditor(props: RoomEditorProps) {
  const projectId = props.initialProjectId ?? '';
  const levelId = props.initialLevelId ?? '';
  const roomId = props.initialRoomId ?? '';
  return <RoomEditorLoader {...props} projectId={projectId} levelId={levelId} roomId={roomId} />;
}

function RoomEditorLoader(props: RoomEditorProps & { projectId: string; levelId: string; roomId: string }) {
  const { projectId, levelId, roomId } = props;
  const [project, setProject] = useState<Project | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [levelData, setLevelData] = useState<CanvasLevelData | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [options, setOptions] = useState<CanvasDisplayOptions>(DEFAULT_CANVAS_DISPLAY_OPTIONS);
  const [optionsError, setOptionsError] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !levelId || !roomId) {
      setLoadError('Le contexte projet, niveau et pièce est incomplet.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const [nextProject, nextLevel, geometry, writeAllowed, settings] = await Promise.all([
        getProject(projectId),
        getLevel(levelId),
        loadLevelGeometrySnapshot(levelId),
        canWriteProject(projectId),
        supabaseViewSettingsGateway.load(projectId).catch(() => null),
      ]);
      if (nextLevel.projectId !== projectId) throw new Error('Le niveau n’appartient pas au projet courant.');
      if (!geometry.rooms.some(({ room }) => room.id === roomId)) {
        throw new Error('La pièce demandée n’existe plus ou n’est pas accessible.');
      }
      setProject(nextProject);
      setLevel(nextLevel);
      setLevelData({ level: nextLevel, rooms: geometry.rooms, geometryRevision: geometry.revision });
      setCanWrite(writeAllowed);
      if (settings) setOptions(settings.display);
      else setOptionsError('Les options d’affichage n’ont pas pu être relues.');
    } catch (caught) {
      setLoadError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [levelId, projectId, roomId]);

  useEffect(() => {
    if (hasSupabaseConfig()) void load();
  }, [load]);

  const validObjects = useMemo(() => new Set(levelData?.rooms.flatMap(({ room, walls, openings }) => [
    `room:${room.id}`,
    ...walls.map(({ id }) => `wall:${id}`),
    ...openings.map(({ id }) => `opening:${id}`),
  ]) ?? []), [levelData]);

  if (!hasSupabaseConfig()) return <DashboardLayout><Alert color="red">Configure Supabase pour afficher la pièce.</Alert></DashboardLayout>;

  return <ActionHistoryProvider key={`${projectId}:${levelId}:${roomId}`}>
    <SelectionSyncBridge validObjects={validObjects}>
      <RoomEditorContent
        {...props}
        project={project}
        level={level}
        initialData={levelData}
        canWrite={canWrite}
        loading={loading}
        loadError={loadError}
        options={options}
        optionsError={optionsError}
        onOptionsChange={(next) => {
          setOptions(next);
          setOptionsError('');
          void supabaseViewSettingsGateway.saveDisplayOptions(projectId, next).catch(() => {
            setOptionsError('Les options d’affichage n’ont pas pu être enregistrées.');
          });
        }}
      />
    </SelectionSyncBridge>
  </ActionHistoryProvider>;
}

interface RoomEditorContentProps extends RoomEditorProps {
  projectId: string;
  levelId: string;
  roomId: string;
  project: Project | null;
  level: Level | null;
  initialData: CanvasLevelData | null;
  canWrite: boolean;
  loading: boolean;
  loadError: string;
  options: CanvasDisplayOptions;
  optionsError: string;
  onOptionsChange(options: CanvasDisplayOptions): void;
}

function RoomEditorContent({
  projectId,
  levelId,
  roomId,
  project,
  level,
  initialData,
  canWrite,
  loading,
  loadError,
  options,
  optionsError,
  onOptionsChange,
  onBack,
  onOpenWall,
}: RoomEditorContentProps) {
  const { preferences } = usePreferences();
  const { selection, select, clear } = useEditorSelection();
  const { canUndo, canRedo, record, undo, redo } = useActionHistory();
  const [data, setData] = useState<CanvasLevelData | null>(initialData);
  const dataRef = useRef<CanvasLevelData | null>(initialData);
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setData(initialData);
      dataRef.current = initialData;
    }
  }, [dirty, initialData]);

  const current = data?.rooms.find(({ room }) => room.id === roomId) ?? null;
  const selectedWall = selection?.type === 'wall'
    ? current?.walls.find(({ id }) => id === selection.id) ?? null
    : null;
  const selectedOpening = selection?.type === 'opening'
    ? current?.openings.find(({ id }) => id === selection.id) ?? null
    : null;
  const selectedRoom = selection?.type === 'room' && selection.id === roomId ? current?.room ?? null : null;

  const autosave = useEditorAutosave({
    source: 'room-editor',
    dirty,
    enabled: canWrite && Boolean(data) && !loadError,
    save: async () => {
      const draft = dataRef.current;
      if (!draft) return;
      const saved = await saveLevelRoomSnapshots(
        levelId,
        draft.rooms,
        draft.geometryRevision ?? 0,
      );
      const next = { ...draft, rooms: saved.rooms, geometryRevision: saved.revision };
      dataRef.current = next;
      setData(next);
      setDirty(false);
    },
  });

  const applyData = useCallback((label: string, next: CanvasLevelData) => {
    const previous = dataRef.current;
    if (!previous) return;
    dataRef.current = next;
    setData(next);
    setDirty(true);
    setValidationError('');
    record({
      label,
      undo: async () => { dataRef.current = previous; setData(previous); setDirty(true); },
      redo: async () => { dataRef.current = next; setData(next); setDirty(true); },
    });
  }, [record]);

  const replaceRooms = (label: string, rooms: RoomSnapshot[]) => {
    const draft = dataRef.current;
    if (draft) applyData(label, { ...draft, rooms });
  };

  const updateCurrentSnapshot = (label: string, update: (snapshot: RoomSnapshot) => RoomSnapshot) => {
    const draft = dataRef.current;
    if (!draft) return;
    replaceRooms(label, draft.rooms.map((snapshot) => snapshot.room.id === roomId ? update(snapshot) : snapshot));
  };

  const selectionBelongsToCurrentRoom = (next: EditorSelection) => {
    if (!current) return false;
    if (next.type === 'room') return next.id === roomId;
    if (next.type === 'wall') return current.walls.some(({ id }) => id === next.id);
    if (next.type === 'opening') return current.openings.some(({ id }) => id === next.id);
    return false;
  };

  const moveVertex = (targetRoomId: string, vertexId: string, point: Point) => {
    const draft = dataRef.current;
    if (!draft || targetRoomId !== roomId || !current || !canWrite) return;
    const linkedIds = linkedVertexIds(draft.rooms, roomId, vertexId);
    if (draft.rooms.some(({ vertices }) => vertices.some((vertex) => linkedIds.has(vertex.id) && vertex.isLocked))) return;
    try {
      const moved = moveLinkedVertex(draft.rooms, roomId, vertexId, point) as RoomSnapshot[];
      const linked = linkCoincidentWalls(moved) as RoomSnapshot[];
      const issue = linked.map(({ vertices }) => validateRoomPolygon(vertices)).find(Boolean);
      if (issue) throw new Error(issue);
      replaceRooms('Déplacer un sommet de la pièce', linked);
    } catch (caught) {
      setValidationError(message(caught));
    }
  };

  const moveRoom = (targetRoomId: string, delta: Point) => {
    const draft = dataRef.current;
    if (!draft || targetRoomId !== roomId || !current || current.vertices.some(({ isLocked }) => isLocked) || !canWrite) return;
    try {
      const moved = moveRoomWithLinkedVertices(draft.rooms, roomId, delta) as RoomSnapshot[];
      const issue = moved.map(({ vertices }) => validateRoomPolygon(vertices)).find(Boolean);
      if (issue) throw new Error(issue);
      replaceRooms('Déplacer la pièce', linkCoincidentWalls(moved) as RoomSnapshot[]);
    } catch (caught) {
      setValidationError(message(caught));
    }
  };

  const updateWall = (wall: Wall) => {
    const draft = dataRef.current;
    if (!draft || !selectedWall) return;
    replaceRooms('Modifier le mur', draft.rooms.map((snapshot) => snapshot.walls.some(({ id }) => id === wall.id) ? {
      ...snapshot,
      walls: snapshot.walls.map((candidate) => candidate.id === wall.id ? {
        ...candidate,
        thicknessCm: wall.thicknessCm,
        material: wall.material,
        insulation: wall.insulation,
        notes: wall.notes,
      } : candidate),
    } : snapshot));
  };

  const updateOpening = (opening: Opening) => {
    const draft = dataRef.current;
    if (!draft) return;
    try {
      assertOpeningValidInLevel(draft.rooms, opening);
    } catch (caught) {
      setValidationError(message(caught));
      return;
    }
    replaceRooms('Modifier l’ouverture', draft.rooms.map((snapshot) => snapshot.openings.some(({ id }) => id === opening.id) ? {
      ...snapshot,
      openings: snapshot.openings.map((candidate) => candidate.id === opening.id ? opening : candidate),
    } : snapshot));
  };

  const roomLocked = current?.vertices.length ? current.vertices.every(({ isLocked }) => isLocked) : false;
  const selectedWallVertices = selectedWall
    ? current?.vertices.filter(({ id }) => id === selectedWall.startVertexId || id === selectedWall.endVertexId) ?? []
    : [];
  const selectedWallLocked = selectedWallVertices.length > 0 && selectedWallVertices.every(({ isLocked }) => isLocked);

  return <DashboardLayout>
    <header className="global-editor__header">
      <div>
        <p className="dashboard-eyebrow">Éditeur 2D par pièce</p>
        <h1 className="dashboard-pageTitle">{current?.room.name ?? 'Pièce'}</h1>
        <Text size="sm">{project?.name ?? 'Projet'} · {level?.name ?? 'Niveau'}</Text>
      </div>
      <Group>
        {autosave.status === 'saving' ? <Text><LuLoaderCircle aria-hidden /> Enregistrement…</Text> : null}
        {autosave.status === 'synced' ? <Text><LuCircleCheck aria-hidden /> Synchronisé</Text> : null}
        {autosave.status === 'error' ? <Text c="red"><LuCloudAlert aria-hidden /> Échec</Text> : null}
        {!canWrite && !loading ? <Text><LuEye aria-hidden /> Lecture seule</Text> : null}
        <Menu withinPortal>
          <Menu.Target><Button variant="default">Affichage</Button></Menu.Target>
          <Menu.Dropdown><CanvasDisplayOptionsMenu value={options} onChange={onOptionsChange} /></Menu.Dropdown>
        </Menu>
        <Button variant="default" disabled={!dirty || !canWrite || autosave.status === 'saving'} onClick={() => void autosave.saveNow().catch(() => undefined)}>Sauvegarder</Button>
        <ActionIcon variant="default" aria-label="Annuler" disabled={!canWrite || !canUndo} onClick={undo}><LuUndo2 /></ActionIcon>
        <ActionIcon variant="default" aria-label="Rétablir" disabled={!canWrite || !canRedo} onClick={redo}><LuRedo2 /></ActionIcon>
        <Button variant="default" leftSection={<LuArrowLeft />} onClick={onBack}>Retour dashboard</Button>
      </Group>
    </header>
    {loading ? <div className="dashboard-loading" aria-live="polite">Chargement de la pièce…</div> : null}
    {loadError ? <Alert color="red" role="alert">{loadError}<Button variant="subtle" onClick={onBack}>Retour dashboard</Button></Alert> : null}
    {autosave.error ? <Alert color="red" role="status">Échec de l’enregistrement automatique : {autosave.error}</Alert> : null}
    {validationError ? <Alert color="red" role="alert">{validationError}</Alert> : null}
    {optionsError ? <Alert color="red" role="status">{optionsError}</Alert> : null}
    {!loading && !loadError && data && current ? <section className="global-editor__body room-editor2d__body">
      <aside className="editor-panel room-editor2d__panel">
        <Stack>
          <Text fw={700}>Pièce</Text>
          <ManualLockButton
            isLocked={roomLocked}
            canChangeLock={canWrite}
            onChange={(locked) => {
              const ids = new Set(current.vertices.map(({ id }) => id));
              const next = setSharedVertexLock(dataRef.current!.rooms, ids, locked).map((snapshot) => ({
                ...snapshot,
                unlockedVertexIds: locked ? snapshot.unlockedVertexIds : [...new Set([...(snapshot.unlockedVertexIds ?? []), ...ids])],
              }));
              replaceRooms(locked ? 'Verrouiller la pièce' : 'Déverrouiller la pièce', next);
            }}
          />
          <TextInput label="Nom" disabled={!canWrite} value={current.room.name} onChange={(event) => updateCurrentSnapshot('Renommer la pièce', (snapshot) => ({ ...snapshot, room: { ...snapshot.room, name: event.currentTarget.value } }))} />
          <NativeSelect label="Type" disabled={!canWrite} value={current.room.type} data={ROOM_TYPES} onChange={(event) => updateCurrentSnapshot('Modifier le type de pièce', (snapshot) => ({ ...snapshot, room: { ...snapshot.room, type: event.currentTarget.value as RoomType } }))} />
          <ColorInput
            label="Couleur du sol"
            format="hex"
            disabled={!canWrite}
            value={current.room.floorColor}
            popoverProps={{ withinPortal: true }}
            onChange={(floorColor) => updateCurrentSnapshot('Modifier la couleur du sol', (snapshot) => ({ ...snapshot, room: { ...snapshot.room, floorColor } }))}
          />
          <Textarea label="Notes" disabled={!canWrite} value={current.room.notes ?? ''} onChange={(event) => updateCurrentSnapshot('Modifier les notes de la pièce', (snapshot) => ({ ...snapshot, room: { ...snapshot.room, notes: event.currentTarget.value || null } }))} />
          <Button
            color="red"
            variant="light"
            leftSection={<LuTrash2 />}
            loading={deleting}
            disabled={!canWrite || roomLocked}
            onClick={() => {
              if (!window.confirm(`Supprimer la pièce « ${current.room.name} » ?`)) return;
              const remainingRooms = data.rooms
                .filter(({ room }) => room.id !== roomId)
                .map((snapshot) => ({
                  ...snapshot,
                  walls: snapshot.walls.map((wall) => ({
                    ...wall,
                    pieceIds: wall.pieceIds?.filter((pieceId) => pieceId !== roomId),
                  })),
                }));
              try {
                assertLockedGeometryPreserved(data.rooms, remainingRooms);
              } catch (caught) {
                setValidationError(message(caught));
                return;
              }
              setDeleting(true);
              void saveLevelRoomSnapshots(levelId, remainingRooms, data.geometryRevision ?? 0)
                .then(() => { setDirty(false); clear(); onBack?.(); })
                .catch((caught) => setValidationError(message(caught)))
                .finally(() => setDeleting(false));
            }}
          >Supprimer la pièce</Button>
          <Text fw={700}>Murs</Text>
          {current.walls.map((wall, index) => <Button key={wall.id} variant={selection?.type === 'wall' && selection.id === wall.id ? 'light' : 'subtle'} onClick={() => select({ source: 'creation-list', type: 'wall', id: wall.id, levelId })}>Mur {index + 1} · {formatLength(Math.hypot(current.vertices.find(({ id }) => id === wall.endVertexId)!.x - current.vertices.find(({ id }) => id === wall.startVertexId)!.x, current.vertices.find(({ id }) => id === wall.endVertexId)!.y - current.vertices.find(({ id }) => id === wall.startVertexId)!.y), preferences.lengthUnit)}</Button>)}
          {selectedWall ? <Stack>
            <ManualLockButton
              isLocked={selectedWallLocked}
              canChangeLock={canWrite}
              onChange={(locked) => {
                const ids = new Set([selectedWall.startVertexId, selectedWall.endVertexId]);
                const next = setSharedVertexLock(dataRef.current!.rooms, ids, locked).map((snapshot) => ({
                  ...snapshot,
                  unlockedVertexIds: locked ? snapshot.unlockedVertexIds : [...new Set([...(snapshot.unlockedVertexIds ?? []), ...ids])],
                }));
                replaceRooms(locked ? 'Verrouiller le mur' : 'Déverrouiller le mur', next);
              }}
            />
            <NumberInput
              label={`Épaisseur (${preferences.lengthUnit})`}
              disabled={!canWrite || selectedWallLocked}
              value={centimetersToDisplay(selectedWall.thicknessCm ?? 0, preferences.lengthUnit)}
              onChange={(value) => updateWall({ ...selectedWall, thicknessCm: displayToCentimeters(Number(value), preferences.lengthUnit) })}
            />
            <TextInput label="Matériau" disabled={!canWrite} value={selectedWall.material ?? ''} onChange={(event) => updateWall({ ...selectedWall, material: event.currentTarget.value || null })} />
            <TextInput label="Isolation" disabled={!canWrite} value={selectedWall.insulation ?? ''} onChange={(event) => updateWall({ ...selectedWall, insulation: event.currentTarget.value || null })} />
            <Button leftSection={<LuArrowUpRight />} onClick={() => onOpenWall?.({ projectId, levelId, roomId, wallId: selectedWall.id })}>Ouvrir la vue Mur</Button>
          </Stack> : null}
          <Text fw={700}>Ouvertures</Text>
          {current.openings.map((opening) => <Button key={opening.id} variant={selection?.type === 'opening' && selection.id === opening.id ? 'light' : 'subtle'} onClick={() => select({ source: 'creation-list', type: 'opening', id: opening.id, levelId })}>{opening.openingKind ?? opening.type} · {formatLength(opening.widthCm, preferences.lengthUnit)}</Button>)}
          {selectedOpening ? <Stack>
            {(['offsetCm', 'widthCm', 'heightCm', 'bottomCm'] as const).map((key) => <NumberInput
              key={key}
              label={{ offsetCm: 'Position', widthCm: 'Largeur', heightCm: 'Hauteur', bottomCm: 'Allège' }[key]}
              disabled={!canWrite}
              min={key === 'offsetCm' || key === 'bottomCm' ? 0 : 0.01}
              value={centimetersToDisplay(selectedOpening[key], preferences.lengthUnit)}
              onChange={(value) => updateOpening({ ...selectedOpening, [key]: displayToCentimeters(Number(value), preferences.lengthUnit) })}
            />)}
          </Stack> : null}
        </Stack>
      </aside>
      <div className="global-editor__canvasArea">
        <Canvas2D
          levels={[data]}
          activeLevelId={levelId}
          visibleLevelIds={[levelId]}
          viewportStateKey={`room:${roomId}`}
          options={options}
          lengthUnit={preferences.lengthUnit}
          surfaceUnit={preferences.surfaceUnit}
          selection={selection}
          onSelect={(next) => { if (selectionBelongsToCurrentRoom(next)) select(next); }}
          editingEnabled={canWrite && autosave.status !== 'saving'}
          snapPoint={(point) => point}
          onVertexMove={moveVertex}
          onVertexMoveEnd={() => undefined}
          onRoomMove={moveRoom}
          onVertexContextMenu={(targetRoomId, vertexId) => {
            if (targetRoomId !== roomId || !canWrite) return;
            const vertex = current.vertices.find(({ id }) => id === vertexId);
            if (!vertex) return;
            const ids = linkedVertexIds(dataRef.current!.rooms, roomId, vertexId);
            const locked = !vertex.isLocked;
            const next = setSharedVertexLock(dataRef.current!.rooms, ids, locked).map((snapshot) => ({
              ...snapshot,
              unlockedVertexIds: locked ? snapshot.unlockedVertexIds : [...new Set([...(snapshot.unlockedVertexIds ?? []), ...ids])],
            }));
            replaceRooms(locked ? 'Verrouiller un sommet' : 'Déverrouiller un sommet', next);
          }}
        />
      </div>
      <EditorDetailPanel data={data} lengthUnit={preferences.lengthUnit} surfaceUnit={preferences.surfaceUnit} allowedRoomId={roomId} />
    </section> : null}
  </DashboardLayout>;
}
