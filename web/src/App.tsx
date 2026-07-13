import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { AdminProvider } from './components/AdminContext';
import { AccountModal } from './components/AccountModal';
import { PreferencesModal } from './components/PreferencesModal';
import { PreferencesProvider } from './components/PreferencesContext';
import { AppNotifications } from './components/AppNotifications';
import { ProjectCollaborationModal } from './components/ProjectCollaborationModal';
import { ProjectEditingLockIndicator } from './components/ProjectEditingLockIndicator';
import { AppSidebar, type MainRoute } from './components/AppSidebar';
import { supabaseAccountGateway } from './data/supabase/account';
import type { UserProfile } from './domain/types';
import type { Project } from './domain/types';
import { createProject, listProjects, softDeleteProject, updateProject } from './services/projects';
import { Button, Modal, TextInput, Textarea } from '@mantine/core';
import { LuMenu, LuSettings } from 'react-icons/lu';
import { LoginView } from './views/LoginView';
import { RoomEditor } from './views/RoomEditor';
import { GlobalEditor2DView } from './views/GlobalEditor2DView';
import {
  RoomsDashboard,
  type DashboardRoomTarget,
} from './views/RoomsDashboard';

type AppScreen =
  | { name: 'dashboard' }
  | { name: 'global-editor' }
  | { name: 'metrics' }
  | { name: 'room-editor'; target: DashboardRoomTarget };

type AppHistoryState = {
  app: 'batibrain';
  screen: AppScreen;
  dashboardContext: DashboardRoomTarget;
};

type HistoryUpdateMode = 'push' | 'replace';

const EMPTY_DASHBOARD_CONTEXT: DashboardRoomTarget = {
  projectId: '',
  levelId: '',
  roomId: '',
};

function normalizeDashboardContext(dashboardContext: DashboardRoomTarget): DashboardRoomTarget {
  const projectId = dashboardContext.projectId.trim();
  const levelId = projectId ? dashboardContext.levelId.trim() : '';
  const roomId = projectId && levelId ? dashboardContext.roomId.trim() : '';

  return {
    projectId,
    levelId,
    roomId,
  };
}

function createScreenFromRoute(
  routeName: string | null,
  dashboardContext: DashboardRoomTarget,
): AppScreen {
  if (routeName === 'global-editor' || routeName === 'metrics') {
    return { name: routeName };
  }
  if (routeName === 'room-editor') {
    return {
      name: 'room-editor',
      target: dashboardContext,
    };
  }

  return { name: 'dashboard' };
}

function createAppHistoryState(
  screen: AppScreen,
  dashboardContext: DashboardRoomTarget,
): AppHistoryState {
  const normalizedDashboardContext = normalizeDashboardContext(dashboardContext);

  return {
    app: 'batibrain',
    screen: syncScreenWithContext(screen, normalizedDashboardContext),
    dashboardContext: normalizedDashboardContext,
  };
}

function isDashboardRoomTarget(value: unknown): value is DashboardRoomTarget {
  return typeof value === 'object'
    && value !== null
    && 'projectId' in value
    && 'levelId' in value
    && 'roomId' in value
    && typeof value.projectId === 'string'
    && typeof value.levelId === 'string'
    && typeof value.roomId === 'string';
}

function isAppScreen(value: unknown): value is AppScreen {
  if (typeof value !== 'object' || value === null || !('name' in value)) {
    return false;
  }

  const screenName = value.name;

  if (screenName === 'dashboard' || screenName === 'global-editor' || screenName === 'metrics') {
    return true;
  }

  if (screenName === 'room-editor') {
    return 'target' in value && isDashboardRoomTarget(value.target);
  }

  return false;
}

function isAppHistoryState(value: unknown): value is AppHistoryState {
  return typeof value === 'object'
    && value !== null
    && 'app' in value
    && value.app === 'batibrain'
    && 'screen' in value
    && isAppScreen(value.screen)
    && 'dashboardContext' in value
    && isDashboardRoomTarget(value.dashboardContext);
}

function getInitialHistoryState(): AppHistoryState {
  if (typeof window === 'undefined') {
    return createAppHistoryState({ name: 'dashboard' }, EMPTY_DASHBOARD_CONTEXT);
  }

  const url = new URL(window.location.href);
  const dashboardContext = normalizeDashboardContext({
    projectId: url.searchParams.get('projectId') ?? '',
    levelId: url.searchParams.get('levelId') ?? '',
    roomId: url.searchParams.get('roomId') ?? '',
  });
  const routeFromUrl = createAppHistoryState(
    createScreenFromRoute(url.searchParams.get('screen'), dashboardContext),
    dashboardContext,
  );

  if (isAppHistoryState(window.history.state)) {
    const currentState = createAppHistoryState(
      window.history.state.screen,
      window.history.state.dashboardContext,
    );

    if (
      !url.searchParams.has('screen')
      || haveSameRouteCoordinates(
        currentState.screen,
        currentState.dashboardContext,
        routeFromUrl.screen,
        routeFromUrl.dashboardContext,
      )
    ) {
      return currentState;
    }
  }

  return routeFromUrl;
}

function haveSameDashboardContext(
  left: DashboardRoomTarget,
  right: DashboardRoomTarget,
): boolean {
  return left.projectId === right.projectId
    && left.levelId === right.levelId
    && left.roomId === right.roomId;
}

function haveSameRouteCoordinates(
  leftScreen: AppScreen,
  leftDashboardContext: DashboardRoomTarget,
  rightScreen: AppScreen,
  rightDashboardContext: DashboardRoomTarget,
): boolean {
  return leftScreen.name === rightScreen.name
    && haveSameDashboardContext(
      normalizeDashboardContext(leftDashboardContext),
      normalizeDashboardContext(rightDashboardContext),
    );
}

function syncScreenWithContext(
  screen: AppScreen,
  dashboardContext: DashboardRoomTarget,
): AppScreen {
  if (screen.name === 'room-editor') {
    return {
      name: 'room-editor',
      target: dashboardContext,
    };
  }

  return screen;
}

function buildAppUrl(screen: AppScreen, dashboardContext: DashboardRoomTarget): string {
  const normalizedDashboardContext = normalizeDashboardContext(dashboardContext);
  const url = new URL(window.location.href);

  url.searchParams.set('screen', screen.name);

  if (normalizedDashboardContext.projectId) {
    url.searchParams.set('projectId', normalizedDashboardContext.projectId);
  } else {
    url.searchParams.delete('projectId');
  }

  if (normalizedDashboardContext.levelId) {
    url.searchParams.set('levelId', normalizedDashboardContext.levelId);
  } else {
    url.searchParams.delete('levelId');
  }

  if (normalizedDashboardContext.roomId) {
    url.searchParams.set('roomId', normalizedDashboardContext.roomId);
  } else {
    url.searchParams.delete('roomId');
  }

  return url.toString();
}

function AuthenticatedApp() {
  const { session, signOut } = useAuth();
  const initialHistoryStateRef = useRef<AppHistoryState>(getInitialHistoryState());
  const [screen, setScreen] = useState<AppScreen>(initialHistoryStateRef.current.screen);
  const [dashboardContext, setDashboardContext] = useState<DashboardRoomTarget>(
    initialHistoryStateRef.current.dashboardContext,
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [projectsError, setProjectsError] = useState('');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState<'create' | 'edit'>('create');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [projectCreationPending, setProjectCreationPending] = useState(false);
  const [projectCreationError, setProjectCreationError] = useState('');
  const [projectDeletionPending, setProjectDeletionPending] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  useEffect(() => {
    let active = true;
    void supabaseAccountGateway.loadProfile().then(({ profile: loadedProfile }) => {
      if (active) setProfile(loadedProfile);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void listProjects().then((loadedProjects) => {
      if (!active) return;
      setProjects(loadedProjects);
      setProjectsStatus('ready');
      setProjectsError('');
      const requestedProjectExists = loadedProjects.some((project) => project.id === dashboardContext.projectId);
      if (!requestedProjectExists) {
        const defaultProjectId = loadedProjects[0]?.id ?? '';
        updateDashboardContext({ projectId: defaultProjectId, levelId: '', roomId: '' });
      }
    }).catch(() => {
      if (!active) return;
      setProjects([]);
      setProjectsStatus('error');
      setProjectsError('Les projets n’ont pas pu être chargés. Réessayez.');
    });
    return () => { active = false; };
  }, []);

  async function handleSaveProject() {
    const name = newProjectName.trim();
    if (!name) return;
    setProjectCreationPending(true);
    setProjectCreationError('');
    try {
      if (projectModalMode === 'edit') {
        const currentProject = projects.find((project) => project.id === dashboardContext.projectId);
        if (!currentProject || currentProject.ownerUserId !== session?.user.id) {
          throw new Error('Droits insuffisants');
        }
        const updatedProject = await updateProject(currentProject.id, {
          name,
          address: currentProject.address,
          description: newProjectDescription.trim() || null,
        });
        setProjects((current) => [updatedProject, ...current.filter((project) => project.id !== updatedProject.id)]);
      } else {
        if (!session?.user.id) throw new Error('Session absente');
        const createdProject = await createProject({
          ownerUserId: session.user.id,
          name,
          description: newProjectDescription.trim() || null,
        });
        setProjects((current) => [createdProject, ...current]);
        updateDashboardContext({ projectId: createdProject.id, levelId: '', roomId: '' }, 'push');
      }
      setNewProjectName('');
      setNewProjectDescription('');
      setProjectModalOpen(false);
    } catch {
      setProjectCreationError(projectModalMode === 'edit'
        ? 'Le projet n’a pas pu être modifié. Vérifiez que vous en êtes propriétaire.'
        : 'Le projet n’a pas pu être créé.');
    } finally {
      setProjectCreationPending(false);
    }
  }

  function openCreateProject() {
    setProjectModalMode('create');
    setNewProjectName('');
    setNewProjectDescription('');
    setProjectCreationError('');
    setProjectModalOpen(true);
  }

  function openEditProject(project: Project) {
    setProjectModalMode('edit');
    setNewProjectName(project.name);
    setNewProjectDescription(project.description ?? '');
    setProjectCreationError('');
    setProjectModalOpen(true);
  }

  async function handleDeleteProject() {
    if (!projectToDelete || projectToDelete.ownerUserId !== session?.user.id) return;
    setProjectDeletionPending(true);
    setProjectsError('');
    try {
      await softDeleteProject(projectToDelete.id);
      const remainingProjects = projects.filter((project) => project.id !== projectToDelete.id);
      setProjects(remainingProjects);
      updateDashboardContext({ projectId: remainingProjects[0]?.id ?? '', levelId: '', roomId: '' }, 'push');
      setProjectToDelete(null);
    } catch {
      setProjectsError('Le projet n’a pas pu être supprimé. Vérifiez que vous en êtes propriétaire.');
    } finally {
      setProjectDeletionPending(false);
    }
  }

  useEffect(() => {
    window.history.replaceState(
      createAppHistoryState(screen, dashboardContext),
      '',
      buildAppUrl(screen, dashboardContext),
    );

    function handlePopState(event: PopStateEvent) {
      const nextState = isAppHistoryState(event.state)
        ? createAppHistoryState(event.state.screen, event.state.dashboardContext)
        : getInitialHistoryState();

      setScreen(nextState.screen);
      setDashboardContext(nextState.dashboardContext);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function commitNavigation(
    nextScreen: AppScreen,
    nextDashboardContext: DashboardRoomTarget,
    historyMode: HistoryUpdateMode,
  ) {
    const normalizedDashboardContext = normalizeDashboardContext(nextDashboardContext);
    const normalizedScreen = syncScreenWithContext(nextScreen, normalizedDashboardContext);
    const routeState = createAppHistoryState(normalizedScreen, normalizedDashboardContext);
    const historyMethod = historyMode === 'push'
      && !haveSameRouteCoordinates(screen, dashboardContext, normalizedScreen, normalizedDashboardContext)
      ? 'pushState'
      : 'replaceState';

    window.history[historyMethod](
      routeState,
      '',
      buildAppUrl(normalizedScreen, normalizedDashboardContext),
    );

    setDashboardContext(routeState.dashboardContext);
    setScreen(routeState.screen);
  }

  function pushScreen(nextScreen: AppScreen, nextDashboardContext = dashboardContext) {
    commitNavigation(nextScreen, nextDashboardContext, 'push');
  }

  function updateDashboardContext(
    nextDashboardContext: DashboardRoomTarget,
    historyMode: HistoryUpdateMode = 'replace',
  ) {
    commitNavigation(syncScreenWithContext(screen, nextDashboardContext), nextDashboardContext, historyMode);
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    const fallbackScreen: AppScreen = { name: 'dashboard' };
    commitNavigation(fallbackScreen, dashboardContext, 'replace');
  }

  let content: React.ReactNode;

  if (screen.name === 'room-editor') {
    content = (
      <RoomEditor
        initialProjectId={screen.target.projectId}
        initialLevelId={screen.target.levelId}
        initialRoomId={screen.target.roomId}
        onBack={goBack}
        onContextChange={updateDashboardContext}
      />
    );
  } else if (screen.name === 'global-editor') {
    content = <GlobalEditor2DView
      projectId={dashboardContext.projectId}
      initialLevelId={dashboardContext.levelId}
      onLevelChange={(levelId) => updateDashboardContext({ projectId: dashboardContext.projectId, levelId, roomId: '' }, 'replace')}
    />;
  } else if (screen.name === 'metrics') {
    content = (
      <main className="app-placeholder" tabIndex={-1}>
        <p className="dashboard-eyebrow">Projet courant</p>
        <h2>Métriques</h2>
        <p>Cette vue sera complétée dans une prochaine tâche de la V1.</p>
      </main>
    );
  } else {
    content = <RoomsDashboard
      projectId={dashboardContext.projectId}
      onCreateProject={openCreateProject}
      onOpenGlobalEditor={() => pushScreen({ name: 'global-editor' })}
      onOpenRoom={(target) => {
        pushScreen({ name: 'room-editor', target }, target);
      }}
    />;
  }

  const activeRoute: MainRoute = screen.name === 'global-editor' || screen.name === 'metrics'
    ? screen.name
    : 'dashboard';
  const currentProject = projects.find((project) => project.id === dashboardContext.projectId) ?? null;
  const sidebarProfile = profile ?? {
    displayName: session?.user.user_metadata.display_name ?? 'Utilisateur',
    firstName: session?.user.user_metadata.first_name ?? '',
    lastName: session?.user.user_metadata.last_name ?? '',
    avatarUrl: null,
  };
  const profileInitials = `${sidebarProfile.firstName.trim().charAt(0)}${sidebarProfile.lastName.trim().charAt(0)}`
    .toLocaleUpperCase('fr-FR')
    || sidebarProfile.displayName.trim().slice(0, 2).toLocaleUpperCase('fr-FR');

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'app-shell--sidebar-closed'}`}>
      {sidebarOpen && (
        <AppSidebar
          activeRoute={activeRoute}
          projects={projects}
          currentProjectId={dashboardContext.projectId}
          canManageCurrentProject={currentProject?.ownerUserId === session?.user.id}
          onClose={() => setSidebarOpen(false)}
          onCreateProject={openCreateProject}
          onEditProject={() => { if (currentProject) openEditProject(currentProject); }}
          onDeleteProject={() => { if (currentProject) setProjectToDelete(currentProject); }}
          onManageCollaborators={() => setCollaborationOpen(true)}
          onNavigate={(route) => pushScreen({ name: route })}
          onSelectProject={(projectId) => {
            if (projectId !== dashboardContext.projectId) {
              updateDashboardContext({ projectId, levelId: '', roomId: '' }, 'push');
            }
          }}
        />
      )}
      <div className="app-shell__content">
        <header className="app-globalActions" aria-label="Actions globales">
          {!sidebarOpen && (
            <button className="app-iconButton" type="button" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir la barre latérale" title="Ouvrir la barre latérale">
              <LuMenu aria-hidden="true" />
            </button>
          )}
          <div className="app-globalActions__right">
            <AppNotifications onProjectAccepted={(projectId) => {
              void listProjects().then((loadedProjects) => {
                setProjects(loadedProjects);
                updateDashboardContext({ projectId, levelId: '', roomId: '' }, 'push');
              });
            }} />
            <button className="app-iconButton" type="button" onClick={() => setPreferencesOpen(true)} aria-label="Ouvrir les préférences" title="Ouvrir les préférences">
              <LuSettings aria-hidden="true" />
            </button>
            <button type="button" className="app-userProfile" onClick={() => setAccountOpen(true)} aria-label={`Gérer le compte de ${sidebarProfile.displayName}`}>
              {sidebarProfile.avatarUrl ? (
                <img className="app-userProfile__avatar" src={sidebarProfile.avatarUrl} alt="" />
              ) : (
                <div className="app-userProfile__avatar" aria-hidden="true">{profileInitials}</div>
              )}
              <strong>{sidebarProfile.displayName}</strong>
            </button>
          </div>
        </header>
        {dashboardContext.projectId && <ProjectEditingLockIndicator projectId={dashboardContext.projectId} />}
        {signOutError && <div className="session-error" role="alert">{signOutError}</div>}
        {projectsStatus === 'loading' ? (
          <main className="auth-loading" aria-live="polite">Chargement des projets…</main>
        ) : projectsStatus === 'error' ? (
          <main className="app-placeholder" role="alert">
            <h2>Impossible de charger les projets</h2>
            <p>{projectsError}</p>
            <Button onClick={() => window.location.reload()}>Réessayer</Button>
          </main>
        ) : (
          <>
            {projectsError && <div className="session-error" role="alert">{projectsError}</div>}
            {content}
          </>
        )}
      </div>
      <PreferencesModal opened={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
      {collaborationOpen && currentProject && currentProject.ownerUserId === session?.user.id && <ProjectCollaborationModal projectId={currentProject.id} projectName={currentProject.name} onClose={() => setCollaborationOpen(false)} />}
      {accountOpen && (
        <AccountModal
          onClose={() => setAccountOpen(false)}
          onSignOut={async () => {
            const { error } = await signOut();
            setSignOutError(error ? 'La déconnexion a échoué. Réessayez.' : '');
            if (!error) setAccountOpen(false);
          }}
        />
      )}
      <Modal opened={projectModalOpen} onClose={() => setProjectModalOpen(false)} title={projectModalMode === 'edit' ? 'Modifier le projet' : 'Créer un projet'} centered>
        <div className="app-projectForm">
          <TextInput label="Nom du projet" value={newProjectName} onChange={(event) => setNewProjectName(event.currentTarget.value)} required autoFocus />
          <Textarea label="Description" value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.currentTarget.value)} />
          {projectCreationError && <p className="app-projectForm__error" role="alert">{projectCreationError}</p>}
          <Button onClick={() => void handleSaveProject()} disabled={!newProjectName.trim()} loading={projectCreationPending}>{projectModalMode === 'edit' ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </Modal>
      <Modal opened={Boolean(projectToDelete)} onClose={() => setProjectToDelete(null)} title="Supprimer le projet" centered>
        <div className="app-projectForm">
          <p>Le projet « {projectToDelete?.name} » sera supprimé logiquement et masqué de vos projets actifs.</p>
          <Button color="red" onClick={() => void handleDeleteProject()} loading={projectDeletionPending}>Confirmer la suppression</Button>
        </div>
      </Modal>
    </div>
  );
}

function AppGuard() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <main className="auth-loading" aria-live="polite">Chargement de votre session…</main>;
  }

  if (status !== 'authenticated') {
    return <LoginView sessionExpired={status === 'expired'} />;
  }

  return (
    <AdminProvider>
      <PreferencesProvider><AuthenticatedApp /></PreferencesProvider>
    </AdminProvider>
  );
}

export default function App() {
  return <AuthProvider><AppGuard /></AuthProvider>;
}
