import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatLengthCm } from '../domain/geometry';
import type { Level, Opening, Project } from '../domain/types';
import { LevelPlanCanvas } from '../components/LevelPlanCanvas';
import { DashboardLayout } from '../components/DashboardLayout';
import { exportDetailedLevelPlanPdf, exportSimpleLevelPlanPdf } from '../lib/levelPlanPdf';
import { getLevelMetrics } from '../lib/roomMetrics';
import { hasSupabaseConfig } from '../lib/supabase';
import { createLevel, listLevelsByProject } from '../services/levels';
import { listProjects } from '../services/projects';
import { listRoomsByLevel, loadRoomSnapshot } from '../services/rooms';
import type { RoomSnapshot } from '../services/rooms';
import type {
  DashboardLevelTarget,
  DashboardRoomTarget,
} from './RoomsDashboard';

const EMPTY_ID = '';
const DEFAULT_LEVEL_NAME = 'Nouveau niveau';
const AREA_FORMATTER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const COUNT_FORMATTER = new Intl.NumberFormat('fr-FR');

type HistoryUpdateMode = 'push' | 'replace';

interface LevelOverviewSummaryProps {
  target: DashboardLevelTarget;
  onBack: () => void;
  onContextChange?: (target: DashboardRoomTarget, historyMode?: HistoryUpdateMode) => void;
  onOpenRoom?: (roomId: string) => void;
}

function formatArea(areaM2: number): string {
  return `${AREA_FORMATTER.format(areaM2)} m²`;
}

function formatCount(value: number): string {
  return COUNT_FORMATTER.format(value);
}

function formatOptionalHeight(heightCm: number | null): string {
  return heightCm === null ? 'n/d' : formatLengthCm(heightCm);
}

function formatOpeningType(type: Opening['type']): string {
  switch (type) {
    case 'door':
      return 'Porte';
    case 'window':
      return 'Fenêtre';
    default:
      return 'Ouverture';
  }
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

export function LevelOverviewSummary({
  target,
  onBack,
  onContextChange,
  onOpenRoom,
}: LevelOverviewSummaryProps) {
  const supabaseConfigured = hasSupabaseConfig();
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [availableLevels, setAvailableLevels] = useState<Level[]>([]);
  const [roomSnapshots, setRoomSnapshots] = useState<RoomSnapshot[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(target.projectId);
  const [activeLevelId, setActiveLevelId] = useState(target.levelId);
  const [focusedRoomId, setFocusedRoomId] = useState(target.focusedRoomId ?? EMPTY_ID);
  const [newLevelNameInput, setNewLevelNameInput] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportingSimplePdf, setIsExportingSimplePdf] = useState(false);
  const [isExportingDetailedPdf, setIsExportingDetailedPdf] = useState(false);
  const levelPlanSvgRef = useRef<SVGSVGElement | null>(null);

  const selectedProject = useMemo(
    () => availableProjects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, availableProjects],
  );
  const selectedLevel = useMemo(
    () => availableLevels.find((level) => level.id === activeLevelId) ?? null,
    [activeLevelId, availableLevels],
  );
  const metrics = useMemo(() => getLevelMetrics(roomSnapshots), [roomSnapshots]);
  const focusedRoomSummary = useMemo(
    () => metrics.rooms.find((room) => room.roomId === focusedRoomId) ?? null,
    [focusedRoomId, metrics.rooms],
  );
  const isBusy = busyAction !== null;
  const isLoading = ['bootstrap', 'sync-route', 'refresh', 'select-project', 'select-level'].includes(busyAction ?? '');

  function notifyContextChange(nextTarget: DashboardRoomTarget, historyMode: HistoryUpdateMode = 'replace') {
    onContextChange?.(nextTarget, historyMode);
  }

  async function runOverviewAction(actionLabel: string, action: () => Promise<void>) {
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

  async function refreshLevelsForProject(
    projectId: string,
    preferredLevelId?: string,
  ): Promise<Level[]> {
    const trimmedProjectId = projectId.trim();

    if (!trimmedProjectId) {
      setAvailableLevels([]);
      setActiveLevelId(EMPTY_ID);
      setRoomSnapshots([]);
      setFocusedRoomId(EMPTY_ID);
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
      setFocusedRoomId(EMPTY_ID);
      return [];
    }

    const rooms = await listRoomsByLevel(trimmedLevelId);
    const nextSnapshots = await Promise.all(rooms.map((room) => loadRoomSnapshot(room.id)));
    setRoomSnapshots(nextSnapshots);
    setFocusedRoomId((currentRoomId) => pickExistingRoomId(nextSnapshots, preferredRoomId, currentRoomId));
    return nextSnapshots;
  }

  async function loadContext(
    preferredProjectId: string,
    preferredLevelId: string,
    preferredRoomId: string,
    historyMode: HistoryUpdateMode,
  ) {
    const nextProjects = await refreshProjects(preferredProjectId);
    const nextProjectId = pickExistingId(nextProjects, preferredProjectId, activeProjectId);

    if (!nextProjectId) {
      setAvailableLevels([]);
      setRoomSnapshots([]);
      setFocusedRoomId(EMPTY_ID);
      notifyContextChange({ projectId: EMPTY_ID, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'replace');
      setStatusMessage('Aucun projet trouvé. Crée un projet pour commencer à structurer un étage.');
      return;
    }

    const nextLevels = await refreshLevelsForProject(nextProjectId, preferredLevelId);
    const nextLevelId = pickExistingId(nextLevels, preferredLevelId, activeLevelId);

    if (!nextLevelId) {
      setRoomSnapshots([]);
      setFocusedRoomId(EMPTY_ID);
      notifyContextChange({ projectId: nextProjectId, levelId: EMPTY_ID, roomId: EMPTY_ID }, historyMode);
      setStatusMessage('Projet actif prêt. Aucun niveau trouvé pour ce projet.');
      return;
    }

    const nextSnapshots = await refreshRoomSnapshotsForLevel(nextLevelId, preferredRoomId);
    const nextRoomId = pickExistingRoomId(nextSnapshots, preferredRoomId, focusedRoomId);
    notifyContextChange({ projectId: nextProjectId, levelId: nextLevelId, roomId: nextRoomId }, historyMode);
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      return;
    }

    const nextFocusedRoomId = target.focusedRoomId ?? EMPTY_ID;
    const shouldBootstrap = availableProjects.length === 0;
    const shouldSyncRoute = target.projectId !== activeProjectId
      || target.levelId !== activeLevelId
      || nextFocusedRoomId !== focusedRoomId;

    if (!shouldBootstrap && !shouldSyncRoute) {
      return;
    }

    setActiveProjectId(target.projectId);
    setActiveLevelId(target.levelId);
    setFocusedRoomId(nextFocusedRoomId);

    void runOverviewAction(shouldBootstrap ? 'bootstrap' : 'sync-route', async () => {
      await loadContext(target.projectId, target.levelId, nextFocusedRoomId, 'replace');
    });
  }, [
    supabaseConfigured,
    target.projectId,
    target.levelId,
    target.focusedRoomId,
    availableProjects.length,
    activeProjectId,
    activeLevelId,
    focusedRoomId,
  ]);

  const handleRefresh = () => {
    if (!supabaseConfigured) {
      return;
    }

    void runOverviewAction('refresh', async () => {
      await loadContext(activeProjectId, activeLevelId, focusedRoomId, 'replace');
    });
  };

  const handleProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProjectId = event.target.value;
    setActiveProjectId(nextProjectId);
    setAvailableLevels([]);
    setRoomSnapshots([]);
    setFocusedRoomId(EMPTY_ID);

    if (!supabaseConfigured) {
      notifyContextChange({ projectId: nextProjectId, levelId: EMPTY_ID, roomId: EMPTY_ID }, 'push');
      return;
    }

    void runOverviewAction('select-project', async () => {
      await loadContext(nextProjectId, EMPTY_ID, EMPTY_ID, 'push');
    });
  };

  const handleLevelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLevelId = event.target.value;
    setActiveLevelId(nextLevelId);
    setRoomSnapshots([]);
    setFocusedRoomId(EMPTY_ID);

    if (!supabaseConfigured) {
      notifyContextChange({ projectId: activeProjectId, levelId: nextLevelId, roomId: EMPTY_ID }, 'push');
      return;
    }

    void runOverviewAction('select-level', async () => {
      await loadContext(activeProjectId, nextLevelId, EMPTY_ID, 'push');
    });
  };

  const handleCreateLevel = () => {
    void runOverviewAction('create-level', async () => {
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

      await loadContext(projectId, createdLevel.id, EMPTY_ID, 'push');
      setNewLevelNameInput('');
      setIsLevelModalOpen(false);
      setStatusMessage(`Niveau créé : ${createdLevel.name}. Ajoute maintenant des pièces pour construire le plan global.`);
    });
  };

  const handleFocusRoom = (roomId: string) => {
    setFocusedRoomId(roomId);
    notifyContextChange({ projectId: activeProjectId, levelId: activeLevelId, roomId }, 'replace');
  };

  const handleOpenRoom = (roomId: string) => {
    setFocusedRoomId(roomId);
    onOpenRoom?.(roomId);
  };

  const handleExportSimplePdf = async () => {
    if (roomSnapshots.length === 0) {
      setErrorMessage('Ajoute au moins une pièce au niveau avant de lancer l’export PDF.');
      return;
    }

    const svgElement = levelPlanSvgRef.current;
    if (!svgElement) {
      setErrorMessage('Le plan n’est pas prêt. Réessaie après le chargement de la vue.');
      return;
    }

    setIsExportingSimplePdf(true);
    setErrorMessage(null);

    try {
      const fileName = await exportSimpleLevelPlanPdf({
        svgElement,
        projectName: selectedProject?.name ?? target.projectName,
        levelName: selectedLevel?.name ?? target.levelName,
      });

      setIsExportMenuOpen(false);
      setStatusMessage(`Export PDF généré : ${fileName}`);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsExportingSimplePdf(false);
    }
  };

  const handleExportDetailedPdf = async () => {
    if (roomSnapshots.length === 0) {
      setErrorMessage('Ajoute au moins une pièce au niveau avant de lancer l’export PDF détaillé.');
      return;
    }

    const svgElement = levelPlanSvgRef.current;
    if (!svgElement) {
      setErrorMessage('Le plan n’est pas prêt. Réessaie après le chargement de la vue.');
      return;
    }

    setIsExportingDetailedPdf(true);
    setErrorMessage(null);

    try {
      const fileName = await exportDetailedLevelPlanPdf({
        svgElement,
        projectName: selectedProject?.name ?? target.projectName,
        levelName: selectedLevel?.name ?? target.levelName,
        metrics,
        snapshots: roomSnapshots,
      });

      setIsExportMenuOpen(false);
      setStatusMessage(`Export PDF détaillé généré : ${fileName}`);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsExportingDetailedPdf(false);
    }
  };

  return (
    <DashboardLayout>
      <header className="level-overview__header">
        <div>
          <h1 className="dashboard-pageTitle">
            Vue d’ensemble — {(selectedLevel?.name ?? target.levelName) || 'Niveau actif'}
          </h1>
        </div>

        <div className="level-overview__headerActions">
          <button type="button" className="dashboard-outlineButton" onClick={onBack}>
            Retour au tableau de bord
          </button>
        </div>
      </header>

      <section className="dashboard-contentPanel level-overview__panel">
        <div className="level-overview__filters">
          <label className="dashboard-field">
            <span>Projet actif</span>
            <select value={activeProjectId} onChange={handleProjectChange} disabled={isBusy || !supabaseConfigured}>
              <option value="">Sélectionner un projet</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>

          <label className="dashboard-field dashboard-field--compact">
            <span>Niveau actif</span>
            <select value={activeLevelId} onChange={handleLevelChange} disabled={isBusy || !supabaseConfigured || !selectedProject}>
              <option value="">Sélectionner un niveau</option>
              {availableLevels.map((level) => (
                <option key={level.id} value={level.id}>{level.name}</option>
              ))}
            </select>
          </label>

          <div className="level-overview__filterActions">
            <button
              type="button"
              className="dashboard-createButton"
              onClick={() => setIsLevelModalOpen(true)}
              disabled={!selectedProject || isBusy}
            >
              Créer un niveau
            </button>
          </div>
        </div>

        {!supabaseConfigured ? (
          <div className="dashboard-banner dashboard-banner--error">
            La configuration Supabase est absente. La vue étage reste visible, mais le chargement des niveaux et des pièces est désactivé.
          </div>
        ) : null}

        {statusMessage ? (
          <div className="dashboard-banner dashboard-banner--success">{statusMessage}</div>
        ) : null}

        {errorMessage ? (
          <div className="dashboard-banner dashboard-banner--error">{errorMessage}</div>
        ) : null}

        <div className="level-overview__workspace">
          <section className="level-overview__canvasPanel">
            <div className="level-overview__toolbar">

              <div className="level-overview__toolbarActions">
                <div style={{ display: 'flex', gap: 16 }}>
                  <label className="level-overview__toggle">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(event) => setShowGrid(event.target.checked)}
                    />
                    <span>Grille</span>
                  </label>

                  <label className="level-overview__toggle">
                    <input
                      type="checkbox"
                      checked={showMeasurements}
                      onChange={(event) => setShowMeasurements(event.target.checked)}
                    />
                    <span>Mesures</span>
                  </label>
                </div>

                <div className="level-overview__exportMenu">
                  <button
                    type="button"
                    className="dashboard-exportButton"
                    onClick={() => setIsExportMenuOpen((current) => !current)}
                  >
                    Export PDF
                  </button>

                  {isExportMenuOpen ? (
                    <div className="level-overview__exportCard">
                      <strong>Exports PDF</strong>
                      <button
                        type="button"
                        className="dashboard-exportButton"
                        onClick={() => void handleExportSimplePdf()}
                        disabled={isExportingSimplePdf || isExportingDetailedPdf || roomSnapshots.length === 0 || isLoading}
                      >
                        {isExportingSimplePdf ? 'Génération en cours...' : 'Plan simple avec grille et échelle'}
                      </button>
                      <button
                        type="button"
                        className="dashboard-exportButton"
                        onClick={() => void handleExportDetailedPdf()}
                        disabled={isExportingSimplePdf || isExportingDetailedPdf || roomSnapshots.length === 0 || isLoading}
                      >
                        {isExportingDetailedPdf ? 'Génération en cours...' : 'Plan détaillé avec métriques'}
                      </button>
                      <p>Le plan détaillé inclut le plan, les métriques globales et les tableaux pièces, murs et ouvertures.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="level-overview__loadingState">
                <div className="dashboard-skeletonPreview level-overview__skeletonCanvas" />
                <div className="dashboard-skeletonBar dashboard-skeletonBar--title" />
                <div className="dashboard-skeletonBar" />
                <div className="dashboard-skeletonBar dashboard-skeletonBar--short" />
              </div>
            ) : roomSnapshots.length === 0 ? (
              <div className="dashboard-emptyState level-overview__emptyState">
                <h3>Aucune pièce chargée pour ce niveau</h3>
                <p>Commence par créer ou enregistrer une pièce sur ce niveau pour alimenter le plan global et ses métriques.</p>
              </div>
            ) : (
              <LevelPlanCanvas
                snapshots={roomSnapshots}
                highlightedRoomId={focusedRoomId}
                showGrid={showGrid}
                showMeasurements={showMeasurements}
                exportSvgRef={levelPlanSvgRef}
                onFocusRoom={handleFocusRoom}
              />
            )}


            <section className="level-overview__openingsSection">
              <div className="level-overview__sectionHeader">
                <div>
                  <h2 className="dashboard-panelTitle">Détail des ouvertures</h2>
                  <p className="dashboard-subtitle">Portes et fenêtres du niveau actif, regroupées par pièce et par mur.</p>
                </div>
              </div>

              {metrics.openings.length === 0 ? (
                <div className="dashboard-emptyState">
                  <h3>Aucune ouverture pour ce niveau</h3>
                  <p>Les portes et fenêtres apparaîtront ici dès qu’elles seront ajoutées sur les pièces du niveau.</p>
                </div>
              ) : (
                <div className="level-overview__openingList">
                  {metrics.openings.map((opening) => (
                    <article key={opening.openingId} className="level-overview__openingRow">
                      <div>
                        <strong>{opening.roomName}</strong>
                        <p>{opening.wallLabel} · {formatOpeningType(opening.type)}</p>
                      </div>

                      <div className="level-overview__openingMeta">
                        <span>{formatLengthCm(opening.widthCm)} × {formatLengthCm(opening.heightCm)}</span>
                        <span>Allège {formatLengthCm(opening.bottomCm)}</span>
                        <span>Position {formatLengthCm(opening.offsetCm)}</span>
                      </div>

                      <div className="level-overview__openingActions">
                        <button type="button" className="dashboard-textButton" onClick={() => handleFocusRoom(opening.roomId)}>
                          Focaliser
                        </button>
                        <button type="button" className="dashboard-outlineButton" onClick={() => handleOpenRoom(opening.roomId)}>
                          Ouvrir la pièce
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>

          <aside className="level-overview__sidebar">
            {focusedRoomSummary ? (
              <section className="level-overview__summaryCard level-overview__summaryCard--accent">
                <div className="level-overview__sectionHeader">
                  <div>
                    <p className="dashboard-eyebrow">Pièce sélectionnée</p>
                    <h2 className="dashboard-panelTitle">{focusedRoomSummary.name}</h2>
                  </div>
                  <button className="dashboard-outlineButton" onClick={() => handleOpenRoom(focusedRoomSummary.roomId)}>
                    Ouvrir la pièce
                  </button>
                </div>

                <div className="level-overview__focusedRoomMeta">
                  <span>{formatArea(focusedRoomSummary.areaM2)}</span>
                  <span>{formatCount(focusedRoomSummary.wallCount)} mur(s)</span>
                  <span>{formatCount(focusedRoomSummary.openingsCount)} ouverture(s)</span>
                  <span>Hauteurs {formatOptionalHeight(focusedRoomSummary.minHeightCm)} → {formatOptionalHeight(focusedRoomSummary.maxHeightCm)}</span>
                </div>
              </section>
            ) : null}

            <section className="level-overview__summaryCard">
              <div className="level-overview__summaryHeader">
                <div>
                  <p className="dashboard-eyebrow">Résumé du niveau</p>
                  <h2 className="dashboard-panelTitle">{selectedLevel?.name ?? 'Niveau actif'}</h2>
                </div>
              </div>

              <div className="level-overview__statsGrid">
                <article className="level-overview__statTile">
                  <span>Surface totale</span>
                  <strong>{formatArea(metrics.totalAreaM2)}</strong>
                </article>
                <article className="level-overview__statTile">
                  <span>Pièces</span>
                  <strong>{formatCount(metrics.roomCount)}</strong>
                </article>
                <article className="level-overview__statTile">
                  <span>Hauteur min</span>
                  <strong>{formatOptionalHeight(metrics.minHeightCm)}</strong>
                </article>
                <article className="level-overview__statTile">
                  <span>Hauteur max</span>
                  <strong>{formatOptionalHeight(metrics.maxHeightCm)}</strong>
                </article>
                <article className="level-overview__statTile">
                  <span>Fenêtres</span>
                  <strong>{formatCount(metrics.windowsCount)}</strong>
                </article>
                <article className="level-overview__statTile">
                  <span>Portes</span>
                  <strong>{formatCount(metrics.doorsCount)}</strong>
                </article>
                <article className="level-overview__statTile level-overview__statTile--wide">
                  <span>Murs extérieurs</span>
                  <strong>{formatCount(metrics.exteriorWallsCount)}</strong>
                </article>
              </div>
            </section>
          </aside>
        </div>
      </section>

      {isLevelModalOpen ? (
        <div className="dashboard-modalBackdrop" role="presentation" onClick={() => setIsLevelModalOpen(false)}>
          <div className="dashboard-modalCard" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <p className="dashboard-eyebrow">Nouveau niveau</p>
            <h2 className="dashboard-panelTitle">Créer un niveau depuis la vue étage</h2>
            <p className="dashboard-subtitle">Le niveau sera ajouté au projet actif puis sélectionné automatiquement.</p>

            <label className="dashboard-field">
              <span>Nom du niveau</span>
              <input
                type="text"
                placeholder="R+1, Sous-sol, Extension..."
                value={newLevelNameInput}
                onChange={(event) => setNewLevelNameInput(event.target.value)}
              />
            </label>

            <div className="dashboard-modalActions">
              <button type="button" className="dashboard-outlineButton" onClick={() => setIsLevelModalOpen(false)}>
                Annuler
              </button>
              <button type="button" className="dashboard-primaryButton" onClick={handleCreateLevel} disabled={!selectedProject || isBusy}>
                {busyAction === 'create-level' ? 'Création...' : 'Créer le niveau'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </DashboardLayout>
  );
}