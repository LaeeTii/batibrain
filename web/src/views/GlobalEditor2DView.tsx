import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Menu, NativeSelect } from '@mantine/core';
import { LuRedo2, LuUndo2 } from 'react-icons/lu';
import {
  Canvas2D, CanvasDisplayOptionsMenu, DEFAULT_CANVAS_DISPLAY_OPTIONS,
  type CanvasDisplayOptions, type CanvasLevelData,
} from '../components/Canvas2D';
import { DashboardLayout } from '../components/DashboardLayout';
import { ActionHistoryProvider, useActionHistory } from '../components/ActionHistory';
import { EditorCreationPanel, EditorDetailPanel } from '../components/EditorPanels';
import { SelectionSyncBridge, useEditorSelection } from '../components/SelectionSyncBridge';
import type { Level, Project } from '../domain/types';
import { hasSupabaseConfig } from '../lib/supabase';
import { listLevelsByProject } from '../services/levels';
import { getProject } from '../services/projects';
import { listRoomsByLevel, loadRoomSnapshot } from '../services/rooms';

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

  const load = async () => {
    if (!projectId) { setProject(null); setLevels([]); setLevelData([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [nextProject, nextLevels] = await Promise.all([getProject(projectId), listLevelsByProject(projectId)]);
      const nextData = await Promise.all(nextLevels.map(async (level): Promise<CanvasLevelData> => {
        const rooms = await listRoomsByLevel(level.id);
        return { level, rooms: await Promise.all(rooms.map(({ id }) => loadRoomSnapshot(id))) };
      }));
      const initiallyVisible = nextLevels.filter(({ isVisible }) => isVisible).map(({ id }) => id);
      const fallbackVisible = initiallyVisible.length ? initiallyVisible : nextLevels[0] ? [nextLevels[0].id] : [];
      const nextActive = nextLevels.some(({ id }) => id === initialLevelId) ? initialLevelId : fallbackVisible[0] ?? '';
      setProject(nextProject); setLevels(nextLevels); setLevelData(nextData); setVisibleLevelIds(fallbackVisible); setActiveLevelId(nextActive);
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

  return <ActionHistoryProvider><SelectionSyncBridge validObjects={validObjects} onLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }}><GlobalEditorContent project={project} levels={levels} levelData={levelData} activeLevelId={activeLevelId} visibleLevelIds={visibleLevelIds} options={options} loading={loading} error={error} onRetry={load} onOptionsChange={setOptions} onToggleLevel={toggleLevel} onActiveLevelChange={(id) => { setActiveLevelId(id); setVisibleLevelIds((current) => current.includes(id) ? current : [...current, id]); onLevelChange?.(id); }} /></SelectionSyncBridge></ActionHistoryProvider>;
}

interface GlobalEditorContentProps { project: Project | null; levels: Level[]; levelData: CanvasLevelData[]; activeLevelId: string; visibleLevelIds: string[]; options: CanvasDisplayOptions; loading: boolean; error: string; onRetry(): Promise<void>; onOptionsChange(value: CanvasDisplayOptions): void; onToggleLevel(id: string, checked: boolean): void; onActiveLevelChange(id: string): void }

function GlobalEditorContent({ project, levels, levelData, activeLevelId, visibleLevelIds, options, loading, error, onRetry, onOptionsChange, onToggleLevel, onActiveLevelChange }: GlobalEditorContentProps) {
  const { selection, select } = useEditorSelection(); const { canUndo, canRedo, undo, redo } = useActionHistory(); const activeLevel = levels.find(({ id }) => id === activeLevelId) ?? null; const activeData = levelData.find(({ level }) => level.id === activeLevelId);
  return <DashboardLayout>
    <header className="global-editor__header">
      <div><p className="dashboard-eyebrow">Éditeur 2D global</p><h1 className="dashboard-pageTitle">{project?.name ?? 'Plan du projet'}</h1></div>
      <div className="dashboard-header__actions"><Button type="button" className="dashboard-iconButton" disabled={!canUndo} onClick={undo} aria-label="Annuler"><LuUndo2 aria-hidden /></Button><Button type="button" className="dashboard-iconButton" disabled={!canRedo} onClick={redo} aria-label="Rétablir"><LuRedo2 aria-hidden /></Button></div>
    </header>
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
      <EditorCreationPanel levels={levels} levelData={levelData} activeLevelId={activeLevelId} />
      <div className="global-editor__canvasArea">{loading ? <div className="dashboard-loading" aria-live="polite">Chargement du plan…</div> : !activeLevel ? <div className="dashboard-emptyState"><h2>Aucun niveau</h2><p>Le projet doit contenir au moins un niveau visible.</p></div> : <Canvas2D levels={levelData} activeLevelId={activeLevel.id} visibleLevelIds={visibleLevelIds} options={options} selection={selection} onSelect={select} />}</div>
      <EditorDetailPanel data={activeData} />
    </section>
  </DashboardLayout>;
}
