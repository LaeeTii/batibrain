import React from 'react';
import type { DashboardLevelRoomSummary } from './RoomsDashboard';

interface LevelOverviewSummaryProps {
  projectName: string;
  levelName: string;
  rooms: DashboardLevelRoomSummary[];
  totalAreaM2: number;
  onBack: () => void;
  onOpenRoom?: (roomId: string) => void;
}

export function LevelOverviewSummary({
  levelName,
  onBack,
}: LevelOverviewSummaryProps) {
  return (
    <main className="level-overview">
      <header className="level-overview__header">
        <button type="button" className="dashboard-outlineButton" onClick={onBack}>
          Retour au tableau de bord
        </button>

        <div>
          <h1 className="dashboard-pageTitle">Vue d’ensemble — {levelName}</h1>
        </div>
      </header>
    </main>
  );
}