import React, { useEffect, useMemo, useState } from 'react';
import type { Level, Project } from '../../../shared/src/types';
import { RoomPreview } from '../components/RoomPreview';
import { countExteriorWalls, getRoomAreaM2 } from '../lib/roomMetrics';
import { hasSupabaseConfig } from '../lib/supabase';
import { createLevel, listLevelsByProject } from '../services/levels';
import { createProject, listProjects } from '../services/projects';
import {
  listRoomsByLevel,
  loadRoomSnapshot,
} from '../services/rooms';
import type { RoomSnapshot } from '../services/rooms';

const EMPTY_ID = '';
const DEFAULT_PROJECT_NAME = 'Mon projet';
const DEFAULT_LEVEL_NAME = 'Nouveau niveau';
const AREA_FORMATTER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const COUNT_FORMATTER = new Intl.NumberFormat('fr-FR');
const CARD_ACCENT_COLORS = ['#d47a52', '#8fa35d', '#5b88c7', '#d4a94b', '#8c7bc8', '#c27b98'];
const DASHBOARD_NAV_ITEMS = [
  { shortLabel: 'TB', label: 'Tableau de bord', isActive: true },
  { shortLabel: 'ET', label: 'Étages', isActive: false },
  { shortLabel: 'PC', label: 'Pièces', isActive: false },
  { shortLabel: 'TV', label: 'Travaux', isActive: false },
  { shortLabel: 'DC', label: 'Documents', isActive: false },
  { shortLabel: 'PH', label: 'Photos', isActive: false },
  { shortLabel: 'TK', label: 'Tâches', isActive: false },
  { shortLabel: 'IA', label: 'Assistant IA', isActive: false },
];
export interface DashboardRoomTarget {
  projectId: string;
  levelId: string;
  roomId: string;
}

export interface DashboardProjectTarget {
  projectId: string;
  projectName: string;
  focusedLevelId?: string;
}

export interface DashboardLevelRoomSummary {
  roomId: string;
  name: string;
  areaM2: number;
  wallCount: number;
  openingsCount: number;
}

export interface DashboardLevelTarget {
  projectId: string;
  projectName: string;
  levelId: string;
  levelName: string;
  rooms: DashboardLevelRoomSummary[];
  totalAreaM2: number;
  focusedRoomId?: string;
}

type HistoryUpdateMode = 'push' | 'replace';

interface RoomsDashboardProps {
  initialProjectId?: string;
  initialLevelId?: string;
  initialRoomId?: string;
  onContextChange?: (target: DashboardRoomTarget, historyMode?: HistoryUpdateMode) => void;
  onOpenRoom?: (target: DashboardRoomTarget) => void;
  onOpenLevelOverview?: (target: DashboardLevelTarget) => void;
  onOpenProjectOverview?: (target: DashboardProjectTarget) => void;
}

type DashboardCard = {
  snapshot: RoomSnapshot;
  areaM2: number;
  wallCount: number;
  openingsCount: number;
  flooringLabel: string;
  accentColor: string;
};

function formatArea(areaM2: number): string {
  return `${AREA_FORMATTER.format(areaM2)} m²`;
}

function formatCount(value: number): string {
  return COUNT_FORMATTER.format(value);
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

function pickExistingId<T extends { id: string }>(items: T[], ...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    if (candidate && items.some((item) => item.id === candidate)) {
      return candidate;
    }
  }

  return items[0]?.id ?? EMPTY_ID;
}

function pickExistingRoomId(snapshots: RoomSnapshot[], ...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    if (candidate && snapshots.some((snapshot) => snapshot.room.id === candidate)) {
      return candidate;
    }
  }

  return snapshots[0]?.room.id ?? EMPTY_ID;
}

function buildSelectionMessage(levelName: string, roomCount: number): string {
  return roomCount === 0
    ? `Niveau actif : ${levelName}. Aucune pièce trouvée pour l’instant.`
    : `${roomCount} pièce(s) chargée(s) pour ${levelName}.`;
}

function buildAutoName(prefix: string, existingNames: string[]): string {
  const normalizedNames = new Set(existingNames.map((name) => name.trim().toLocaleLowerCase('fr-FR')));
  const normalizedPrefix = prefix.toLocaleLowerCase('fr-FR');

  if (!normalizedNames.has(normalizedPrefix)) {
    return prefix;
  }

  let suffix = 2;
  while (normalizedNames.has(`${normalizedPrefix} ${suffix}`)) {
    suffix += 1;
  }

  return `${prefix} ${suffix}`;
}

export function RoomsDashboard({
  initialProjectId,
  initialLevelId,
  initialRoomId,
  onContextChange,
  onOpenRoom,
  onOpenLevelOverview,
  onOpenProjectOverview,
}: RoomsDashboardProps) {
  const supabaseConfigured = hasSupabaseConfig();

  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [availableLevels, setAvailableLevels] = useState<Level[]>([]);
  const [roomSnapshots, setRoomSnapshots] = useState<RoomSnapshot[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId ?? EMPTY_ID);
  const [activeLevelId, setActiveLevelId] = useState(initialLevelId ?? EMPTY_ID);
  const [highlightedRoomId, setHighlightedRoomId] = useState(initialRoomId ?? EMPTY_ID);
  const [newProjectNameInput, setNewProjectNameInput] = useState('');
  const [newLevelNameInput, setNewLevelNameInput] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);

  const selectedProject = useMemo(
    () => availableProjects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, availableProjects],
  );
  const selectedLevel = useMemo(
    () => availableLevels.find((level) => level.id === activeLevelId) ?? null,
    [activeLevelId, availableLevels],
  );
  const roomCards = useMemo<DashboardCard[]>(() => roomSnapshots.map((snapshot, index) => ({
    snapshot,
    areaM2: getRoomAreaM2(snapshot.vertices),
    wallCount: snapshot.walls.length,
    openingsCount: snapshot.openings.length,
    flooringLabel: snapshot.room.notes?.trim() ? snapshot.room.notes : 'Revêtement à renseigner',
    accentColor: CARD_ACCENT_COLORS[index % CARD_ACCENT_COLORS.length],
  })), [roomSnapshots]);
  const totalAreaM2 = useMemo(
    () => roomCards.reduce((sum, card) => sum + card.areaM2, 0),
    [roomCards],
  );
  const totalExteriorWallsCount = useMemo(() => countExteriorWalls(roomSnapshots), [roomSnapshots]);
  const totalOpeningsCount = useMemo(
    () => roomCards.reduce((sum, card) => sum + card.openingsCount, 0),
    [roomCards],
  );
  const isBusy = busyAction !== null;
  const isLoadingRooms = ['bootstrap', 'refresh', 'select-project', 'select-level'].includes(busyAction ?? '');

  function notifyContextChange(target: DashboardRoomTarget, historyMode: HistoryUpdateMode = 'replace') {
    onContextChange?.(target, historyMode);
  }

  async function runDashboardAction(actionLabel: string, action: () => Promise<void>) {
    setBusyAction(actionLabel);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await action();
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshProjects(preferredProjectId?: string): Promise<Project[]> {
    const nextProjects = await listProjects();
    setAvailableProjects(nextProjects);
    setActiveProjectId((currentProjectId) => pickExistingId(nextProjects, preferredProjectId, currentProjectId));
    return nextProjects;
  }

  async function refreshLevelsForProject(projectId: string, preferredLevelId?: string): Promise<Level[]> {
    const trimmedProjectId = projectId.trim();

    if (!trimmedProjectId) {
      setAvailableLevels([]);
      setActiveLevelId(EMPTY_ID);
      setRoomSnapshots([]);
      setHighlightedRoomId(EMPTY_ID);
      return [];
    }

    const nextLevels = await listLevelsByProject(trimmedProjectId);
    setAvailableLevels(nextLevels);
    setActiveLevelId((currentLevelId) => pickExistingId(nextLevels, preferredLevelId, currentLevelId));
    return nextLevels;
  }

  async function refreshRoomSnapshotsForLevel(
    levelId: string,
    preferredRoomId?: string,
  ): Promise<RoomSnapshot[]> {
    const trimmedLevelId = levelId.trim();

    if (!trimmedLevelId) {
      setRoomSnapshots([]);
      setHighlightedRoomId(EMPTY_ID);
      return [];
    }

    const rooms = await listRoomsByLevel(trimmedLevelId);
    const nextSnapshots = await Promise.all(rooms.map((room) => loadRoomSnapshot(room.id)));
    setRoomSnapshots(nextSnapshots);
    setHighlightedRoomId((currentRoomId) => pickExistingRoomId(nextSnapshots, preferredRoomId, currentRoomId));
    return nextSnapshots;
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      return;
    }

    void runDashboardAction('bootstrap', async () => {
      const nextProjects = await refreshProjects(initialProjectId);
      const nextProjectId = pickExistingId(nextProjects, initialProjectId);

      if (!nextProjectId) {
        setAvailableLevels([]);
        setRoomSnapshots([]);
        notifyContextChange({ projectId: EMPTY_ID, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'replace');
        setStatusMessage('Aucun projet trouvé. Crée un projet pour commencer à structurer le tableau de bord.');
        return;
      }

      const nextLevels = await refreshLevelsForProject(nextProjectId, initialLevelId);
      const nextLevelId = pickExistingId(nextLevels, initialLevelId);

      if (!nextLevelId) {
        setRoomSnapshots([]);
        notifyContextChange({ projectId: nextProjectId, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'replace');
        setStatusMessage('Projet actif prêt. Aucun niveau trouvé pour ce projet.');
        return;
      }

      const nextSnapshots = await refreshRoomSnapshotsForLevel(nextLevelId, initialRoomId);
      notifyContextChange({
        projectId: nextProjectId,
        levelId: nextLevelId,
        roomId: pickExistingRoomId(nextSnapshots, initialRoomId),
      }, 'replace');
      const nextLevel = nextLevels.find((level) => level.id === nextLevelId);
      setStatusMessage(buildSelectionMessage(nextLevel?.name ?? 'le niveau actif', nextSnapshots.length));
    });
  }, [supabaseConfigured, initialProjectId, initialLevelId, initialRoomId]);

  const handleRefresh = () => {
    void runDashboardAction('refresh', async () => {
      const nextProjects = await refreshProjects(activeProjectId || initialProjectId);
      const nextProjectId = pickExistingId(nextProjects, activeProjectId, initialProjectId);

      if (!nextProjectId) {
        setAvailableLevels([]);
        setRoomSnapshots([]);
        notifyContextChange({ projectId: EMPTY_ID, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'replace');
        setStatusMessage('Aucun projet trouvé.');
        return;
      }

      const nextLevels = await refreshLevelsForProject(nextProjectId, activeLevelId || initialLevelId);
      const nextLevelId = pickExistingId(nextLevels, activeLevelId, initialLevelId);

      if (!nextLevelId) {
        setRoomSnapshots([]);
        notifyContextChange({ projectId: nextProjectId, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'replace');
        setStatusMessage('Projet actualisé. Aucun niveau trouvé pour ce projet.');
        return;
      }

      const nextSnapshots = await refreshRoomSnapshotsForLevel(nextLevelId, highlightedRoomId || initialRoomId);
      notifyContextChange({
        projectId: nextProjectId,
        levelId: nextLevelId,
        roomId: pickExistingRoomId(nextSnapshots, highlightedRoomId || initialRoomId),
      }, 'replace');
      const nextLevel = nextLevels.find((level) => level.id === nextLevelId);
      setStatusMessage(buildSelectionMessage(nextLevel?.name ?? 'le niveau actif', nextSnapshots.length));
    });
  };

  const handleActiveProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProjectId = event.target.value;
    setActiveProjectId(nextProjectId);
    setAvailableLevels([]);
    setRoomSnapshots([]);
    setHighlightedRoomId(EMPTY_ID);

    if (!supabaseConfigured) {
      notifyContextChange({ projectId: nextProjectId, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'push');
      return;
    }

    void runDashboardAction('select-project', async () => {
      const nextLevels = await refreshLevelsForProject(nextProjectId);
      const nextLevelId = pickExistingId(nextLevels);

      if (!nextLevelId) {
        notifyContextChange({ projectId: nextProjectId, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'push');
        setStatusMessage('Aucun niveau trouvé pour le projet actif.');
        return;
      }

      const nextSnapshots = await refreshRoomSnapshotsForLevel(nextLevelId);
      notifyContextChange({
        projectId: nextProjectId,
        levelId: nextLevelId,
        roomId: pickExistingRoomId(nextSnapshots),
      }, 'push');
      const nextLevel = nextLevels.find((level) => level.id === nextLevelId);
      setStatusMessage(buildSelectionMessage(nextLevel?.name ?? 'le niveau actif', nextSnapshots.length));
    });
  };

  const handleActiveLevelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLevelId = event.target.value;
    setActiveLevelId(nextLevelId);
    setRoomSnapshots([]);
    setHighlightedRoomId(EMPTY_ID);

    if (!supabaseConfigured) {
      notifyContextChange({ projectId: activeProjectId, levelId: nextLevelId, roomId: EMPTY_ID }, 'push');
      return;
    }

    void runDashboardAction('select-level', async () => {
      const nextSnapshots = await refreshRoomSnapshotsForLevel(nextLevelId);
      notifyContextChange({
        projectId: activeProjectId,
        levelId: nextLevelId,
        roomId: pickExistingRoomId(nextSnapshots),
      }, 'push');
      const nextLevel = availableLevels.find((level) => level.id === nextLevelId);
      setStatusMessage(buildSelectionMessage(nextLevel?.name ?? 'le niveau actif', nextSnapshots.length));
    });
  };

  const handleCreateProject = () => {
    void runDashboardAction('create-project', async () => {
      const projectName = newProjectNameInput.trim() || DEFAULT_PROJECT_NAME;

      const createdProject = await createProject({
        name: projectName,
      });
      await refreshProjects(createdProject.id);
      await refreshLevelsForProject(createdProject.id);
      notifyContextChange({ projectId: createdProject.id, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'push');
      setNewProjectNameInput('');
      setIsProjectModalOpen(false);
      setStatusMessage(`Projet créé : ${createdProject.name}. Ajoute maintenant un niveau pour commencer.`);
    });
  };

  const handleCreateLevel = () => {
    void runDashboardAction('create-level', async () => {
      const projectId = activeProjectId.trim();
      const levelName = newLevelNameInput.trim() || buildAutoName(
        DEFAULT_LEVEL_NAME,
        availableLevels.map((level) => level.name),
      );

      if (!projectId) {
        throw new Error('Choisis un projet actif avant d’ajouter un niveau.');
      }

      const createdLevel = await createLevel({
        projectId,
        name: levelName,
      });
      await refreshLevelsForProject(projectId, createdLevel.id);
      const nextSnapshots = await refreshRoomSnapshotsForLevel(createdLevel.id);
      notifyContextChange({
        projectId,
        levelId: createdLevel.id,
        roomId: pickExistingRoomId(nextSnapshots),
      }, 'push');
      setNewLevelNameInput('');
      setIsLevelModalOpen(false);
      setStatusMessage(`Niveau créé : ${createdLevel.name}. Tu peux maintenant y ajouter une pièce.`);
    });
  };

  const handleCreateRoom = () => {
    const levelId = activeLevelId.trim();

    if (!levelId) {
      setErrorMessage('Choisis un niveau actif avant d’ajouter une pièce.');
      return;
    }

    if (!selectedProject || !onOpenRoom) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage('Brouillon local ouvert. La pièce sera créée uniquement quand tu l’enregistreras depuis l’éditeur.');
    setHighlightedRoomId(EMPTY_ID);
    onOpenRoom({
      projectId: selectedProject.id,
      levelId,
      roomId: EMPTY_ID,
    });
  };

  const handleOpenLevelOverview = () => {
    if (!selectedProject || !selectedLevel || !onOpenLevelOverview) {
      return;
    }

    onOpenLevelOverview({
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      levelId: selectedLevel.id,
      levelName: selectedLevel.name,
      totalAreaM2,
      focusedRoomId: highlightedRoomId || undefined,
      rooms: roomCards.map((card) => ({
        roomId: card.snapshot.room.id,
        name: card.snapshot.room.name,
        areaM2: card.areaM2,
        wallCount: card.wallCount,
        openingsCount: card.openingsCount,
      })),
    });
  };

  const handleOpenRoom = (roomId: string) => {
    if (!selectedProject || !selectedLevel || !onOpenRoom) {
      return;
    }

    setHighlightedRoomId(roomId);
    onOpenRoom({
      projectId: selectedProject.id,
      levelId: selectedLevel.id,
      roomId,
    });
  };

  const handleOpenProjectOverview = () => {
    if (!selectedProject || !onOpenProjectOverview) {
      return;
    }

    onOpenProjectOverview({
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      focusedLevelId: selectedLevel?.id,
    });
  };

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brandBlock">
          <div className="dashboard-brandMark">BB</div>
          <div>
            <h1 className="dashboard-brandTitle">BatiBrain</h1>
          </div>
        </div>

        <div className="dashboard-profileCard">
          <div className="dashboard-profileAvatar">PM</div>
          <div>
            <strong>Profil projet</strong>
            <p className="dashboard-userMeta">Propriétaire</p>
          </div>
        </div>

        <nav className="dashboard-nav">
          {DASHBOARD_NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`dashboard-navItem ${item.isActive ? 'is-active' : ''}`}
              disabled={!item.isActive}
            >
              <span className="dashboard-navIcon">{item.shortLabel}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <h2 className="dashboard-pageTitle">Tableau de bord</h2>
        </header>

        <section className="dashboard-contentPanel">
          <div className="dashboard-projectBar">
            <label className="dashboard-field dashboard-field--project">
              <span>Projet</span>
              <select
                value={activeProjectId}
                onChange={handleActiveProjectChange}
                disabled={!supabaseConfigured || isBusy || availableProjects.length === 0}
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

            <div className="dashboard-projectActions">
              <button
                type="button"
                className="dashboard-createButton"
                onClick={() => setIsLevelModalOpen(true)}
                disabled={!supabaseConfigured || isBusy || !selectedProject}
              >
                Ajouter un niveau
              </button>
            </div>
          </div>

          <div className="dashboard-levelHeader">
            <div className="dashboard-levelActions">
              <label className="dashboard-field dashboard-field--compact">
                <span>Niveau</span>
                <select
                  value={activeLevelId}
                  onChange={handleActiveLevelChange}
                  disabled={!supabaseConfigured || isBusy || availableLevels.length === 0}
                >
                  <option value="">
                    {availableLevels.length === 0 ? 'Aucun niveau chargé' : 'Sélectionner un niveau'}
                  </option>
                  {availableLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </label>

                <div className="dashboard-levelButtons">
                  <button
                    type="button"
                    className="dashboard-viewButton"
                    onClick={handleOpenLevelOverview}
                    disabled={!selectedProject || !selectedLevel}
                  >
                    Vue d'ensemble
                  </button>

                  <button
                    type="button"
                    className="dashboard-createButton"
                    onClick={handleCreateRoom}
                    disabled={!supabaseConfigured || isBusy || !selectedLevel}
                  >
                    {busyAction === 'create-room' ? 'Création...' : 'Ajouter une pièce'}
                  </button>
                </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="dashboard-banner dashboard-banner--error">{errorMessage}</div>
          ) : null}

          {!supabaseConfigured ? (
            <div className="dashboard-emptyState">
              <h3>Configuration requise</h3>
              <p>
                Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans web/.env.local pour charger les projets, niveaux et pièces.
              </p>
            </div>
          ) : availableProjects.length === 0 ? (
            <div className="dashboard-emptyState">
              <h3>Aucun projet pour l’instant</h3>
              <p>Crée un premier projet pour afficher son tableau de bord.</p>
              <button
                type="button"
                className="dashboard-createButton"
                onClick={() => setIsProjectModalOpen(true)}
                disabled={isBusy}
              >
                Créer un projet
              </button>
            </div>
          ) : !selectedLevel ? (
            <div className="dashboard-emptyState">
              <h3>Aucun niveau actif</h3>
              <p>Ajoute un niveau au projet actif pour commencer à y ranger les pièces.</p>
              <button
                type="button"
                className="dashboard-createButton"
                onClick={() => setIsLevelModalOpen(true)}
                disabled={isBusy}
              >
                Ajouter un niveau
              </button>
            </div>
          ) : isLoadingRooms && roomCards.length === 0 ? (
            <div className="dashboard-roomGrid">
              {Array.from({ length: 6 }).map((_, index) => (
                <article key={`dashboard-skeleton-${index}`} className="room-card room-card--skeleton">
                  <div className="dashboard-skeletonPreview" />
                  <div className="room-card__body">
                    <div className="dashboard-skeletonBar dashboard-skeletonBar--title" />
                    <div className="dashboard-skeletonBar dashboard-skeletonBar--short" />
                    <div className="dashboard-skeletonBar" />
                  </div>
                </article>
              ))}
            </div>
          ) : roomCards.length === 0 ? (
            <div className="dashboard-emptyState">
              <h3>Aucune pièce sur ce niveau</h3>
              <p>Ajoute une première pièce pour lancer l’édition géométrique de cet étage.</p>
              <button
                type="button"
                className="dashboard-createButton"
                onClick={handleCreateRoom}
                disabled={isBusy}
              >
                Ajouter une pièce
              </button>
            </div>
          ) : (
            <div className="dashboard-roomGrid">
              {roomCards.map((card) => {
                const roomId = card.snapshot.room.id;

                return (
                  <button
                    key={roomId}
                    type="button"
                    className={`room-card ${highlightedRoomId === roomId ? 'is-active' : ''}`}
                    onClick={() => handleOpenRoom(roomId)}
                    disabled={!onOpenRoom}
                  >
                    <RoomPreview
                      vertices={card.snapshot.vertices}
                      walls={card.snapshot.walls}
                      openings={card.snapshot.openings}
                      accentColor={card.accentColor}
                    />

                    <div className="room-card__body">
                      <div className="room-card__titleRow">
                        <div>
                          <h4 className="room-card__title">{card.snapshot.room.name}</h4>
                          <p className="room-card__area">{formatArea(card.areaM2)}</p>
                        </div>

                        <span className="room-card__badge">
                          {formatCount(card.openingsCount)} ouverture(s)
                        </span>
                      </div>

                      <div className="room-card__metaBlock">
                        <p className="room-card__metaLabel">Revêtement</p>
                        <p className="room-card__finish">{card.flooringLabel}</p>
                      </div>

                      <div className="room-card__stats">
                        <span>{formatCount(card.wallCount)} murs</span>
                        <span>{formatCount(card.openingsCount)} ouvertures</span>
                      </div>

                      <span className="room-card__cta">Ouvrir la pièce</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="dashboard-summaryStrip">
            <article className="summary-stat">
              <span className="summary-stat__label">Pièces</span>
              <strong>{formatCount(roomCards.length)}</strong>
            </article>

            <article className="summary-stat">
              <span className="summary-stat__label">Surface totale</span>
              <strong>{formatArea(totalAreaM2)}</strong>
            </article>

            <article className="summary-stat">
              <span className="summary-stat__label">Murs extérieurs</span>
              <strong>{formatCount(totalExteriorWallsCount)}</strong>
            </article>

            <article className="summary-stat">
              <span className="summary-stat__label">Ouvertures</span>
              <strong>{formatCount(totalOpeningsCount)}</strong>
            </article>

            <button
              type="button"
              className="dashboard-viewButton dashboard-summaryButton"
              onClick={handleOpenProjectOverview}
              disabled={!selectedProject || !onOpenProjectOverview}
            >
              Voir le plan global
            </button>
          </div>
        </section>

        {isProjectModalOpen ? (
          <div className="dashboard-modalBackdrop" role="presentation" onClick={() => setIsProjectModalOpen(false)}>
            <section className="dashboard-modalCard" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <p className="dashboard-eyebrow">Création</p>
              <h3 className="dashboard-panelTitle">Nouveau projet</h3>
              <label className="dashboard-field">
                <span>Nom du projet</span>
                <input
                  value={newProjectNameInput}
                  onChange={(event) => setNewProjectNameInput(event.target.value)}
                  placeholder="Maison principale, annexe, appartement..."
                  disabled={!supabaseConfigured || isBusy}
                />
              </label>

              <div className="dashboard-modalActions">
                <button type="button" className="dashboard-outlineButton" onClick={() => setIsProjectModalOpen(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="dashboard-createButton"
                  onClick={handleCreateProject}
                  disabled={!supabaseConfigured || isBusy}
                >
                  {busyAction === 'create-project' ? 'Création...' : 'Créer le projet'}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {isLevelModalOpen ? (
          <div className="dashboard-modalBackdrop" role="presentation" onClick={() => setIsLevelModalOpen(false)}>
            <section className="dashboard-modalCard" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <p className="dashboard-eyebrow">Création</p>
              <h3 className="dashboard-panelTitle">Nouveau niveau</h3>
              <p className="dashboard-subtitle">
                {selectedProject ? `Projet cible : ${selectedProject.name}` : 'Sélectionne d’abord un projet actif.'}
              </p>
              <label className="dashboard-field">
                <span>Nom du niveau</span>
                <input
                  value={newLevelNameInput}
                  onChange={(event) => setNewLevelNameInput(event.target.value)}
                  placeholder="Rez-de-chaussée, étage, sous-sol..."
                  disabled={!supabaseConfigured || isBusy}
                />
              </label>

              <div className="dashboard-modalActions">
                <button type="button" className="dashboard-outlineButton" onClick={() => setIsLevelModalOpen(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="dashboard-createButton"
                  onClick={handleCreateLevel}
                  disabled={!supabaseConfigured || isBusy || !selectedProject}
                >
                  {busyAction === 'create-level' ? 'Création...' : 'Créer le niveau'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}