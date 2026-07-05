import React, { useEffect, useMemo, useState } from 'react';
import { RoomCanvas } from '../components/RoomCanvas';
import { DashboardLayout } from '../components/DashboardLayout';
import type { Level, Opening, Project, Room, Vertex, Wall } from '../../../shared/src/types';
import type { DashboardRoomTarget } from './RoomsDashboard';
import {
  angleAtVertexDegrees,
  centroid,
  createRectangleRoomGeometry,
  formatOpeningValidationIssue,
  remapWallsToVertices,
  syncOpeningsWithWalls,
  syncWallsWithVertices,
  validateOpeningOnWall,
  validateOpenings,
  wallsFromVertices,
} from '../../../shared/src/geometry';
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

const EMPTY_LEVEL_ID = '';
const EMPTY_PROJECT_ID = '';
const DEMO_PIECE_ID = 'piece_demo';
const DEFAULT_ROOM_NAME = '';
const DEFAULT_LEVEL_NAME = '';
const DEFAULT_PROJECT_NAME = '';
const DEFAULT_ROOM_SIDE_CM = 200;
const DEFAULT_ROOM_HEIGHT_CM = 250;
const DEFAULT_WALL_THICKNESS_CM = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function createDefaultRoomGeometry(pieceId = DEMO_PIECE_ID): { vertices: Vertex[]; walls: Wall[] } {
  return createRectangleRoomGeometry(pieceId, DEFAULT_ROOM_SIDE_CM, DEFAULT_ROOM_SIDE_CM, {
    wallThicknessCm: DEFAULT_WALL_THICKNESS_CM,
    wallHeightCm: DEFAULT_ROOM_HEIGHT_CM,
  });
}

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

type HistoryUpdateMode = 'push' | 'replace';

interface RoomEditorDemoProps {
  initialProjectId?: string;
  initialLevelId?: string;
  initialRoomId?: string;
  onBack?: () => void;
  onContextChange?: (target: DashboardRoomTarget, historyMode?: HistoryUpdateMode) => void;
}

export function RoomEditorDemo({
  initialProjectId,
  initialLevelId,
  initialRoomId,
  onBack,
  onContextChange,
}: RoomEditorDemoProps) {
  const supabaseConfigured = hasSupabaseConfig();
  const initialDraft = useMemo(() => createDefaultRoomGeometry(), []);
  const [vertices, setVertices] = useState<Vertex[]>(initialDraft.vertices);
  const [wallDefinitions, setWallDefinitions] = useState<Wall[]>(initialDraft.walls);
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
  const [openingFormMessage, setOpeningFormMessage] = useState<string | null>(null);

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
  const isBusy = busyAction !== null;

  function notifyContextChange(target: DashboardRoomTarget, historyMode: HistoryUpdateMode = 'replace') {
    onContextChange?.(target, historyMode);
  }

  async function runRoomAction(actionLabel: string, action: () => Promise<void>) {
    setBusyAction(actionLabel);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await action();
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
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
    const nextWalls = syncWallsWithVertices(nextVertices, wallDefinitions);
    setVertices(nextVertices);
    setWallDefinitions(nextWalls);
    setOpenings((currentOpenings) => syncOpeningsWithWalls(nextWalls, currentOpenings));
  }

  function updateSelectedWall(nextWall: Wall) {
    if (selectedWallIndex === null) return;

    setWallDefinitions((currentWalls) => currentWalls.map((wall, index) => (
      index === selectedWallIndex ? nextWall : wall
    )));
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
    if (!selectedWall || !selectedWallDefinition) return;

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
      setOpeningFormMessage(formatOpeningValidationIssue(validationIssue));
      return;
    }

    setOpenings((currentOpenings) => [...currentOpenings, nextOpening]);
    setOpeningFormMessage(null);
    setErrorMessage(null);
    setStatusMessage(`Ouverture ajoutée localement sur le mur ${selectedWall.index + 1}. Enregistre la pièce pour la persister.`);
  }

  function handleRemoveOpening(openingId: string) {
    setOpenings((currentOpenings) => currentOpenings.filter((opening) => opening.id !== openingId));
    setOpeningFormMessage(null);
    setErrorMessage(null);
    setStatusMessage('Ouverture supprimée localement. Enregistre la pièce pour confirmer la suppression.');
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
    const draft = createDefaultRoomGeometry();
    setActiveRoom(null);
    setRoomNameInput(DEFAULT_ROOM_NAME);
    setOpeningDraft(DEFAULT_OPENING_DRAFT);
    setOpeningFormMessage(null);
    applyRoomGeometry(draft.vertices, draft.walls, []);
    setSelectedWallIndex(null);
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
        setStatusMessage('Brouillon local prêt. Enregistre la pièce affichée pour la créer en base.');
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
    setStatusMessage('Brouillon local prêt. Enregistre la pièce affichée pour la créer en base.');
    setErrorMessage(null);
    notifyContextChange({ projectId: selectedProjectId, levelId: selectedLevelId, roomId: '' }, 'push');
  };

  const handleSelectedRoomChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRoomId = event.target.value;

    setStatusMessage(null);
    setErrorMessage(null);

    if (!nextRoomId) {
      clearActiveRoomSelection();
      notifyContextChange({ projectId: selectedProjectId, levelId: selectedLevelId, roomId: '' }, 'push');
      return;
    }

    const cachedSnapshot = levelRoomSnapshots.find((snapshot) => snapshot.room.id === nextRoomId);
    if (cachedSnapshot) {
      applyActiveRoomSnapshot(cachedSnapshot);
      notifyContextChange({
        projectId: selectedProjectId,
        levelId: selectedLevelId,
        roomId: cachedSnapshot.room.id,
      }, 'push');
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
      }, 'push');
      setStatusMessage(`Pièce affichée : ${snapshot.room.name}.`);
    });
  };

  const handleSaveRoom = () => {
    void runRoomAction('save', async () => {
      const roomName = roomNameInput.trim();

      if (!selectedLevelId) {
        throw new Error('Sélectionne un niveau avant d’enregistrer la pièce.');
      }

      if (!isUuid(selectedLevelId)) {
        throw new Error('Le niveau sélectionné est invalide.');
      }

      if (!roomName) {
        throw new Error('Renseigne un nom avant de sauvegarder la pièce.');
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

      const nextRooms = await refreshRoomsForLevel(savedRoom.levelId);
      await refreshRoomSnapshotsForRooms(nextRooms);

      setActiveRoom(savedRoom);
      setSelectedRoomId(savedRoom.id);
      setRoomNameInput(savedRoom.name);
      applyRoomGeometry(savedVertices, savedWalls, savedOpenings);
      notifyContextChange({
        projectId: selectedProjectId,
        levelId: selectedLevelId,
        roomId: savedRoom.id,
      }, 'replace');
      setStatusMessage(
        isCreatingRoom
          ? `Pièce créée et enregistrée : ${savedRoom.name}.`
          : `Pièce enregistrée : ${savedRoom.name}.`,
      );
    });
  };

  const handleDeleteRoom = () => {
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
      setStatusMessage(
        remainingRooms.length === 0
          ? `Pièce supprimée : ${deletedRoom.name}. Aucune pièce restante pour ce niveau.`
          : `Pièce supprimée : ${deletedRoom.name}. Sélectionne une autre pièce dans la liste pour l'afficher.`,
      );
    });
  };

  return (
    <DashboardLayout>
      <header style={{ marginBottom: 16, padding: '0 24px' }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 999,
              border: '1px solid #d0d7de',
              background: 'white',
              color: '#24292f',
              cursor: 'pointer',
            }}
          >
            Retour au tableau de bord
          </button>
        ) : null}
        <h1 style={{ marginBottom: 8 }}>Prototype — éditeur de pièce polygonale</h1>
        <p style={{ marginTop: 0, color: '#57606a' }}>
          Base de départ pour le MVP : vue de dessus, sélection de mur, métriques automatiques.
        </p>
      </header>

      <section style={{ marginBottom: 24, display: 'grid', gap: 16 }}>
        <div style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 16, background: 'white' }}>
          <h3 style={{ marginTop: 0 }}>Projets</h3>
          {!supabaseConfigured ? (
            <p style={{ marginBottom: 0, color: '#57606a' }}>
              Supabase n&apos;est pas configuré. Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans web/.env.local pour activer la gestion des projets, niveaux et pièces depuis l&apos;interface.
            </p>
          ) : (
            <>
              <p style={{ marginTop: 0, color: '#57606a' }}>
                La création et la sélection sont séparées : crée un projet par son nom, puis sélectionne explicitement le projet actif avant de gérer ses niveaux.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  Nom du projet
                  <input
                    value={newProjectNameInput}
                    onChange={(event) => setNewProjectNameInput(event.target.value)}
                    placeholder="Maison principale, appartement, extension..."
                    disabled={isBusy}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  Projet sélectionné
                  <select
                    value={selectedProjectId}
                    onChange={handleSelectedProjectChange}
                    disabled={isBusy || availableProjects.length === 0}
                  >
                    <option value="">
                      {availableProjects.length === 0 ? 'Aucun projet chargé' : 'Sélectionner un projet'}
                    </option>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={handleListProjects} disabled={isBusy}>
                  {busyAction === 'list-projects' ? 'Chargement...' : 'Lister les projets'}
                </button>
                <button type="button" className="dashboard-createButton" onClick={handleCreateProject} disabled={isBusy}>
                  {busyAction === 'create-project' ? 'Création...' : 'Créer le projet'}
                </button>
              </div>

              <p style={{ marginBottom: 0, color: '#57606a' }}>
                {selectedProject
                  ? `Projet actif : ${selectedProject.name} (${selectedProject.id})`
                  : 'Aucun projet sélectionné pour les opérations sur les niveaux.'}
              </p>
            </>
          )}
        </div>

        <div style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 16, background: 'white' }}>
          <h3 style={{ marginTop: 0 }}>Niveaux</h3>
          {!supabaseConfigured ? (
            <p style={{ marginBottom: 0, color: '#57606a' }}>
              Supabase n&apos;est pas configuré. Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans web/.env.local pour activer la gestion des niveaux et des pièces depuis l&apos;interface.
            </p>
          ) : (
            <>
              <p style={{ marginTop: 0, color: '#57606a' }}>
                La création et la sélection sont séparées : crée un niveau avec son projet et son nom, puis utilise la liste pour choisir le niveau actif du projet affiché.
              </p>

              <p style={{ marginTop: 0 }}>
                <strong>Projet actif pour la sélection :</strong>{' '}
                {selectedProject ? selectedProject.name : 'aucun projet sélectionné'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  Projet de création
                  <select
                    value={newLevelProjectId}
                    onChange={handleNewLevelProjectChange}
                    disabled={isBusy || availableProjects.length === 0}
                  >
                    <option value="">
                      {availableProjects.length === 0 ? 'Aucun projet disponible' : 'Sélectionner un projet'}
                    </option>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  Nom du niveau
                  <input
                    value={newLevelNameInput}
                    onChange={(event) => setNewLevelNameInput(event.target.value)}
                    placeholder="Rez-de-chaussée, étage, sous-sol..."
                    disabled={isBusy}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                  Niveau sélectionné
                  <select
                    value={selectedLevelId}
                    onChange={handleSelectedLevelChange}
                    disabled={isBusy || !selectedProjectId || availableLevels.length === 0}
                  >
                    <option value="">
                      {availableLevels.length === 0 ? 'Aucun niveau chargé pour ce projet' : 'Sélectionner un niveau'}
                    </option>
                    {availableLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={handleListLevels} disabled={isBusy || !selectedProjectId}>
                  {busyAction === 'list-levels' ? 'Chargement...' : 'Lister les niveaux'}
                </button>
                <button type="button" className="dashboard-createButton" onClick={handleCreateLevel} disabled={isBusy || !newLevelProjectId}>
                  {busyAction === 'create-level' ? 'Création...' : 'Créer le niveau'}
                </button>
              </div>

              <p style={{ marginBottom: 0, color: '#57606a' }}>
                {selectedLevel
                  ? `Niveau actif : ${selectedLevel.name} (${selectedLevel.id})`
                  : 'Aucun niveau sélectionné pour les opérations sur les pièces.'}
              </p>
            </>
          )}
        </div>

        <div style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 16, background: 'white' }}>
          <h3 style={{ marginTop: 0 }}>Pièces</h3>
          {!supabaseConfigured ? (
            <p style={{ marginBottom: 0, color: '#57606a' }}>
              Supabase n&apos;est pas configuré. Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans web/.env.local pour activer la création, le chargement et la suppression depuis l&apos;interface.
            </p>
          ) : (
            <>
              <p style={{ marginTop: 0, color: '#57606a' }}>
                La création et la sélection sont séparées : crée une pièce avec son niveau et son nom, puis utilise la liste pour choisir celle affichée dans le canvas.
              </p>

              <p style={{ marginTop: 0 }}>
                <strong>Niveau :</strong>{' '}
                {selectedLevel ? selectedLevel.name : 'aucun niveau sélectionné'}
              </p>

              <p style={{ marginTop: 0 }}>
                <strong>Pièce active :</strong>{' '}
                {activeRoom ? `${activeRoom.name} (${activeRoom.id})` : 'brouillon local non sauvegardé'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  Niveau de création
                  <select
                    value={selectedLevelId}
                    onChange={handleSelectedLevelChange}
                    disabled={isBusy || availableLevels.length === 0}
                  >
                    <option value="">
                      {availableLevels.length === 0 ? 'Aucun niveau disponible' : 'Sélectionner un niveau'}
                    </option>
                    {availableLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  Nom de la nouvelle pièce
                  <input
                    value={newRoomNameInput}
                    onChange={(event) => setNewRoomNameInput(event.target.value)}
                    placeholder="Cuisine, salon, chambre..."
                    disabled={isBusy}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                <button type="button" className="dashboard-createButton" onClick={handleCreateRoom} disabled={isBusy || !selectedLevelId}>
                  Préparer un brouillon
                </button>
              </div>

              <label style={{ display: 'grid', gap: 6, marginTop: 16 }}>
                Pièce affichée dans le canvas
                <select
                  value={selectedRoomId}
                  onChange={handleSelectedRoomChange}
                  disabled={isBusy || availableRooms.length === 0}
                >
                  <option value="">
                    {availableRooms.length === 0 ? 'Aucune pièce disponible pour ce niveau' : 'Sélectionner une pièce'}
                  </option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>

              {activeRoom || selectedLevelId ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      Nom de la pièce affichée
                      <input
                        value={roomNameInput}
                        onChange={(event) => setRoomNameInput(event.target.value)}
                        placeholder="Cuisine, salon, chambre..."
                        disabled={isBusy}
                      />
                    </label>

                    <div style={{ display: 'grid', gap: 6 }}>
                      <span>{activeRoom ? 'Identifiant' : 'Statut'}</span>
                      <div style={{ padding: '8px 12px', border: '1px solid #d0d7de', borderRadius: 6, background: '#f6f8fa', color: '#57606a' }}>
                        {activeRoom ? activeRoom.id : 'Brouillon local non sauvegardé'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                    <button type="button" onClick={handleSaveRoom} disabled={isBusy || !selectedLevelId}>
                      {busyAction === 'save'
                        ? 'Enregistrement...'
                        : activeRoom
                          ? 'Enregistrer la pièce affichée'
                          : 'Enregistrer le brouillon'}
                    </button>
                    {activeRoom ? (
                      <button type="button" onClick={handleDeleteRoom} disabled={isBusy}>
                        {busyAction === 'delete' ? 'Suppression...' : 'Supprimer la pièce affichée'}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}

              {statusMessage ? (
                <p style={{ marginBottom: 0, color: '#0a6c3c' }}>{statusMessage}</p>
              ) : null}

              {errorMessage ? (
                <p style={{ marginBottom: 0, color: '#cf222e' }}>{errorMessage}</p>
              ) : null}
            </>
          )}
        </div>
      </section>

      <RoomCanvas
        vertices={vertices}
        wallDefinitions={wallDefinitions}
        openings={openings}
        contextRooms={contextRooms}
        selectedWallIndex={selectedWallIndex}
        onVerticesChange={handleVerticesChange}
        onWallSelect={setSelectedWallIndex}
      />

      {contextRooms.length > 0 ? (
        <p style={{ marginTop: 12, marginBottom: 0, color: '#57606a' }}>
          Vue étage active : {contextRooms.length} autre(s) pièce(s) du niveau sont affichée(s) en gris avec leurs coordonnées globales.
        </p>
      ) : null}

      <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 16, background: 'white' }}>
          <h3 style={{ marginTop: 0 }}>Mur sélectionné</h3>
          {selectedWall && selectedWallDefinition ? (
            <>
              <p><strong>Index :</strong> {selectedWall.index + 1}</p>
              <p><strong>Départ :</strong> ({selectedWall.start.x}, {selectedWall.start.y})</p>
              <p><strong>Fin :</strong> ({selectedWall.end.x}, {selectedWall.end.y})</p>
              <p><strong>Longueur :</strong> {(selectedWall.lengthCm / 100).toFixed(2)} m</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  Épaisseur (cm)
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={selectedWallDefinition.thicknessCm ?? ''}
                    onChange={handleSelectedWallThicknessChange}
                    placeholder="7, 10, 14..."
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  Hauteur (cm)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={getEditableWallHeightCm(selectedWallDefinition) ?? ''}
                    onChange={handleSelectedWallHeightChange}
                    placeholder="250"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                  Matériau
                  <input
                    value={selectedWallDefinition.material ?? ''}
                    onChange={handleSelectedWallMaterialChange}
                    placeholder="Brique, placo, béton, bois..."
                  />
                </label>
              </div>

              {hasSplitWallHeight(selectedWallDefinition) ? (
                <p style={{ color: '#57606a', fontSize: 14, marginBottom: 0 }}>
                  Ce mur possède déjà deux hauteurs distinctes en base. Modifier la hauteur ici appliquera la même valeur aux deux extrémités.
                </p>
              ) : null}

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #d8dee4' }}>
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>Ouvertures</h4>
                <p style={{ color: '#57606a', fontSize: 14, marginTop: 0 }}>
                  La position est mesurée depuis le sommet de départ du mur. Une ouverture doit rester entièrement dans le mur et ne pas chevaucher une autre ouverture du même mur.
                </p>

                {selectedWallOpeningIssues.length > 0 ? (
                  <div style={{ marginBottom: 12, padding: 12, borderRadius: 6, background: '#fff8c5', color: '#7a4e00' }}>
                    {selectedWallOpeningIssues.map((issue) => (
                      <p key={`${issue.opening.id}:${issue.code}`} style={{ margin: 0 }}>
                        {formatOpeningValidationIssue(issue)}
                      </p>
                    ))}
                  </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    Type
                    <select
                      value={openingDraft.type}
                      onChange={(event) => handleOpeningDraftChange('type', event.target.value)}
                    >
                      <option value="door">Porte</option>
                      <option value="window">Fenêtre</option>
                      <option value="other">Autre</option>
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    Position (cm)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={openingDraft.offsetCm}
                      onChange={(event) => handleOpeningDraftChange('offsetCm', event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    Largeur (cm)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={openingDraft.widthCm}
                      onChange={(event) => handleOpeningDraftChange('widthCm', event.target.value)}
                      placeholder="90"
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    Allège / bas (cm)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={openingDraft.bottomCm}
                      onChange={(event) => handleOpeningDraftChange('bottomCm', event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                    Hauteur (cm)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={openingDraft.heightCm}
                      onChange={(event) => handleOpeningDraftChange('heightCm', event.target.value)}
                      placeholder="215"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleAddOpening}
                  style={{ marginTop: 12, padding: '10px 12px', borderRadius: 6, border: '1px solid #d0d7de', background: '#0e54e9', color: 'white' }}
                >
                  Ajouter l’ouverture
                </button>

                {openingFormMessage ? (
                  <p style={{ marginTop: 8, marginBottom: 0, color: '#cf222e', fontSize: 14 }}>
                    {openingFormMessage}
                  </p>
                ) : null}

                {selectedWallOpenings.length > 0 ? (
                  <ul style={{ paddingLeft: 18, marginTop: 16, marginBottom: 0 }}>
                    {selectedWallOpenings.map((opening) => (
                      <li key={opening.id} style={{ marginBottom: 10 }}>
                        <div>
                          <strong>
                            {opening.type === 'door'
                              ? 'Porte'
                              : opening.type === 'window'
                                ? 'Fenêtre'
                                : 'Ouverture'}
                          </strong>
                          {' '}— position {opening.offsetCm} cm, largeur {opening.widthCm} cm, hauteur {opening.heightCm} cm
                          {opening.bottomCm > 0 ? `, allège ${opening.bottomCm} cm` : ''}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOpening(opening.id)}
                          style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid #d0d7de', background: '#f6f8fa', color: '#24292f' }}
                        >
                          Supprimer
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: '#57606a', fontSize: 14, marginBottom: 0, marginTop: 16 }}>
                    Aucune ouverture n’est encore définie sur ce mur.
                  </p>
                )}
              </div>

              <p style={{ color: '#57606a', fontSize: 14, marginBottom: 0 }}>
                Clique sur le cartouche du mur dans le plan pour modifier sa longueur. Les propriétés métier et ouvertures sont persistées lors de l’enregistrement de la pièce.
              </p>
            </>
          ) : (
            <p style={{ color: '#57606a' }}>Clique sur un mur pour voir ses informations.</p>
          )}
        </div>

        <div style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 16, background: 'white' }}>
          <h3 style={{ marginTop: 0 }}>Angles calculés</h3>
          <ul>
            {vertices.map((vertex, index) => {
              const prev = vertices[(index - 1 + vertices.length) % vertices.length];
              const next = vertices[(index + 1) % vertices.length];
              return (
                <li key={vertex.id}>
                  v{index} — {angleAtVertexDegrees(prev, vertex, next).toFixed(1)}°
                </li>
              );
            })}
          </ul>
          <p style={{ color: '#57606a' }}>
            Centre géométrique : ({center.x.toFixed(0)}, {center.y.toFixed(0)})
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}
