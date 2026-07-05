import React from 'react';
import type { DashboardLevelTarget, DashboardProjectTarget } from './RoomsDashboard';

interface ProjectOverviewSummaryProps {
  target: DashboardProjectTarget;
  onBack: () => void;
  onOpenLevel?: (target: DashboardLevelTarget) => void;
}
export function ProjectOverviewSummary({ target, onBack }: ProjectOverviewSummaryProps) {
  return (
    <main className="project-overview">
      <header className="project-overview__header">
        <button type="button" className="dashboard-outlineButton" onClick={onBack}>
          Retour au tableau de bord
        </button>

        <div>
          <h1 className="dashboard-pageTitle">Plan global du projet</h1>
        </div>
      </header>
    </main>
  );
}