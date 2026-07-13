import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { LoginView } from './views/LoginView';
import { LevelOverviewSummary } from './views/LevelOverviewSummary';
import { RoomEditor } from './views/RoomEditor';
import {
  RoomsDashboard,
  type DashboardLevelTarget,
  type DashboardRoomTarget,
} from './views/RoomsDashboard';

type AppScreen =
  | { name: 'dashboard' }
  | { name: 'level-overview'; target: DashboardLevelTarget }
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
  if (routeName === 'room-editor') {
    return {
      name: 'room-editor',
      target: dashboardContext,
    };
  }

  if (routeName === 'level-overview') {
    return {
      name: 'level-overview',
      target: {
        projectId: dashboardContext.projectId,
        projectName: '',
        levelId: dashboardContext.levelId,
        levelName: '',
        rooms: [],
        totalAreaM2: 0,
        focusedRoomId: dashboardContext.roomId || undefined,
      },
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

  if (screenName === 'dashboard') {
    return true;
  }

  if (screenName === 'room-editor') {
    return 'target' in value && isDashboardRoomTarget(value.target);
  }

  if (screenName === 'level-overview') {
    return 'target' in value && typeof value.target === 'object' && value.target !== null;
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

  if (screen.name === 'level-overview') {
    return {
      name: 'level-overview',
      target: {
        ...screen.target,
        projectId: dashboardContext.projectId,
        levelId: dashboardContext.levelId,
        focusedRoomId: dashboardContext.roomId || undefined,
      },
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
  const initialHistoryStateRef = useRef<AppHistoryState>(getInitialHistoryState());
  const [screen, setScreen] = useState<AppScreen>(initialHistoryStateRef.current.screen);
  const [dashboardContext, setDashboardContext] = useState<DashboardRoomTarget>(
    initialHistoryStateRef.current.dashboardContext,
  );

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

  if (screen.name === 'room-editor') {
    return (
      <RoomEditor
        initialProjectId={screen.target.projectId}
        initialLevelId={screen.target.levelId}
        initialRoomId={screen.target.roomId}
        onBack={goBack}
        onContextChange={updateDashboardContext}
      />
    );
  }

  if (screen.name === 'level-overview') {
    return (
      <LevelOverviewSummary
        target={screen.target}
        onBack={goBack}
        onContextChange={updateDashboardContext}
        onOpenRoom={(roomId) => {
          const nextTarget = {
            projectId: screen.target.projectId,
            levelId: screen.target.levelId,
            roomId,
          };

          pushScreen({ name: 'room-editor', target: nextTarget }, nextTarget);
        }}
      />
    );
  }

  return (
    <RoomsDashboard
      initialProjectId={dashboardContext.projectId}
      initialLevelId={dashboardContext.levelId}
      initialRoomId={dashboardContext.roomId}
      onContextChange={updateDashboardContext}
      onOpenRoom={(target) => {
        pushScreen({ name: 'room-editor', target }, target);
      }}
      onOpenLevelOverview={(target) => {
        const nextDashboardContext = {
          projectId: target.projectId,
          levelId: target.levelId,
          roomId: target.focusedRoomId ?? '',
        };

        pushScreen({ name: 'level-overview', target }, nextDashboardContext);
      }}
    />
  );
}

function AppGuard() {
  const { status, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState('');

  if (status === 'loading') {
    return <main className="auth-loading" aria-live="polite">Chargement de votre session…</main>;
  }

  if (status !== 'authenticated') {
    return <LoginView sessionExpired={status === 'expired'} />;
  }

  return (
    <>
      {signOutError && <div className="session-error" role="alert">{signOutError}</div>}
      <button
        type="button"
        className="session-signOut"
        onClick={async () => {
          const { error } = await signOut();
          setSignOutError(error ? 'La déconnexion a échoué. Réessayez.' : '');
        }}
      >
        Se déconnecter
      </button>
      <AuthenticatedApp />
    </>
  );
}

export default function App() {
  return <AuthProvider><AppGuard /></AuthProvider>;
}
