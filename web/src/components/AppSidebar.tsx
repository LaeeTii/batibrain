import React from 'react';
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
        <button className="app-iconButton app-iconButton--sidebar" type="button" onClick={onClose} aria-label="Fermer la barre latérale" title="Fermer la barre latérale">
          <LuPanelLeftClose aria-hidden="true" />
        </button>
      </div>

      <div className="app-projectSelector">
        <label htmlFor="app-project-select" className="sr-only">Projet courant</label>
        <select
          id="app-project-select"
          value={currentProjectId}
          onChange={(event) => onSelectProject(event.target.value)}
          aria-label="Projet courant"
        >
          <option value="">{projects.length === 0 ? 'Aucun projet' : 'Sélectionner un projet'}</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <div className="app-projectActions">
          {currentProject && canManageCurrentProject && (
            <button type="button" onClick={onEditProject} aria-label="Modifier le projet" title="Modifier le projet">
              <LuPencil aria-hidden="true" />
            </button>
          )}
          <button className="app-projectActions__add" type="button" onClick={onCreateProject} aria-label="Créer un projet" title="Créer un projet">
            <LuPlus aria-hidden="true" />
          </button>
          {currentProject && canManageCurrentProject && (
            <button className="app-projectActions__delete" type="button" onClick={onDeleteProject} aria-label="Supprimer le projet" title="Supprimer le projet">
              <LuTrash2 aria-hidden="true" />
            </button>
          )}
        </div>
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
        <button type="button" className="dashboard-adminButton" onClick={openAdmin}>
          <LuShieldCheck aria-hidden="true" /> Admin
        </button>
      )}
    </aside>
  );
}
