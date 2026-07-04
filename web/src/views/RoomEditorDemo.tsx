import React, { useMemo, useState } from 'react';
import { RoomCanvas } from '../components/RoomCanvas';
import type { Level, Project, Room, Vertex, Wall } from '../../../shared/src/types';
import {
  angleAtVertexDegrees,
  centroid,
  remapWallsToVertices,
  syncWallsWithVertices,
  wallsFromVertices,
} from '../../../shared/src/geometry';
import { hasSupabaseConfig } from '../lib/supabase';
import { createLevel, getLevel, listLevelsByProject } from '../services/levels';
import { createProject, listProjects } from '../services/projects';
import {
  createRoom,
  deleteRoom,
  listRoomsByLevel,
  loadRoomSnapshot,
  replaceRoomWalls,
  replaceRoomVertices,
  updateRoom,
} from '../services/rooms';

const EMPTY_LEVEL_ID = '';
const EMPTY_PROJECT_ID = '';
const DEMO_PIECE_ID = 'piece_demo';
const DEFAULT_ROOM_NAME = 'Pièce démo';
const DEFAULT_LEVEL_NAME = '';
const DEFAULT_PROJECT_NAME = '';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createDemoVertices(pieceId = DEMO_PIECE_ID): Vertex[] {
  return [
    { id: crypto.randomUUID(), pieceId, order: 0, x: 100, y: 100 },
    { id: crypto.randomUUID(), pieceId, order: 1, x: 520, y: 100 },
    { id: crypto.randomUUID(), pieceId, order: 2, x: 520, y: 280 },
    { id: crypto.randomUUID(), pieceId, order: 3, x: 320, y: 280 },
    { id: crypto.randomUUID(), pieceId, order: 4, x: 320, y: 500 },
    { id: crypto.randomUUID(), pieceId, order: 5, x: 100, y: 500 },
  ];
}

function createDraftRoomGeometry(pieceId = DEMO_PIECE_ID): { vertices: Vertex[]; walls: Wall[] } {
  const vertices = createDemoVertices(pieceId);
  return {
    vertices,
    walls: syncWallsWithVertices(vertices, []),
  };
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

function getEditableWallHeightCm(wall: Wall): number | null {
  return wall.heightLeftCm ?? wall.heightRightCm ?? null;
}

function hasSplitWallHeight(wall: Wall): boolean {
  return wall.heightLeftCm !== null
    && wall.heightRightCm !== null
    && wall.heightLeftCm !== wall.heightRightCm;
}

export function RoomEditorDemo() {
  const supabaseConfigured = hasSupabaseConfig();
  const initialDraft = useMemo(() => createDraftRoomGeometry(), []);
  const [vertices, setVertices] = useState<Vertex[]>(initialDraft.vertices);
  const [wallDefinitions, setWallDefinitions] = useState<Wall[]>(initialDraft.walls);
  const [selectedWallIndex, setSelectedWallIndex] = useState<number | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [availableLevels, setAvailableLevels] = useState<Level[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [newProjectNameInput, setNewProjectNameInput] = useState(DEFAULT_PROJECT_NAME);
  const [selectedProjectId, setSelectedProjectId] = useState(EMPTY_PROJECT_ID);
  const [newLevelNameInput, setNewLevelNameInput] = useState(DEFAULT_LEVEL_NAME);
  const [selectedLevelId, setSelectedLevelId] = useState(EMPTY_LEVEL_ID);
  const [roomNameInput, setRoomNameInput] = useState(DEFAULT_ROOM_NAME);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const walls = useMemo(() => wallsFromVertices(vertices), [vertices]);
  const selectedWall = selectedWallIndex === null ? null : walls[selectedWallIndex] ?? null;
  const selectedWallDefinition = selectedWallIndex === null ? null : wallDefinitions[selectedWallIndex] ?? null;
  const center = useMemo(() => centroid(vertices), [vertices]);
  const selectedProject = useMemo(
    () => availableProjects.find((project) => project.id === selectedProjectId) ?? null,
    [availableProjects, selectedProjectId],
  );
  const selectedLevel = useMemo(
    () => availableLevels.find((level) => level.id === selectedLevelId) ?? null,
    [availableLevels, selectedLevelId],
  );
  const isBusy = busyAction !== null;

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

  function applyRoomGeometry(nextVertices: Vertex[], nextWalls: Wall[]) {
    setVertices(nextVertices);
    setWallDefinitions(syncWallsWithVertices(nextVertices, nextWalls));
  }

  function handleVerticesChange(nextVertices: Vertex[]) {
    setVertices(nextVertices);
    setWallDefinitions((currentWalls) => syncWallsWithVertices(nextVertices, currentWalls));
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

  async function refreshProjects(preferredProjectId?: string): Promise<Project[]> {
    const nextProjects = await listProjects();
    setAvailableProjects(nextProjects);
    setSelectedProjectId((currentProjectId) => {
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
      return [];
    }

    const nextLevels = await listLevelsByProject(trimmedProjectId);
    setAvailableLevels(nextLevels);
    setAvailableRooms([]);
    setRoomIdInput('');
    setSelectedLevelId((currentLevelId) => {
      const candidateLevelId = preferredLevelId ?? currentLevelId;
      return nextLevels.some((level) => level.id === candidateLevelId)
        ? candidateLevelId
        : nextLevels[0]?.id ?? EMPTY_LEVEL_ID;
    });
    return nextLevels;
  }

  async function refreshRoomsForLevel(levelId: string): Promise<Room[]> {
    const trimmedLevelId = levelId.trim();

    if (!trimmedLevelId) {
      setAvailableRooms([]);
      return [];
    }

    const nextRooms = await listRoomsByLevel(trimmedLevelId);
    setAvailableRooms(nextRooms);
    return nextRooms;
  }

  function resetDraftRoom() {
    const draft = createDraftRoomGeometry();
    setActiveRoom(null);
    setRoomIdInput('');
    setRoomNameInput(DEFAULT_ROOM_NAME);
    applyRoomGeometry(draft.vertices, draft.walls);
    setSelectedWallIndex(null);
  }

  const handleSelectedProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProjectId(event.target.value);
    setSelectedLevelId(EMPTY_LEVEL_ID);
    setAvailableLevels([]);
    setAvailableRooms([]);
    resetDraftRoom();
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSelectedLevelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLevelId(event.target.value);
    setRoomIdInput('');
    setAvailableRooms([]);
    resetDraftRoom();
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

      await refreshProjects(createdProject.id);
      setNewProjectNameInput(DEFAULT_PROJECT_NAME);
      setSelectedProjectId(createdProject.id);
      setAvailableLevels([]);
      setSelectedLevelId(EMPTY_LEVEL_ID);
      setAvailableRooms([]);
      resetDraftRoom();
      setStatusMessage(`Projet créé : ${createdProject.name}.`);
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
      const levelName = newLevelNameInput.trim();

      if (!selectedProjectId) {
        throw new Error('Sélectionne un projet avant de créer un niveau.');
      }

      if (!isUuid(selectedProjectId)) {
        throw new Error('Le projet sélectionné est invalide.');
      }

      if (!levelName) {
        throw new Error('Renseigne un nom avant de créer le niveau.');
      }

      const createdLevel = await createLevel({
        projectId: selectedProjectId,
        name: levelName,
      });

      await refreshLevelsForProject(createdLevel.projectId, createdLevel.id);
      setNewLevelNameInput(DEFAULT_LEVEL_NAME);
      setSelectedLevelId(createdLevel.id);
      setAvailableRooms([]);
      setRoomIdInput('');
      setStatusMessage(`Niveau créé : ${createdLevel.name}.`);
    });
  };

  const handleListRooms = () => {
    void runRoomAction('list', async () => {
      if (!selectedLevelId) {
        throw new Error('Sélectionne un niveau avant de lister les pièces.');
      }

      if (!isUuid(selectedLevelId)) {
        throw new Error('Le niveau sélectionné est invalide.');
      }

      const nextRooms = await refreshRoomsForLevel(selectedLevelId);
      if (nextRooms.length > 0 && !roomIdInput.trim()) {
        setRoomIdInput(nextRooms[0].id);
      }

      setStatusMessage(
        nextRooms.length === 0
          ? 'Aucune pièce trouvée pour ce niveau.'
          : `${nextRooms.length} pièce(s) trouvée(s) pour ce niveau.`,
      );
    });
  };

  const handleCreateRoom = () => {
    void runRoomAction('create', async () => {
      const roomName = roomNameInput.trim();

      if (!selectedLevelId) {
        throw new Error('Sélectionne un niveau avant de créer la pièce.');
      }

      if (!isUuid(selectedLevelId)) {
        throw new Error('Le niveau sélectionné est invalide.');
      }

      if (!roomName) {
        throw new Error('Renseigne un nom avant de créer la pièce.');
      }

      const createdRoom = await createRoom({
        levelId: selectedLevelId,
        name: roomName,
      });

      const savedVertices = await replaceRoomVertices(
        createdRoom.id,
        prepareVerticesForRoom(vertices, createdRoom.id, true),
      );
      const savedWalls = await replaceRoomWalls(
        createdRoom.id,
        savedVertices,
        remapWallsToVertices(vertices, savedVertices, wallDefinitions),
      );

      await refreshRoomsForLevel(createdRoom.levelId);

      setActiveRoom(createdRoom);
      setRoomIdInput(createdRoom.id);
      setRoomNameInput(createdRoom.name);
      applyRoomGeometry(savedVertices, savedWalls);
      setSelectedWallIndex(null);
      setStatusMessage(`Pièce créée : ${createdRoom.name}.`);
    });
  };

  const handleLoadRoom = () => {
    void runRoomAction('load', async () => {
      const roomId = roomIdInput.trim();
      if (!roomId) {
        throw new Error('Sélectionne ou saisis une room id à charger.');
      }

      if (!isUuid(roomId)) {
        throw new Error('La room id doit être un UUID valide.');
      }

      const snapshot = await loadRoomSnapshot(roomId);
      const level = await getLevel(snapshot.room.levelId);

      await refreshProjects(level.projectId);
      await refreshLevelsForProject(level.projectId, level.id);
      await refreshRoomsForLevel(snapshot.room.levelId);

      setActiveRoom(snapshot.room);
      setSelectedProjectId(level.projectId);
      setSelectedLevelId(level.id);
      setRoomIdInput(snapshot.room.id);
      setRoomNameInput(snapshot.room.name);
      applyRoomGeometry(snapshot.vertices, snapshot.walls);
      setSelectedWallIndex(null);
      setStatusMessage(`Pièce chargée : ${snapshot.room.name}.`);
    });
  };

  const handleSaveRoom = () => {
    void runRoomAction('save', async () => {
      if (!activeRoom) {
        throw new Error('Charge ou crée une pièce avant de l’enregistrer.');
      }

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

      const savedRoom = await updateRoom({
        ...activeRoom,
        levelId: selectedLevelId,
        name: roomName,
      });

      const savedVertices = await replaceRoomVertices(
        savedRoom.id,
        prepareVerticesForRoom(vertices, savedRoom.id),
      );
      const savedWalls = await replaceRoomWalls(
        savedRoom.id,
        savedVertices,
        remapWallsToVertices(vertices, savedVertices, wallDefinitions),
      );

      await refreshRoomsForLevel(savedRoom.levelId);

      setActiveRoom(savedRoom);
      setRoomIdInput(savedRoom.id);
      setRoomNameInput(savedRoom.name);
      applyRoomGeometry(savedVertices, savedWalls);
      setStatusMessage(`Pièce enregistrée : ${savedRoom.name}.`);
    });
  };

  const handleDeleteRoom = () => {
    void runRoomAction('delete', async () => {
      const roomId = roomIdInput.trim() || activeRoom?.id;
      if (!roomId) {
        throw new Error('Sélectionne ou saisis une room id à supprimer.');
      }

      if (!isUuid(roomId)) {
        throw new Error('La room id doit être un UUID valide.');
      }

      const nextLevelId = activeRoom?.levelId ?? selectedLevelId;
      await deleteRoom(roomId);

      if (nextLevelId && isUuid(nextLevelId)) {
        await refreshRoomsForLevel(nextLevelId);
      } else {
        setAvailableRooms([]);
      }

      resetDraftRoom();
      setStatusMessage('Pièce supprimée. Le canvas est revenu sur un brouillon local.');
    });
  };

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', color: '#24292f' }}>
      <header style={{ marginBottom: 16 }}>
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
                Crée un projet, liste les projets existants, puis sélectionne le projet actif par son nom avant de gérer ses niveaux.
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
                <button type="button" onClick={handleCreateProject} disabled={isBusy}>
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
                Crée un niveau dans le projet actif, charge les niveaux de ce projet, puis sélectionne le niveau par son nom pour travailler sur les pièces associées.
              </p>

              <p style={{ marginTop: 0 }}>
                <strong>Projet :</strong>{' '}
                {selectedProject ? selectedProject.name : 'aucun projet sélectionné'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  Projet
                  <select
                    value={selectedProjectId}
                    onChange={handleSelectedProjectChange}
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
                    disabled={isBusy || availableLevels.length === 0}
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
                <button type="button" onClick={handleCreateLevel} disabled={isBusy || !selectedProjectId}>
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
                Crée une pièce à partir du dessin courant, recharge-la par son identifiant, puis enregistre ou supprime la version persistée.
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
                  Niveau
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
                  Nom de la pièce
                  <input
                    value={roomNameInput}
                    onChange={(event) => setRoomNameInput(event.target.value)}
                    placeholder="Cuisine, salon, chambre..."
                    disabled={isBusy}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                  Room ID
                  <input
                    value={roomIdInput}
                    onChange={(event) => setRoomIdInput(event.target.value)}
                    placeholder="uuid de la pièce"
                    disabled={isBusy}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={handleListRooms} disabled={isBusy || !selectedLevelId}>
                  {busyAction === 'list' ? 'Chargement...' : 'Lister le niveau'}
                </button>
                <button type="button" onClick={handleCreateRoom} disabled={isBusy || !selectedLevelId}>
                  {busyAction === 'create' ? 'Création...' : 'Créer'}
                </button>
                <button type="button" onClick={handleLoadRoom} disabled={isBusy}>
                  {busyAction === 'load' ? 'Chargement...' : 'Charger'}
                </button>
                <button type="button" onClick={handleSaveRoom} disabled={isBusy || activeRoom === null || !selectedLevelId}>
                  {busyAction === 'save' ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button type="button" onClick={handleDeleteRoom} disabled={isBusy || (!roomIdInput.trim() && activeRoom === null)}>
                  {busyAction === 'delete' ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>

              <label style={{ display: 'grid', gap: 6, marginTop: 16 }}>
                Pièces trouvées pour ce niveau
                <select
                  value={roomIdInput}
                  onChange={(event) => setRoomIdInput(event.target.value)}
                  disabled={isBusy || availableRooms.length === 0}
                >
                  <option value="">
                    {availableRooms.length === 0 ? 'Aucune pièce chargée pour ce niveau' : 'Sélectionner une pièce'}
                  </option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} — {room.id}
                    </option>
                  ))}
                </select>
              </label>

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
        selectedWallIndex={selectedWallIndex}
        onVerticesChange={handleVerticesChange}
        onWallSelect={setSelectedWallIndex}
      />

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

              <p style={{ color: '#57606a', fontSize: 14, marginBottom: 0 }}>
                Clique sur le cartouche du mur dans le plan pour modifier sa longueur. Les propriétés métier sont persistées lors de l’enregistrement de la pièce.
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
    </main>
  );
}
