import React, { useState } from 'react';
import { LevelOverviewSummary } from './views/LevelOverviewSummary';
import { ProjectOverviewSummary } from './views/ProjectOverviewSummary';
import { RoomEditorDemo as RoomEditor } from './views/RoomEditor';
import {
  RoomsDashboard,
  type DashboardLevelTarget,
  type DashboardProjectTarget,
  type DashboardRoomTarget,
} from './views/RoomsDashboard';

type AppScreen =
  | { name: 'dashboard' }
  | { name: 'level-overview'; target: DashboardLevelTarget }
  | { name: 'project-overview'; target: DashboardProjectTarget }
  | { name: 'room-editor'; target: DashboardRoomTarget };

export default function App() {
  const [screen, setScreen] = useState<AppScreen>({ name: 'dashboard' });
  const [dashboardContext, setDashboardContext] = useState<DashboardRoomTarget>({
    projectId: '',
    levelId: '',
    roomId: '',
  });

  if (screen.name === 'room-editor') {
    return (
      <RoomEditor
        initialProjectId={screen.target.projectId}
        initialLevelId={screen.target.levelId}
        initialRoomId={screen.target.roomId}
        onBack={() => setScreen({ name: 'dashboard' })}
      />
    );
  }

  if (screen.name === 'level-overview') {
    return (
      <LevelOverviewSummary
        projectName={screen.target.projectName}
        levelName={screen.target.levelName}
        rooms={screen.target.rooms}
        totalAreaM2={screen.target.totalAreaM2}
        onBack={() => setScreen({ name: 'dashboard' })}
        onOpenRoom={(roomId) => {
          const nextTarget = {
            projectId: screen.target.projectId,
            levelId: screen.target.levelId,
            roomId,
          };

          setDashboardContext(nextTarget);
          setScreen({ name: 'room-editor', target: nextTarget });
        }}
      />
    );
  }

  if (screen.name === 'project-overview') {
    return (
      <ProjectOverviewSummary
        target={screen.target}
        onBack={() => setScreen({ name: 'dashboard' })}
        onOpenLevel={(target) => {
          setDashboardContext({
            projectId: target.projectId,
            levelId: target.levelId,
            roomId: target.focusedRoomId ?? '',
          });
          setScreen({ name: 'level-overview', target });
        }}
      />
    );
  }

  return (
    <RoomsDashboard
      initialProjectId={dashboardContext.projectId}
      initialLevelId={dashboardContext.levelId}
      initialRoomId={dashboardContext.roomId}
      onOpenRoom={(target) => {
        setDashboardContext(target);
        setScreen({ name: 'room-editor', target });
      }}
      onOpenLevelOverview={(target) => {
        setDashboardContext({
          projectId: target.projectId,
          levelId: target.levelId,
          roomId: target.focusedRoomId ?? '',
        });
        setScreen({ name: 'level-overview', target });
      }}
      onOpenProjectOverview={(target) => {
        setDashboardContext((currentTarget) => ({
          projectId: target.projectId,
          levelId: target.focusedLevelId ?? currentTarget.levelId,
          roomId: currentTarget.roomId,
        }));
        setScreen({ name: 'project-overview', target });
      }}
    />
  );
}
