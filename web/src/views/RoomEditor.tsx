import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, NativeSelect, NumberInput, TextInput, UnstyledButton } from '@mantine/core';
import { LuEye } from 'react-icons/lu';
import { RoomCanvas } from '../components/RoomCanvas';
import { DashboardLayout } from '../components/DashboardLayout';
import { usePreferences } from '../components/PreferencesContext';
import { useUnsavedChanges } from '../components/UnsavedChangesContext';
import type { Level, Opening, Project, Room, Vertex, Wall } from '../domain/types';
import type { DashboardRoomTarget } from './RoomsDashboard';
import {
  angleAtVertexDegrees,
  centroid,
  createRectangleRoomGeometryFromPoints,
  formatOpeningValidationIssue,
  polygonAreaCm2,
  remapWallsToVertices,
  syncOpeningsWithWalls,
  syncWallsWithVertices,
  validateOpeningOnWall,
  validateOpenings,
  wallsFromVertices,
} from '../domain/geometry';
import { hasSupabaseConfig } from '../lib/supabase';
import { createLevel, listLevelsByProject } from '../services/levels';
import { createProject, listProjects } from '../services/projects';
import {
  createRoom,
  deleteRoom,
  listRoomsByLevel,
  loadRoomSnapshot,
  replaceRoomOpenings,
  replaceRoomWalls,
  replaceRoomVertices,
  updateRoom,
} from '../services/rooms';
import type { RoomSnapshot } from '../services/rooms';
import {
  centimetersToDisplay,
  displayToCentimeters,
  formatLength,
  formatSurfaceFromSquareMeters,
} from '../domain/userPreferences';

const EMPTY_LEVEL_ID = '';
const EMPTY_PROJECT_ID = '';
const DEMO_PIECE_ID = 'piece_demo';
const DEFAULT_ROOM_NAME = '';
const DEFAULT_LEVEL_NAME = '';
const DEFAULT_PROJECT_NAME = '';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPENING_REMAP_EPSILON = 1e-6;
const ROOM_EDITOR_WRITES_ENABLED = false;

type OpeningDraft = {
  type: Opening['type'];
  offsetCm: string;
  widthCm: string;
  bottomCm: string;
  heightCm: string;
};

const DEFAULT_OPENING_DRAFT: OpeningDraft = {
  type: 'door',
  offsetCm: '0',
  widthCm: '90',
  bottomCm: '0',
  heightCm: '215',
};

function prepareVerticesForRoom(
  sourceVertices: Vertex[],
  roomId: string,
  regenerateIds = false,
): Vertex[] {
  return sourceVertices.map((vertex, index) => ({
    ...vertex,
    id: regenerateIds ? crypto.randomUUID() : vertex.id,
    pieceId: roomId,
    order: index,
  }));
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Une erreur inattendue est survenue.';
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function parseMetricInput(value: string): number {
  return Number(value.replace(',', '.'));
}

function openingTypeLabel(type: Opening['type']): string {
  if (type === 'door') return 'Porte';
  if (type === 'window') return 'Fenêtre';
  return 'Ouverture';
}

function getEditableWallHeightCm(wall: Wall): number | null {
  return wall.heightLeftCm ?? wall.heightRightCm ?? null;
}

function hasSplitWallHeight(wall: Wall): boolean {
  return wall.heightLeftCm !== null
    && wall.heightRightCm !== null
    && wall.heightLeftCm !== wall.heightRightCm;
}

function remapOpeningsToWalls(sourceWalls: Wall[], targetWalls: Wall[], openings: Opening[]): Opening[] {
  const wallIndexById = new Map(sourceWalls.map((wall, index) => [wall.id, index]));

  return openings.flatMap((opening) => {
    const wallIndex = wallIndexById.get(opening.wallId);
    if (wallIndex === undefined) {
      return [];
    }

    const targetWall = targetWalls[wallIndex];
    if (!targetWall) {
      return [];
    }

    return [{
      ...opening,
      wallId: targetWall.id,
    }];
  });
}

function wallLengthsById(vertices: Vertex[], walls: Wall[]): Map<string, number> {
  const verticesById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  return new Map(
    walls.map((wall) => {
      const startVertex = verticesById.get(wall.startVertexId);
      const endVertex = verticesById.get(wall.endVertexId);

      if (!startVertex || !endVertex) {
        return [wall.id, 0];
      }

      return [wall.id, Math.hypot(endVertex.x - startVertex.x, endVertex.y - startVertex.y)];
    }),
  );
}

function remapOpeningsAfterWallSplit(
  targetVertices: Vertex[],
  sourceWalls: Wall[],
  targetWalls: Wall[],
  openings: Opening[],
): Opening[] {
  const targetWallIds = new Set(targetWalls.map((wall) => wall.id));
  const sourceWallsById = new Map(sourceWalls.map((wall) => [wall.id, wall]));
  const targetWallsByStartVertex = new Map<string, Wall[]>();
  const targetWallLengths = wallLengthsById(targetVertices, targetWalls);

  for (const wall of targetWalls) {
    const wallsStartingAtVertex = targetWallsByStartVertex.get(wall.startVertexId) ?? [];
    wallsStartingAtVertex.push(wall);
    targetWallsByStartVertex.set(wall.startVertexId, wallsStartingAtVertex);
  }

  return openings.flatMap((opening) => {
    if (targetWallIds.has(opening.wallId)) {
      return [opening];
    }

    const sourceWall = sourceWallsById.get(opening.wallId);
    if (!sourceWall) {
      return [];
    }

    const firstSegmentCandidates = targetWallsByStartVertex.get(sourceWall.startVertexId) ?? [];

    for (const firstSegment of firstSegmentCandidates) {
      const secondSegment = (targetWallsByStartVertex.get(firstSegment.endVertexId) ?? []).find(
        (candidateWall) => candidateWall.endVertexId === sourceWall.endVertexId,
      );

      if (!secondSegment) {
        continue;
      }

      const firstSegmentLengthCm = targetWallLengths.get(firstSegment.id) ?? 0;
      const secondSegmentLengthCm = targetWallLengths.get(secondSegment.id) ?? 0;
      const openingCenterCm = opening.offsetCm + opening.widthCm / 2;
      const keepOnFirstSegment = openingCenterCm <= firstSegmentLengthCm + OPENING_REMAP_EPSILON;
      const targetWall = keepOnFirstSegment ? firstSegment : secondSegment;
      const targetWallLengthCm = keepOnFirstSegment ? firstSegmentLengthCm : secondSegmentLengthCm;
      const rawOffsetCm = keepOnFirstSegment
        ? opening.offsetCm
        : opening.offsetCm - firstSegmentLengthCm;
      const offsetCm = Math.max(0, rawOffsetCm);
      const availableWidthCm = targetWallLengthCm - offsetCm;

      if (availableWidthCm <= OPENING_REMAP_EPSILON) {
        return [];
      }

      return [{
        ...opening,
        wallId: targetWall.id,
        offsetCm,
        widthCm: Math.min(opening.widthCm, availableWidthCm),
      }];
    }

    return [];
  });
}

type HistoryUpdateMode = 'push' | 'replace';

interface RoomEditorProps {
  initialProjectId?: string;
  initialLevelId?: string;
  initialRoomId?: string;
  onBack?: () => void;
  onContextChange?: (target: DashboardRoomTarget, historyMode?: HistoryUpdateMode) => void;
}

export function RoomEditor({
  initialProjectId,
  initialLevelId,
  initialRoomId,
  onBack,
  onContextChange,
}: RoomEditorProps) {
  const supabaseConfigured = hasSupabaseConfig();
  const { setSourceDirty } = useUnsavedChanges();
  const { preferences } = usePreferences();
  const [vertices, setVertices] = useState<Vertex[]>([]);
  const [wallDefinitions, setWallDefinitions] = useState<Wall[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [openingDraft, setOpeningDraft] = useState<OpeningDraft>(DEFAULT_OPENING_DRAFT);
  const [selectedWallIndex, setSelectedWallIndex] = useState<number | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [availableLevels, setAvailableLevels] = useState<Level[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [levelRoomSnapshots, setLevelRoomSnapshots] = useState<RoomSnapshot[]>([]);
  const [newProjectNameInput, setNewProjectNameInput] = useState(DEFAULT_PROJECT_NAME);
  const [selectedProjectId, setSelectedProjectId] = useState(EMPTY_PROJECT_ID);
  const [newLevelProjectId, setNewLevelProjectId] = useState(EMPTY_PROJECT_ID);
  const [newLevelNameInput, setNewLevelNameInput] = useState(DEFAULT_LEVEL_NAME);
  const [selectedLevelId, setSelectedLevelId] = useState(EMPTY_LEVEL_ID);
  const [newRoomNameInput, setNewRoomNameInput] = useState(DEFAULT_ROOM_NAME);
  const [roomNameInput, setRoomNameInput] = useState(DEFAULT_ROOM_NAME);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'synced' | 'error'>('idle');
  const [openingFormMessage, setOpeningFormMessage] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'metrics' | 'objects'>('metrics');

  const walls = useMemo(() => wallsFromVertices(vertices), [vertices]);
  const selectedWall = selectedWallIndex === null ? null : walls[selectedWallIndex] ?? null;
  const selectedWallDefinition = selectedWallIndex === null ? null : wallDefinitions[selectedWallIndex] ?? null;
  const selectedWallOpenings = useMemo(() => {
    if (!selectedWallDefinition) return [];

    return openings.filter((opening) => opening.wallId === selectedWallDefinition.id);
  }, [openings, selectedWallDefinition]);
  const openingValidationIssues = useMemo(
    () => validateOpenings(vertices, wallDefinitions, openings),
    [vertices, wallDefinitions, openings],
  );
  const selectedWallOpeningIssues = useMemo(() => {
    if (!selectedWallDefinition) return [];

    return openingValidationIssues.filter(
      (issue) => issue.opening.wallId === selectedWallDefinition.id,
    );
  }, [openingValidationIssues, selectedWallDefinition]);
  const center = useMemo(() => centroid(vertices), [vertices]);
  const selectedProject = useMemo(
    () => availableProjects.find((project) => project.id === selectedProjectId) ?? null,
    [availableProjects, selectedProjectId],
  );
  const selectedLevel = useMemo(
    () => availableLevels.find((level) => level.id === selectedLevelId) ?? null,
    [availableLevels, selectedLevelId],
  );
  const contextRooms = useMemo(() => {
    if (!activeRoom) {
      return [];
    }

    return levelRoomSnapshots
      .filter((snapshot) => snapshot.room.id !== activeRoom.id)
      .map((snapshot) => ({
        room: snapshot.room,
        vertices: snapshot.vertices,
      }));
  }, [activeRoom, levelRoomSnapshots]);
  const areaM2 = useMemo(() => polygonAreaCm2(vertices) / 10000, [vertices]);
  const perimeterM = useMemo(
    () => walls.reduce((sum, wall) => sum + wall.lengthCm, 0) / 100,
    [walls],
  );
  const roomHeightM = useMemo(() => {
    const heightsCm = wallDefinitions
      .flatMap((wall) => [wall.heightLeftCm, wall.heightRightCm])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (heightsCm.length === 0) {
      return null;
    }

    const averageHeight = heightsCm.reduce((sum, value) => sum + value, 0) / heightsCm.length;
    return averageHeight / 100;
  }, [wallDefinitions]);
  const isBusy = busyAction !== null;

  function notifyContextChange(target: DashboardRoomTarget, historyMode: HistoryUpdateMode = 'replace') {
    onContextChange?.(target, historyMode);
  }

  const markDirty = useCallback(() => {
    if (!ROOM_EDITOR_WRITES_ENABLED) return;
    setHasUnsavedChanges(true);
    setSaveStatus('dirty');
  }, []);

  const clearDirty = useCallback(() => {
    setHasUnsavedChanges(false);
    setSaveStatus('idle');
  }, []);

  useEffect(() => {
    setSourceDirty('room-editor', hasUnsavedChanges);
    return () => setSourceDirty('room-editor', false);
  }, [hasUnsavedChanges, setSourceDirty]);

  async function runRoomAction(
    actionLabel: string,
    action: () => Promise<void>,
    options: { propagateError?: boolean } = {},
  ) {
    setBusyAction(actionLabel);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await action();
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
      if (options.propagateError) {
        throw error;
      }
    } finally {
      setBusyAction(null);
    }
  }

  function applyRoomGeometry(nextVertices: Vertex[], nextWalls: Wall[], nextOpenings: Opening[]) {
    const syncedWalls = syncWallsWithVertices(nextVertices, nextWalls);
    setVertices(nextVertices);
    setWallDefinitions(syncedWalls);
    setOpenings(syncOpeningsWithWalls(syncedWalls, nextOpenings));
  }

  function handleVerticesChange(nextVertices: Vertex[]) {
    if (!ROOM_EDITOR_WRITES_ENABLED) return;
    const previousWalls = wallDefinitions;
    const nextWalls = syncWallsWithVertices(nextVertices, previousWalls);
    setVertices(nextVertices);
    setWallDefinitions(nextWalls);
    setOpenings((currentOpenings) => syncOpeningsWithWalls(
      nextWalls,
      remapOpeningsAfterWallSplit(nextVertices, previousWalls, nextWalls, currentOpenings),
    ));
    markDirty();
  }

  function updateSelectedWall(nextWall: Wall) {
    if (!ROOM_EDITOR_WRITES_ENABLED || selectedWallIndex === null) return;

    setWallDefinitions((currentWalls) => currentWalls.map((wall, index) => (
      index === selectedWallIndex ? nextWall : wall
    )));
    markDirty();
  }

  function handleSelectedWallThicknessChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedWallDefinition) return;

    const nextThickness = event.target.value === '' ? null : event.target.valueAsNumber;
    updateSelectedWall({
      ...selectedWallDefinition,
      thicknessCm: Number.isFinite(nextThickness) ? nextThickness : null,
    });
  }

  function handleSelectedWallHeightChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedWallDefinition) return;

    const nextHeight = event.target.value === '' ? null : event.target.valueAsNumber;
    const normalizedHeight = Number.isFinite(nextHeight) ? nextHeight : null;

    updateSelectedWall({
      ...selectedWallDefinition,
      heightLeftCm: normalizedHeight,
      heightRightCm: normalizedHeight,
    });
  }

  function handleSelectedWallMaterialChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedWallDefinition) return;

    updateSelectedWall({
      ...selectedWallDefinition,
      material: event.target.value.trim() === '' ? null : event.target.value,
    });
  }

  function handleOpeningDraftChange(field: keyof OpeningDraft, value: string) {
    setOpeningFormMessage(null);
    setOpeningDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function handleAddOpening() {
    if (!ROOM_EDITOR_WRITES_ENABLED || !selectedWall || !selectedWallDefinition) return;

    const offsetCm = parseMetricInput(openingDraft.offsetCm);
    const widthCm = parseMetricInput(openingDraft.widthCm);
    const bottomCm = parseMetricInput(openingDraft.bottomCm);
    const heightCm = parseMetricInput(openingDraft.heightCm);

    if (!Number.isFinite(offsetCm) || offsetCm < 0) {
      setOpeningFormMessage('La position de l’ouverture doit être positive ou nulle.');
      return;
    }

    if (!Number.isFinite(widthCm) || widthCm <= 0) {
      setOpeningFormMessage('La largeur de l’ouverture doit être strictement positive.');
      return;
    }

    if (!Number.isFinite(bottomCm) || bottomCm < 0) {
      setOpeningFormMessage('L’allège de l’ouverture doit être positive ou nulle.');
      return;
    }

    if (!Number.isFinite(heightCm) || heightCm <= 0) {
      setOpeningFormMessage('La hauteur de l’ouverture doit être strictement positive.');
      return;
    }

    const nextOpening: Opening = {
      id: crypto.randomUUID(),
      wallId: selectedWallDefinition.id,
      type: openingDraft.type,
      offsetCm,
      widthCm,
      bottomCm,
      heightCm,
      notes: null,
    };

    const validationIssue = validateOpeningOnWall(
      selectedWall.lengthCm,
      selectedWallDefinition,
      nextOpening,
      selectedWallOpenings,
    );

    if (validationIssue) {
      setOpeningFormMessage(formatOpeningValidationIssue(validationIssue, preferences.lengthUnit));
      return;
    }

    setOpenings((currentOpenings) => [...currentOpenings, nextOpening]);
    setOpeningFormMessage(null);
    setErrorMessage(null);
    markDirty();
    setStatusMessage(`Ouverture ajoutée sur le mur ${selectedWall.index + 1}.`);
  }

  function handleRemoveOpening(openingId: string) {
    if (!ROOM_EDITOR_WRITES_ENABLED) return;
    setOpenings((currentOpenings) => currentOpenings.filter((opening) => opening.id !== openingId));
    setOpeningFormMessage(null);
    setErrorMessage(null);
    markDirty();
    setStatusMessage('Ouverture supprimée.');
  }

  async function refreshProjects(preferredProjectId?: string): Promise<Project[]> {
    const nextProjects = await listProjects();
    setAvailableProjects(nextProjects);
    setSelectedProjectId((currentProjectId) => {
      const candidateProjectId = preferredProjectId ?? currentProjectId;
      return nextProjects.some((project) => project.id === candidateProjectId)
        ? candidateProjectId
        : nextProjects[0]?.id ?? EMPTY_PROJECT_ID;
    });
    setNewLevelProjectId((currentProjectId) => {
      const candidateProjectId = preferredProjectId ?? currentProjectId;
      return nextProjects.some((project) => project.id === candidateProjectId)
        ? candidateProjectId
        : nextProjects[0]?.id ?? EMPTY_PROJECT_ID;
    });
    return nextProjects;
  }

  async function refreshLevelsForProject(
    projectId: string,
    preferredLevelId?: string,
  ): Promise<Level[]> {
    const trimmedProjectId = projectId.trim();

    if (!trimmedProjectId) {
      setAvailableLevels([]);
      setSelectedLevelId(EMPTY_LEVEL_ID);
      setAvailableRooms([]);
      setLevelRoomSnapshots([]);
      setSelectedRoomId('');
      return [];
    }

    const nextLevels = await listLevelsByProject(trimmedProjectId);
    setAvailableLevels(nextLevels);
    setAvailableRooms([]);
    setLevelRoomSnapshots([]);
    setSelectedRoomId('');
    setSelectedLevelId((currentLevelId) => {
      const candidateLevelId = preferredLevelId ?? currentLevelId;
      return nextLevels.some((level) => level.id === candidateLevelId)
        ? candidateLevelId
        : EMPTY_LEVEL_ID;
    });
    return nextLevels;
  }

  async function refreshRoomsForLevel(levelId: string): Promise<Room[]> {
    const trimmedLevelId = levelId.trim();

    if (!trimmedLevelId) {
      setAvailableRooms([]);
      setLevelRoomSnapshots([]);
      setSelectedRoomId('');
      return [];
    }

    const nextRooms = await listRoomsByLevel(trimmedLevelId);
    setAvailableRooms(nextRooms);
    return nextRooms;
  }

  async function refreshRoomSnapshotsForRooms(rooms: Room[]): Promise<RoomSnapshot[]> {
    if (rooms.length === 0) {
      setLevelRoomSnapshots([]);
      return [];
    }

    const nextSnapshots = await Promise.all(rooms.map((room) => loadRoomSnapshot(room.id)));
    setLevelRoomSnapshots(nextSnapshots);
    return nextSnapshots;
  }

  function resetCanvasToDraft() {
    setActiveRoom(null);
    setRoomNameInput(DEFAULT_ROOM_NAME);
    setOpeningDraft(DEFAULT_OPENING_DRAFT);
    setOpeningFormMessage(null);
    applyRoomGeometry([], [], []);
    setSelectedWallIndex(null);
    clearDirty();
  }

  function openDraftRoom(nextRoomName = DEFAULT_ROOM_NAME) {
    resetCanvasToDraft();
    setSelectedRoomId('');
    setRoomNameInput(nextRoomName);
  }

  function clearActiveRoomSelection() {
    openDraftRoom();
  }

  function applyActiveRoomSnapshot(snapshot: RoomSnapshot) {
    setActiveRoom(snapshot.room);
    setSelectedRoomId(snapshot.room.id);
    setRoomNameInput(snapshot.room.name);
    setOpeningDraft(DEFAULT_OPENING_DRAFT);
    setOpeningFormMessage(null);
    applyRoomGeometry(snapshot.vertices, snapshot.walls, snapshot.openings);
    setSelectedWallIndex(null);
    clearDirty();
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      return;
    }

    void runRoomAction('bootstrap', async () => {
      const nextProjects = await refreshProjects(initialProjectId);
      const preferredProject = nextProjects.find((project) => project.id === initialProjectId) ?? nextProjects[0];

      if (!preferredProject) {
        notifyContextChange({ projectId: EMPTY_PROJECT_ID, levelId: EMPTY_LEVEL_ID, roomId: '' }, 'replace');
        setStatusMessage('Aucun projet trouvé.');
        return;
      }

      setSelectedProjectId(preferredProject.id);
      const nextLevels = await refreshLevelsForProject(preferredProject.id, initialLevelId);
      const preferredLevel = nextLevels.find((level) => level.id === initialLevelId) ?? nextLevels[0];

      if (!preferredLevel) {
        notifyContextChange({ projectId: preferredProject.id, levelId: EMPTY_LEVEL_ID, roomId: '' }, 'replace');
        setStatusMessage('Projet sélectionné automatiquement. Aucun niveau trouvé pour ce projet.');
        return;
      }

      setSelectedLevelId(preferredLevel.id);
      const nextRooms = await refreshRoomsForLevel(preferredLevel.id);
      const nextSnapshots = await refreshRoomSnapshotsForRooms(nextRooms);

      if (initialRoomId === '') {
        openDraftRoom();
        notifyContextChange({
          projectId: preferredProject.id,
          levelId: preferredLevel.id,
          roomId: '',
        }, 'replace');
        setStatusMessage('Clique sur le plan pour placer les deux coins opposés de la pièce.');
        return;
      }

      const preferredSnapshot = nextSnapshots.find((snapshot) => snapshot.room.id === initialRoomId) ?? nextSnapshots[0];

      if (!preferredSnapshot) {
        clearActiveRoomSelection();
        notifyContextChange({ projectId: preferredProject.id, levelId: preferredLevel.id, roomId: '' }, 'replace');
        setStatusMessage('Projet et niveau sélectionnés automatiquement. Aucune pièce trouvée pour ce niveau.');
        return;
      }

      applyActiveRoomSnapshot(preferredSnapshot);
      notifyContextChange({
        projectId: preferredProject.id,
        levelId: preferredLevel.id,
        roomId: preferredSnapshot.room.id,
      }, 'replace');
      setStatusMessage(`Pièce affichée : ${preferredSnapshot.room.name}.`);
    });
  }, [supabaseConfigured, initialLevelId, initialProjectId, initialRoomId]);

  const handleSelectedProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProjectId = event.target.value;

    setSelectedProjectId(nextProjectId);
    setSelectedLevelId(EMPTY_LEVEL_ID);
    setAvailableLevels([]);
    setAvailableRooms([]);
    setLevelRoomSnapshots([]);
    clearActiveRoomSelection();
    setStatusMessage(null);
    setErrorMessage(null);
    notifyContextChange({ projectId: nextProjectId, levelId: EMPTY_LEVEL_ID, roomId: '' }, 'push');
  };

  const handleSelectedLevelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLevelId = event.target.value;

    setSelectedLevelId(nextLevelId);
    setAvailableRooms([]);
    setLevelRoomSnapshots([]);
    clearActiveRoomSelection();
    setStatusMessage(null);
    setErrorMessage(null);

    if (!supabaseConfigured || !nextLevelId) {
      notifyContextChange({ projectId: selectedProjectId, levelId: nextLevelId, roomId: '' }, 'push');
      return;
    }

    void runRoomAction('select-level', async () => {
      const nextRooms = await refreshRoomsForLevel(nextLevelId);
      const nextSnapshots = await refreshRoomSnapshotsForRooms(nextRooms);
      const firstSnapshot = nextSnapshots[0] ?? null;

      if (!firstSnapshot) {
        notifyContextChange({ projectId: selectedProjectId, levelId: nextLevelId, roomId: '' }, 'push');
        setStatusMessage('Aucune pièce trouvée pour ce niveau.');
        return;
      }

      applyActiveRoomSnapshot(firstSnapshot);
      notifyContextChange({
        projectId: selectedProjectId,
        levelId: nextLevelId,
        roomId: firstSnapshot.room.id,
      }, 'push');
      setStatusMessage(`Pièce affichée : ${firstSnapshot.room.name}.`);
    });
  };

  const handleNewLevelProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setNewLevelProjectId(event.target.value);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleListProjects = () => {
    void runRoomAction('list-projects', async () => {
      const nextProjects = await refreshProjects();

      setStatusMessage(
        nextProjects.length === 0
          ? 'Aucun projet trouvé.'
          : `${nextProjects.length} projet(s) trouvé(s).`,
      );
    });
  };

  const handleCreateProject = () => {
    if (!ROOM_EDITOR_WRITES_ENABLED) return;
    void runRoomAction('create-project', async () => {
      const projectName = newProjectNameInput.trim();

      if (!projectName) {
        throw new Error('Renseigne un nom avant de créer le projet.');
      }

      const createdProject = await createProject({
        name: projectName,
      });

      const nextProjects = await listProjects();
      setAvailableProjects(nextProjects);
      setSelectedProjectId((currentProjectId) => (
        nextProjects.some((project) => project.id === currentProjectId)
          ? currentProjectId
          : EMPTY_PROJECT_ID
      ));
      setNewLevelProjectId((currentProjectId) => {
        if (nextProjects.some((project) => project.id === currentProjectId)) {
          return currentProjectId;
        }

        return createdProject.id;
      });
      setNewProjectNameInput(DEFAULT_PROJECT_NAME);
      setStatusMessage(`Projet créé : ${createdProject.name}. Sélectionne-le dans la liste pour l'activer.`);
    });
  };

  const handleListLevels = () => {
    void runRoomAction('list-levels', async () => {
      if (!selectedProjectId) {
        throw new Error('Sélectionne un projet avant de lister les niveaux.');
      }

      if (!isUuid(selectedProjectId)) {
        throw new Error('Le projet sélectionné est invalide.');
      }

      const nextLevels = await refreshLevelsForProject(selectedProjectId);
      setStatusMessage(
        nextLevels.length === 0
          ? 'Aucun niveau trouvé pour le projet sélectionné.'
          : `${nextLevels.length} niveau(x) trouvé(s) pour le projet sélectionné.`,
      );
    });
  };

  const handleCreateLevel = () => {
    if (!ROOM_EDITOR_WRITES_ENABLED) return;
    void runRoomAction('create-level', async () => {
      const projectId = newLevelProjectId.trim();
      const levelName = newLevelNameInput.trim();

      if (!projectId) {
        throw new Error('Sélectionne un projet avant de créer un niveau.');
      }

      if (!isUuid(projectId)) {
        throw new Error('Le projet sélectionné est invalide.');
      }

      if (!levelName) {
        throw new Error('Renseigne un nom avant de créer le niveau.');
      }

      const createdLevel = await createLevel({
        projectId,
        name: levelName,
      });

      if (createdLevel.projectId === selectedProjectId) {
        await refreshLevelsForProject(createdLevel.projectId);
      }

      setNewLevelNameInput(DEFAULT_LEVEL_NAME);
      setStatusMessage(`Niveau créé : ${createdLevel.name}. Sélectionne-le dans la liste si tu veux l'afficher.`);
    });
  };

  const handleCreateRoom = () => {
    if (!ROOM_EDITOR_WRITES_ENABLED) return;
    const roomName = newRoomNameInput.trim();

    if (!selectedLevelId) {
      setErrorMessage('Sélectionne un niveau avant de préparer la pièce.');
      return;
    }

    if (!isUuid(selectedLevelId)) {
      setErrorMessage('Le niveau sélectionné est invalide.');
      return;
    }

    openDraftRoom(roomName);
    setNewRoomNameInput(DEFAULT_ROOM_NAME);
    setStatusMessage('Clique sur le plan pour placer les deux coins opposés de la pièce.');
    setErrorMessage(null);
    notifyContextChange({ projectId: selectedProjectId, levelId: selectedLevelId, roomId: '' }, 'push');
  };

  function selectRoom(nextRoomId: string, historyMode: HistoryUpdateMode = 'push') {
    setSelectedRoomId(nextRoomId);

    setStatusMessage(null);
    setErrorMessage(null);

    if (!nextRoomId) {
      clearActiveRoomSelection();
      notifyContextChange({ projectId: selectedProjectId, levelId: selectedLevelId, roomId: '' }, historyMode);
      return;
    }

    const cachedSnapshot = levelRoomSnapshots.find((snapshot) => snapshot.room.id === nextRoomId);
    if (cachedSnapshot) {
      applyActiveRoomSnapshot(cachedSnapshot);
      notifyContextChange({
        projectId: selectedProjectId,
        levelId: selectedLevelId,
        roomId: cachedSnapshot.room.id,
      }, historyMode);
      setStatusMessage(`Pièce affichée : ${cachedSnapshot.room.name}.`);
      return;
    }

    void runRoomAction('select-room', async () => {
      const snapshot = await loadRoomSnapshot(nextRoomId);
      applyActiveRoomSnapshot(snapshot);
      notifyContextChange({
        projectId: selectedProjectId,
        levelId: selectedLevelId,
        roomId: snapshot.room.id,
      }, historyMode);
      setStatusMessage(`Pièce affichée : ${snapshot.room.name}.`);
    });
  }

  const handleSelectedRoomChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    selectRoom(event.target.value, 'push');
  };

  const handleSaveRoom = (mode: 'manual' | 'auto' = 'manual') => {
    if (!ROOM_EDITOR_WRITES_ENABLED) return;
    void runRoomAction('save', async () => {
      setSaveStatus('saving');
      const draftRoomName = roomNameInput.trim();
      const newRoomDraftName = newRoomNameInput.trim();
      const roomName = draftRoomName || (!activeRoom ? newRoomDraftName : '');

      if (!selectedLevelId) {
        throw new Error('Sélectionne un niveau avant d’enregistrer la pièce.');
      }

      if (!isUuid(selectedLevelId)) {
        throw new Error('Le niveau sélectionné est invalide.');
      }

      if (!roomName) {
        throw new Error('Renseigne un nom avant de sauvegarder la pièce.');
      }

      if (!activeRoom && vertices.length !== 4) {
        throw new Error('Place deux points sur le plan avant de créer la pièce.');
      }

      const isCreatingRoom = !activeRoom;
      const savedRoom = activeRoom
        ? await updateRoom({
          ...activeRoom,
          levelId: selectedLevelId,
          name: roomName,
        })
        : await createRoom({
          levelId: selectedLevelId,
          name: roomName,
        });

      const sourceVertices = isCreatingRoom
        ? prepareVerticesForRoom(vertices, savedRoom.id, true)
        : prepareVerticesForRoom(vertices, savedRoom.id);

      const savedVertices = await replaceRoomVertices(
        savedRoom.id,
        sourceVertices,
      );
      const savedWalls = await replaceRoomWalls(
        savedRoom.id,
        savedVertices,
        remapWallsToVertices(vertices, savedVertices, wallDefinitions),
      );
      const savedOpenings = await replaceRoomOpenings(
        savedVertices,
        savedWalls,
        isCreatingRoom ? remapOpeningsToWalls(wallDefinitions, savedWalls, openings) : openings,
      );

      setAvailableRooms((currentRooms) => {
        const index = currentRooms.findIndex((room) => room.id === savedRoom.id);
        if (index < 0) return [...currentRooms, savedRoom];
        const nextRooms = [...currentRooms];
        nextRooms[index] = savedRoom;
        return nextRooms;
      });
      setLevelRoomSnapshots((currentSnapshots) => {
        const nextSnapshot: RoomSnapshot = {
          room: savedRoom,
          vertices: savedVertices,
          walls: savedWalls,
          openings: savedOpenings,
        };
        const index = currentSnapshots.findIndex((snapshot) => snapshot.room.id === savedRoom.id);
        if (index < 0) return [...currentSnapshots, nextSnapshot];
        const nextSnapshots = [...currentSnapshots];
        nextSnapshots[index] = nextSnapshot;
        return nextSnapshots;
      });

      setActiveRoom(savedRoom);
      setSelectedRoomId(savedRoom.id);
      setRoomNameInput(savedRoom.name);
      applyRoomGeometry(savedVertices, savedWalls, savedOpenings);
      notifyContextChange({
        projectId: selectedProjectId,
        levelId: selectedLevelId,
        roomId: savedRoom.id,
      }, 'replace');
      setHasUnsavedChanges(false);
      setSaveStatus('synced');
      setStatusMessage(
        mode === 'auto'
          ? `Auto-sauvegarde effectuée : ${savedRoom.name}.`
          : isCreatingRoom
          ? `Pièce créée et enregistrée : ${savedRoom.name}.`
          : `Pièce enregistrée : ${savedRoom.name}.`,
      );
    }, { propagateError: true }).catch(() => {
      setSaveStatus('error');
    });
  };

  useEffect(() => {
    if (!ROOM_EDITOR_WRITES_ENABLED || !supabaseConfigured || !hasUnsavedChanges || isBusy || !selectedLevelId) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      void handleSaveRoom('auto');
    }, 300_000);
    return () => window.clearInterval(interval);
  }, [handleSaveRoom, hasUnsavedChanges, isBusy, selectedLevelId, supabaseConfigured]);

  const handleDeleteRoom = () => {
    if (!ROOM_EDITOR_WRITES_ENABLED) return;
    void runRoomAction('delete', async () => {
      if (!activeRoom) {
        throw new Error('Sélectionne une pièce avant de la supprimer.');
      }

      const deletedRoom = activeRoom;
      let remainingRooms: Room[] = [];

      await deleteRoom(deletedRoom.id);

      if (deletedRoom.levelId && isUuid(deletedRoom.levelId)) {
        remainingRooms = await refreshRoomsForLevel(deletedRoom.levelId);
        await refreshRoomSnapshotsForRooms(remainingRooms);
      } else {
        setAvailableRooms([]);
        setLevelRoomSnapshots([]);
      }

      clearActiveRoomSelection();
      notifyContextChange({ projectId: selectedProjectId, levelId: selectedLevelId, roomId: '' }, 'replace');
      clearDirty();
      setStatusMessage(
        remainingRooms.length === 0
          ? `Pièce supprimée : ${deletedRoom.name}. Aucune pièce restante pour ce niveau.`
          : `Pièce supprimée : ${deletedRoom.name}. Sélectionne une autre pièce dans la liste pour l'afficher.`,
      );
    });
  };

  return (
    <DashboardLayout>
      <header className="room-editor__header">
        <div>
          <h2 className="dashboard-pageTitle">Éditeur de pièce (vue du dessus)</h2>
          <p className="room-editor__breadcrumbs">
            {selectedProject?.name || 'Projet'}
            {' > '}
            {selectedLevel?.name || 'Niveau'}
            {' > '}
            {roomNameInput.trim() || activeRoom?.name || 'Nouvelle pièce'}
          </p>
        </div>
        <div className="room-editor__headerActions">
          <span className="room-editor__readOnlyStatus" role="status">
            <LuEye aria-hidden="true" />
            Lecture seule
          </span>
          {onBack ? (
            <Button variant="default" className="dashboard-outlineButton" onClick={onBack}>
              Retour
            </Button>
          ) : null}
        </div>
      </header>

      {errorMessage ? (
        <div className="dashboard-banner dashboard-banner--error">{errorMessage}</div>
      ) : null}

      {hasUnsavedChanges && saveStatus === 'error' ? (
        <div className="dashboard-banner dashboard-banner--error">
          Échec de l’enregistrement automatique. Nouvelle tentative dans 5 minutes.
        </div>
      ) : null}

      {!supabaseConfigured ? (
        <section className="dashboard-emptyState">
          <h3>Supabase non configuré</h3>
          <p>
            Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans web/.env.local pour activer
            la gestion des projets, niveaux et pièces.
          </p>
        </section>
      ) : (
        <section className="room-editor__workspace">
          <aside className="room-editor__roomsPanel">
            <div className="room-editor__panelHeader">
              <h3 className="dashboard-panelTitle">Pièces</h3>
              <ActionIcon
                variant="light"
                className="room-editor__iconAction"
                onClick={handleCreateRoom}
                disabled
                aria-label="Préparer une nouvelle pièce"
              >
                +
              </ActionIcon>
            </div>

            <div className="room-editor__filtersRow">
              <NativeSelect className="dashboard-field dashboard-field--compact" label="Projet"
                  value={selectedProjectId}
                  onChange={handleSelectedProjectChange}
                  disabled={isBusy || availableProjects.length === 0}
                data={[{ value: '', label: availableProjects.length === 0 ? 'Aucun projet' : 'Sélectionner un projet' }, ...availableProjects.map((project) => ({ value: project.id, label: project.name }))]}
              />

              <NativeSelect className="dashboard-field dashboard-field--compact" label="Niveau"
                  value={selectedLevelId}
                  onChange={handleSelectedLevelChange}
                  disabled={isBusy || !selectedProjectId || availableLevels.length === 0}
                data={[{ value: '', label: availableLevels.length === 0 ? 'Aucun niveau' : 'Sélectionner un niveau' }, ...availableLevels.map((level) => ({ value: level.id, label: level.name }))]}
              />
            </div>

            <TextInput className="dashboard-field dashboard-field--compact" label="Nom de la nouvelle pièce"
                value={newRoomNameInput}
                onChange={(event) => setNewRoomNameInput(event.target.value)}
                placeholder="Cuisine, salon, chambre..."
                disabled
            />

            <div className="room-editor__list">
              {availableRooms.length === 0 ? (
                <p className="room-editor__hint">Aucune pièce pour ce niveau.</p>
              ) : (
                availableRooms.map((room) => {
                  const roomSnapshot = levelRoomSnapshots.find((snapshot) => snapshot.room.id === room.id);
                  const roomArea = roomSnapshot ? polygonAreaCm2(roomSnapshot.vertices) / 10000 : null;
                  const isSelected = room.id === selectedRoomId;

                  return (
                    <UnstyledButton
                      key={room.id}
                      className={`room-editor__roomRow ${isSelected ? 'is-active' : ''}`}
                      onClick={() => selectRoom(room.id, 'push')}
                    >
                      <strong>{room.name}</strong>
                      <span>{roomArea === null ? 'Surface...' : formatSurfaceFromSquareMeters(roomArea, preferences.surfaceUnit)}</span>
                    </UnstyledButton>
                  );
                })
              )}
            </div>
          </aside>

          <div className="room-editor__canvasPanel">
            <div className="room-editor__toolbar">
              <div className="room-editor__toolGroup">
                <Button variant="light" className="room-editor__toolButton" disabled>Dessiner</Button>
                <Button variant="subtle" className="room-editor__toolButton" disabled>Sélection</Button>
                <Button variant="subtle" className="room-editor__toolButton" disabled>Déplacer</Button>
                <Button variant="subtle" className="room-editor__toolButton" disabled>Mesurer</Button>
                <Button variant="subtle" className="room-editor__toolButton" disabled>Annoter</Button>
              </div>
              <Button
                className="dashboard-primaryButton room-editor__toolbarSave"
                onClick={() => handleSaveRoom('manual')}
                disabled
              >
                {busyAction === 'save' ? 'Enregistrement...' : activeRoom ? 'Enregistrer' : 'Créer la pièce'}
              </Button>
            </div>

            <RoomCanvas
              vertices={vertices}
              wallDefinitions={wallDefinitions}
              openings={openings}
              contextRooms={contextRooms}
              viewportStateKey={`room:${selectedProjectId}:${selectedLevelId}:${selectedRoomId || 'draft'}`}
              selectedWallIndex={selectedWallIndex}
              showInspector={false}
              readOnly
              lengthUnit={preferences.lengthUnit}
              surfaceUnit={preferences.surfaceUnit}
              height={760}
              onVerticesChange={handleVerticesChange}
              onWallSelect={setSelectedWallIndex}
              rectangleCreationEnabled={!activeRoom && vertices.length === 0}
              onRectangleCreate={(firstPoint, secondPoint) => {
                try {
                  const geometry = createRectangleRoomGeometryFromPoints(DEMO_PIECE_ID, firstPoint, secondPoint, {
                    wallThicknessCm: preferences.defaultWallThicknessCm,
                    wallHeightCm: preferences.defaultWallHeightCm,
                  });
                  applyRoomGeometry(geometry.vertices, geometry.walls, []);
                  markDirty();
                  setStatusMessage('Rectangle défini. Vérifie ses propriétés puis crée la pièce.');
                  setErrorMessage(null);
                } catch (caught) {
                  setErrorMessage(formatErrorMessage(caught));
                }
              }}
            />
          </div>

          <aside className="room-editor__inspector">
            <div className="room-editor__panelHeader">
              <h3 className="dashboard-panelTitle">{roomNameInput.trim() || activeRoom?.name || 'Pièce'}</h3>
            </div>

            <div className="room-editor__tabs">
              <Button
                variant={inspectorTab === 'metrics' ? 'filled' : 'subtle'}
                className={`room-editor__tab ${inspectorTab === 'metrics' ? 'is-active' : ''}`}
                onClick={() => setInspectorTab('metrics')}
              >
                Métriques
              </Button>
              <Button
                variant={inspectorTab === 'objects' ? 'filled' : 'subtle'}
                className={`room-editor__tab ${inspectorTab === 'objects' ? 'is-active' : ''}`}
                onClick={() => setInspectorTab('objects')}
              >
                Objet
              </Button>
            </div>

            {inspectorTab === 'metrics' ? (
              <div className="room-editor__statsList">
                <div className="room-editor__statRow"><span>Surface</span><strong>{formatSurfaceFromSquareMeters(areaM2, preferences.surfaceUnit)}</strong></div>
                <div className="room-editor__statRow"><span>Périmètre</span><strong>{formatLength(perimeterM * 100, preferences.lengthUnit)}</strong></div>
                <div className="room-editor__statRow">
                  <span>Hauteur sous plafond</span>
                  <strong>{roomHeightM === null ? 'N/A' : formatLength(roomHeightM * 100, preferences.lengthUnit)}</strong>
                </div>

                <h4 className="room-editor__sectionTitle">Murs ({walls.length})</h4>
                <ul className="room-editor__wallList">
                  {walls.map((wall) => (
                    <li key={wall.index}>
                      <UnstyledButton
                        className={`room-editor__wallItem ${selectedWallIndex === wall.index ? 'is-active' : ''}`}
                        onClick={() => setSelectedWallIndex(wall.index)}
                      >
                        <span>{wall.index + 1}</span>
                        <strong>{formatLength(wall.lengthCm, preferences.lengthUnit)}</strong>
                      </UnstyledButton>
                    </li>
                  ))}
                </ul>

                <h4 className="room-editor__sectionTitle">Angles</h4>
                <ul className="room-editor__anglesList">
                  {vertices.map((vertex, index) => {
                    const prev = vertices[(index - 1 + vertices.length) % vertices.length];
                    const next = vertices[(index + 1) % vertices.length];
                    return (
                      <li key={vertex.id}>
                        v{index + 1}: {angleAtVertexDegrees(prev, vertex, next).toFixed(1)}°
                      </li>
                    );
                  })}
                </ul>
                <p className="room-editor__hint">
                  Centre: ({formatLength(center.x, preferences.lengthUnit)}, {formatLength(center.y, preferences.lengthUnit)})
                </p>
              </div>
            ) : (
              <div className="room-editor__propertiesPanel">
                {selectedWall && selectedWallDefinition ? (
                  <div className="room-editor__wallEditor">
                    <h4 className="room-editor__sectionTitle">Ouvertures du mur {selectedWall.index + 1}</h4>

                    {selectedWallOpeningIssues.length > 0 ? (
                      <div className="dashboard-banner dashboard-banner--error">
                        {selectedWallOpeningIssues.map((issue) => (
                          <p key={`${issue.opening.id}:${issue.code}`}>
                            {formatOpeningValidationIssue(issue, preferences.lengthUnit)}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    <h5 className="room-editor__sectionTitle">Ouvertures</h5>
                    <div className="room-editor__fieldGrid">
                      <NativeSelect className="dashboard-field dashboard-field--compact room-editor__openingTypeField" label="Type"
                          value={openingDraft.type}
                          onChange={(event) => handleOpeningDraftChange('type', event.target.value)}
                          disabled
                        data={[{ value: 'door', label: 'Porte' }, { value: 'window', label: 'Fenêtre' }, { value: 'other', label: 'Autre' }]}
                      />
                      <NumberInput className="dashboard-field dashboard-field--compact" label={`Position (${preferences.lengthUnit})`}
                          min={0}
                          step={1}
                          value={centimetersToDisplay(Number(openingDraft.offsetCm), preferences.lengthUnit)}
                          onChange={(value) => handleOpeningDraftChange('offsetCm', String(displayToCentimeters(Number(value), preferences.lengthUnit)))}
                          disabled
                        />
                      <NumberInput className="dashboard-field dashboard-field--compact" label={`Largeur (${preferences.lengthUnit})`}
                          min={1}
                          step={1}
                          value={centimetersToDisplay(Number(openingDraft.widthCm), preferences.lengthUnit)}
                          onChange={(value) => handleOpeningDraftChange('widthCm', String(displayToCentimeters(Number(value), preferences.lengthUnit)))}
                          disabled
                        />
                      <NumberInput className="dashboard-field dashboard-field--compact" label={`Allège (${preferences.lengthUnit})`}
                          min={0}
                          step={1}
                          value={centimetersToDisplay(Number(openingDraft.bottomCm), preferences.lengthUnit)}
                          onChange={(value) => handleOpeningDraftChange('bottomCm', String(displayToCentimeters(Number(value), preferences.lengthUnit)))}
                          disabled
                        />
                      <NumberInput className="dashboard-field dashboard-field--compact" label={`Hauteur (${preferences.lengthUnit})`}
                          min={1}
                          step={1}
                          value={centimetersToDisplay(Number(openingDraft.heightCm), preferences.lengthUnit)}
                          onChange={(value) => handleOpeningDraftChange('heightCm', String(displayToCentimeters(Number(value), preferences.lengthUnit)))}
                          disabled
                        />
                    </div>

                    <Button className="dashboard-viewButton" onClick={handleAddOpening} disabled>
                      Ajouter ouverture
                    </Button>

                    {openingFormMessage ? (
                      <div className="dashboard-banner dashboard-banner--error">{openingFormMessage}</div>
                    ) : null}

                    {selectedWallOpenings.length === 0 ? (
                      <p className="room-editor__hint">Aucune ouverture sur ce mur.</p>
                    ) : (
                      <ul className="room-editor__openingsList">
                        {selectedWallOpenings.map((opening) => (
                          <li key={opening.id}>
                            <span>
                              {openingTypeLabel(opening.type)} - {formatLength(opening.widthCm, preferences.lengthUnit)} × {formatLength(opening.heightCm, preferences.lengthUnit)}
                            </span>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              className="room-editor__openingDeleteButton"
                              onClick={() => handleRemoveOpening(opening.id)}
                              disabled
                              aria-label={`Supprimer l'ouverture ${openingTypeLabel(opening.type)}`}
                              title="Supprimer"
                            >
                              X
                            </ActionIcon>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="room-editor__hint">Sélectionne un mur dans le plan pour ajouter une ouverture.</p>
                )}
              </div>
            )}
          </aside>
        </section>
      )}
    </DashboardLayout>
  );
}
