import React, { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Menu, Modal, NativeSelect, TextInput, Textarea } from '@mantine/core';
import { LuFileDown, LuFolderPlus, LuLayers3, LuPencilRuler, LuRedo2, LuSearch, LuUndo2 } from 'react-icons/lu';
import { DashboardLayout } from '../components/DashboardLayout';
import { RoomCard, type RoomPdfMode } from '../components/RoomCard';
import type { Level, Project } from '../domain/types';
import { exportDashboardPdf } from '../lib/dashboardPdf';
import { getRoomAreaM2 } from '../lib/roomMetrics';
import { uniqueLevelOpenings, uniqueLevelWalls } from '../domain/roomOverlap';
import { hasSupabaseConfig } from '../lib/supabase';
import { listLevelsByProject } from '../services/levels';
import { canWriteProject, getProject } from '../services/projects';
import { listRoomsByLevel, loadRoomSnapshot, softDeleteRoom, updateRoom, type RoomSnapshot } from '../services/rooms';
import { usePreferences } from '../components/PreferencesContext';
import { formatSurfaceFromSquareMeters } from '../domain/userPreferences';

export interface DashboardRoomTarget { projectId: string; levelId: string; roomId: string }
interface RoomsDashboardProps {
  projectId: string;
  onCreateProject(): void;
  onOpenGlobalEditor(): void;
  onOpenRoom(target: DashboardRoomTarget): void;
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'; }

export function RoomsDashboard({ projectId, onCreateProject, onOpenGlobalEditor, onOpenRoom }: RoomsDashboardProps) {
  const { preferences } = usePreferences();
  const [project, setProject] = useState<Project | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [snapshots, setSnapshots] = useState<RoomSnapshot[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [filterLevelId, setFilterLevelId] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [noteSnapshot, setNoteSnapshot] = useState<RoomSnapshot | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const load = async () => {
    if (!projectId) { setProject(null); setLevels([]); setSnapshots([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [nextProject, nextLevels, writeAllowed] = await Promise.all([
        getProject(projectId), listLevelsByProject(projectId), canWriteProject(projectId),
      ]);
      const visibleLevels = nextLevels.filter(({ isVisible }) => isVisible);
      const rooms = (await Promise.all(visibleLevels.map(({ id }) => listRoomsByLevel(id)))).flat();
      const nextSnapshots = await Promise.all(rooms.map(({ id }) => loadRoomSnapshot(id)));
      setProject(nextProject); setLevels(nextLevels); setCanEdit(writeAllowed); setSnapshots(nextSnapshots);
    } catch (caught) { setError(errorMessage(caught)); setProject(null); setLevels([]); setSnapshots([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setFilterLevelId('all'); setSearch(''); setFeedback(''); setNoteSnapshot(null);
    if (hasSupabaseConfig()) void load();
  }, [projectId]);

  const visibleLevels = useMemo(() => levels.filter(({ isVisible }) => isVisible), [levels]);
  const filteredSnapshots = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr-FR');
    return snapshots.filter(({ room }) => (filterLevelId === 'all' || room.levelId === filterLevelId)
      && room.name.toLocaleLowerCase('fr-FR').includes(query));
  }, [filterLevelId, search, snapshots]);
  const levelsById = useMemo(() => new Map(levels.map((level) => [level.id, level])), [levels]);
  const totalAreaM2 = filteredSnapshots.reduce((sum, snapshot) => sum + getRoomAreaM2(snapshot.vertices), 0);
  const totalWalls = uniqueLevelWalls(filteredSnapshots).length;
  const totalOpenings = uniqueLevelOpenings(filteredSnapshots).length;

  const runExport = (targets: RoomSnapshot[], mode: RoomPdfMode) => {
    if (!project) return;
    setError('');
    try { exportDashboardPdf(project.name, levels, targets, mode, preferences); setFeedback(''); }
    catch (caught) { setError(errorMessage(caught)); }
  };

  const deleteSnapshot = async (snapshot: RoomSnapshot) => {
    if (!window.confirm(`Supprimer logiquement « ${snapshot.room.name} » ?`)) return;
    setError('');
    try { await softDeleteRoom(snapshot.room.id); setFeedback(`La pièce « ${snapshot.room.name} » a été supprimée.`); await load(); }
    catch (caught) { setError(errorMessage(caught)); }
  };

  const saveNote = async () => {
    if (!noteSnapshot) return;
    setNoteSaving(true); setError('');
    try {
      await updateRoom({ ...noteSnapshot.room, notes: noteDraft.trim() || null });
      setFeedback(`Note enregistrée pour « ${noteSnapshot.room.name} ».`); setNoteSnapshot(null); await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setNoteSaving(false); }
  };

  if (!hasSupabaseConfig()) return <DashboardLayout><div className="dashboard-emptyState" role="alert"><h2>Configuration requise</h2><p>Configure Supabase pour charger le tableau de bord.</p></div></DashboardLayout>;

  if (!projectId) return <DashboardLayout><section className="dashboard-welcome"><h1>Bienvenue dans BatiBrain</h1><p>Crée ton premier projet pour commencer à structurer ton habitation.</p><Button className="dashboard-primaryButton" onClick={onCreateProject} leftSection={<LuFolderPlus aria-hidden />}>Créer un nouveau projet</Button></section></DashboardLayout>;

  return <DashboardLayout>
    <header className="dashboard-header">
      <div><h1 className="dashboard-pageTitle">{project?.name ?? 'Tableau de bord'}</h1></div>
      <div className="dashboard-header__actions">
        <ActionIcon variant="default" className="dashboard-iconButton" disabled aria-label="Annuler" title="Aucune action à annuler"><LuUndo2 aria-hidden /></ActionIcon>
        <ActionIcon variant="default" className="dashboard-iconButton" disabled aria-label="Rétablir" title="Aucune action à rétablir"><LuRedo2 aria-hidden /></ActionIcon>
        <Button className="dashboard-primaryButton" onClick={onOpenGlobalEditor} leftSection={<LuPencilRuler aria-hidden />}>Éditeur 2D global</Button>
      </div>
    </header>

    {error ? <div className="dashboard-banner dashboard-banner--error" role="alert">{error}<Button variant="light" onClick={() => void load()}>Réessayer</Button></div> : null}
    {feedback ? <div className="dashboard-banner dashboard-banner--success" role="status">{feedback}</div> : null}

    <section className="dashboard-contentPanel">
      <div className="dashboard-filters" aria-label="Filtres des pièces">
        <NativeSelect className="dashboard-field dashboard-field--compact" label="Niveau" leftSection={<LuLayers3 aria-hidden />} value={filterLevelId} onChange={(event) => setFilterLevelId(event.currentTarget.value)} data={[{ value: 'all', label: 'Tous les niveaux' }, ...visibleLevels.map((level) => ({ value: level.id, label: level.name }))]} />
        <TextInput className="dashboard-field dashboard-search" label="Rechercher par nom" leftSection={<LuSearch aria-hidden />} value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Rechercher une pièce" />
        <Menu position="bottom-end" withinPortal><Menu.Target><Button className="dashboard-exportButton" disabled={filteredSnapshots.length === 0} leftSection={<LuFileDown aria-hidden />}>PDF</Button></Menu.Target><Menu.Dropdown><Menu.Item onClick={() => runExport(filteredSnapshots, 'plan')}>Chaque plan de pièce</Menu.Item><Menu.Item onClick={() => runExport(filteredSnapshots, 'détail')}>Chaque plan de pièce + détail</Menu.Item></Menu.Dropdown></Menu>
      </div>

      {loading ? <div className="dashboard-loading" aria-live="polite">Chargement des pièces…</div>
        : !project ? <div className="dashboard-emptyState"><h3>Projet indisponible</h3><p>Choisis un autre projet depuis la barre latérale.</p></div>
          : snapshots.length === 0 ? <div className="dashboard-emptyState"><h3>Aucune pièce</h3><p>Ouvre l’Éditeur 2D global pour dessiner la première pièce du projet.</p></div>
            : filteredSnapshots.length === 0 ? <div className="dashboard-emptyState"><h3>Aucun résultat</h3><p>Aucune pièce ne correspond aux filtres actifs.</p></div>
              : <div className="dashboard-roomGrid">{filteredSnapshots.map((snapshot) => <RoomCard
                key={snapshot.room.id} snapshot={snapshot} levelName={levelsById.get(snapshot.room.levelId)?.name ?? 'Niveau non disponible'}
                areaM2={getRoomAreaM2(snapshot.vertices)} canEdit={canEdit} surfaceUnit={preferences.surfaceUnit}
                onOpen={() => onOpenRoom({ projectId, levelId: snapshot.room.levelId, roomId: snapshot.room.id })}
                onAddNote={() => { setNoteSnapshot(snapshot); setNoteDraft(snapshot.room.notes ?? ''); }}
                onDelete={() => void deleteSnapshot(snapshot)} onExport={(mode) => runExport([snapshot], mode)}
              />)}</div>}

      <div className="dashboard-summaryStrip" aria-label="Synthèse des pièces visibles">
        <article className="summary-stat"><span className="summary-stat__label">Pièces</span><strong>{filteredSnapshots.length}</strong></article>
        <article className="summary-stat"><span className="summary-stat__label">Surface totale</span><strong>{formatSurfaceFromSquareMeters(totalAreaM2, preferences.surfaceUnit)}</strong></article>
        <article className="summary-stat"><span className="summary-stat__label">Murs</span><strong>{totalWalls}</strong></article>
        <article className="summary-stat"><span className="summary-stat__label">Ouvertures</span><strong>{totalOpenings}</strong></article>
      </div>
    </section>

    <Modal opened={Boolean(noteSnapshot)} onClose={() => setNoteSnapshot(null)} title={`Note — ${noteSnapshot?.room.name ?? ''}`} centered>
      <Textarea label="Note de la pièce" minRows={5} value={noteDraft} onChange={(event) => setNoteDraft(event.currentTarget.value)} autoFocus />
      <Button mt="md" onClick={() => void saveNote()} loading={noteSaving}>Enregistrer la note</Button>
    </Modal>
  </DashboardLayout>;
}
