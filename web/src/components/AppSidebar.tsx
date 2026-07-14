import React from 'react';
import { ActionIcon, Button, NativeSelect } from '@mantine/core';
import type { IconType } from 'react-icons';
import logoUrl from '../assets/logo.svg';
import {
  LuCalendarDays,
  LuChartNoAxesCombined,
  LuFileText,
  LuHammer,
  LuImages,
  LuLayoutDashboard,
  LuListChecks,
  LuPanelLeftClose,
  LuPencilRuler,
  LuPencil,
  LuPlus,
  LuShieldCheck,
  LuTrash2,
  LuUsers,
} from 'react-icons/lu';
import { useAdminControls } from './AdminContext';
import type { Project } from '../domain/types';

export type MainRoute = 'dashboard' | 'global-editor' | 'metrics';

type NavigationItem = {
  label: string;
  icon: IconType;
  route?: MainRoute;
};

const NAVIGATION: NavigationItem[] = [
  { label: 'Tableau de bord', icon: LuLayoutDashboard, route: 'dashboard' },
  { label: 'Édition globale', icon: LuPencilRuler, route: 'global-editor' },
  { label: 'Métriques', icon: LuChartNoAxesCombined, route: 'metrics' },
  { label: 'Photos', icon: LuImages },
  { label: 'Documents', icon: LuFileText },
  { label: 'Travaux', icon: LuHammer },
  { label: 'Tâches', icon: LuListChecks },
  { label: 'Planning', icon: LuCalendarDays },
];

export function AppSidebar({
  activeRoute,
  projects,
  currentProjectId,
  canManageCurrentProject,
  onClose,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onManageCollaborators,
  onNavigate,
  onSelectProject,
}: {
  activeRoute: MainRoute;
  projects: Project[];
  currentProjectId: string;
  canManageCurrentProject: boolean;
  onClose(): void;
  onCreateProject(): void;
  onEditProject(): void;
  onDeleteProject(): void;
  onManageCollaborators(): void;
  onNavigate(route: MainRoute): void;
  onSelectProject(projectId: string): void;
}) {
  const { isAdmin, openAdmin } = useAdminControls();
  const currentProject = projects.find((project) => project.id === currentProjectId);

  return (
    <aside className="dashboard-sidebar" aria-label="Navigation de l’application">
      <div className="app-sidebar__header">
        <div className="dashboard-brandBlock">
          <img className="dashboard-brandLogo" src={logoUrl} alt="" />
          <h1 className="dashboard-brandTitle">BatiBrain</h1>
        </div>
        <ActionIcon className="app-iconButton app-iconButton--sidebar" variant="subtle" size="lg" onClick={onClose} aria-label="Fermer la barre latérale" title="Fermer la barre latérale">
          <LuPanelLeftClose aria-hidden="true" />
        </ActionIcon>
      </div>

      <div className="app-projectSelector">
        <NativeSelect
          id="app-project-select"
          value={currentProjectId}
          onChange={(event) => onSelectProject(event.target.value)}
          aria-label="Projet courant"
          data={[{ value: '', label: projects.length === 0 ? 'Aucun projet' : 'Sélectionner un projet' }, ...projects.map((project) => ({ value: project.id, label: project.name }))]}
        />
        <div className="app-projectActions">
          {currentProject && canManageCurrentProject && (
            <ActionIcon variant="light" color="gray" size="lg" onClick={onEditProject} aria-label="Modifier le projet" title="Modifier le projet">
              <LuPencil aria-hidden="true" />
            </ActionIcon>
          )}
          <ActionIcon variant="filled" color="green" size="lg" onClick={onCreateProject} aria-label="Créer un projet" title="Créer un projet">
            <LuPlus aria-hidden="true" />
          </ActionIcon>
          {currentProject && canManageCurrentProject && (
            <ActionIcon variant="filled" color="red" size="lg" onClick={onDeleteProject} aria-label="Supprimer le projet" title="Supprimer le projet">
              <LuTrash2 aria-hidden="true" />
            </ActionIcon>
          )}
        </div>
        {currentProject && canManageCurrentProject && <Button className="app-projectCollaborators" variant="light" color="cyan" onClick={onManageCollaborators} leftSection={<LuUsers aria-hidden="true" />}>Gérer les collaborateurs</Button>}
      </div>

      <nav className="dashboard-nav" aria-label="Navigation principale">
        {NAVIGATION.map(({ label, icon: Icon, route }) => route ? (
          <a
            key={label}
            className={`dashboard-navItem ${activeRoute === route ? 'is-active' : ''}`}
            href={`?screen=${route}`}
            aria-current={activeRoute === route ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(route);
            }}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </a>
        ) : (
          <a key={label} className="dashboard-navItem is-disabled" aria-disabled="true" tabIndex={-1} title="Disponible dans une version ultérieure">
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <span className="sr-only"> — indisponible</span>
          </a>
        ))}
      </nav>

      {isAdmin && (
        <Button variant="subtle" className="dashboard-adminButton" onClick={openAdmin}>
          <LuShieldCheck aria-hidden="true" /> Admin
        </Button>
      )}
    </aside>
  );
}
