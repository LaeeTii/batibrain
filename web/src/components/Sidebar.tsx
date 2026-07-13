import React from 'react';
import { LuShield } from 'react-icons/lu';
import { useAdminControls } from './AdminContext';

const DASHBOARD_NAV_ITEMS = [
  { shortLabel: 'TB', label: 'Tableau de bord', isActive: true },
  { shortLabel: 'TV', label: 'Travaux', isActive: false },
  { shortLabel: 'DC', label: 'Documents', isActive: false },
  { shortLabel: 'PH', label: 'Photos', isActive: false },
  { shortLabel: 'TK', label: 'Tâches', isActive: false },
  { shortLabel: 'IA', label: 'Assistant IA', isActive: false },
];

export function Sidebar() {
  const { isAdmin, openAdmin } = useAdminControls();
  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-brandBlock">
        <div className="dashboard-brandMark">BB</div>
        <div>
          <h1 className="dashboard-brandTitle">BatiBrain</h1>
        </div>
      </div>

      <div className="dashboard-profileCard">
        <div className="dashboard-profileAvatar">PM</div>
        <div>
          <strong>Profil projet</strong>
          <p className="dashboard-userMeta">Propriétaire</p>
        </div>
      </div>

      <nav className="dashboard-nav">
        {DASHBOARD_NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`dashboard-navItem ${item.isActive ? 'is-active' : ''}`}
            disabled={!item.isActive}
          >
            <span className="dashboard-navIcon">{item.shortLabel}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {isAdmin && (
        <button type="button" className="dashboard-adminButton" onClick={openAdmin}>
          <LuShield aria-hidden="true" /> Admin
        </button>
      )}
    </aside>
  );
}
