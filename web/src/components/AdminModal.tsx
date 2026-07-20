import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, NativeSelect } from '@mantine/core';
import {
  LuCircleAlert,
  LuLoaderCircle,
  LuShield,
  LuUserCheck,
  LuUserRoundX,
  LuX,
} from 'react-icons/lu';
import type { AdminUserSummary, UserRole } from '../domain/types';
import { supabaseAdminGateway, type AdminGateway, type AdminOverview } from '../data/supabase/admin';

export function AdminModal({
  onClose,
  gateway = supabaseAdminGateway,
}: {
  onClose(): void;
  gateway?: AdminGateway;
}) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { overview: loadedOverview, error } = await gateway.loadOverview();
    setLoading(false);
    if (error || !loadedOverview) {
      setError(error?.message ?? 'Les comptes n’ont pas pu être chargés.');
      return;
    }
    setOverview(loadedOverview);
    setError(null);
  }, [gateway]);

  useEffect(() => {
    closeRef.current?.focus();
    void load();
  }, [load]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function approve(requestId: string) {
    setActionId(requestId);
    setError(null);
    const { error } = await gateway.approveRequest(requestId);
    setActionId(null);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  async function changeRole(user: AdminUserSummary, role: UserRole) {
    if (role === user.role) return;
    setActionId(user.userId);
    setError(null);
    const { error } = await gateway.changeRole(user.userId, role);
    setActionId(null);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActionId(deleteTarget.userId);
    const { error } = await gateway.deleteUser(deleteTarget.userId, deleteTarget.ownedProjectCount);
    setActionId(null);
    if (error) {
      setError(error.message);
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <header className="settings-header">
          <div><p className="dashboard-eyebrow">Administration</p><h2 id="admin-title">Comptes</h2></div>
          <ActionIcon ref={closeRef} variant="subtle" className="settings-close" aria-label="Fermer l’administration" onClick={onClose}><LuX aria-hidden="true" /></ActionIcon>
        </header>

        {error && <div className="login-message login-message--error" role="alert">
          <LuCircleAlert aria-hidden="true" />{error}
        </div>}

        {loading && !overview ? <p className="settings-loading"><LuLoaderCircle className="is-spinning" aria-hidden="true" /> Chargement des comptes…</p> : overview && (
          <div className="admin-content">
            <section className="settings-section">
              <h3>Demandes en attente <span className="admin-count">{overview.requests.length}</span></h3>
              {overview.requests.length === 0 ? <p>Aucune demande en attente.</p> : (
                <div className="admin-list">
                  {overview.requests.map((request) => <article className="admin-row" key={request.id}>
                    <div><strong>{request.displayName}</strong><p>{request.firstName} {request.lastName} · {request.email}</p></div>
                    <Button variant="light" className="settings-secondaryButton" disabled={actionId !== null} loading={actionId === request.id} onClick={() => void approve(request.id)}>
                      {actionId === request.id ? <LuLoaderCircle className="is-spinning" aria-hidden="true" /> : <LuUserCheck aria-hidden="true" />} Approuver
                    </Button>
                  </article>)}
                </div>
              )}
            </section>

            <section className="settings-section">
              <h3>Utilisateurs <span className="admin-count">{overview.users.length}</span></h3>
              {overview.users.length === 0 ? <p>Aucun utilisateur.</p> : (
                <div className="admin-list">
                  <div className="admin-userHeader" aria-hidden="true">
                    <span>Utilisateur</span>
                    <span><LuShield aria-hidden="true" /> Rôle</span>
                    <span>Actions</span>
                  </div>
                  {overview.users.map((user) => {
                    const isSelf = user.userId === overview.currentUserId;
                    return <article className="admin-row admin-userRow" key={user.userId}>
                      <div><strong>{user.displayName}{isSelf ? ' (vous)' : ''}</strong><p>{user.firstName} {user.lastName} · {user.email}</p></div>
                      <div className="admin-role">
                        <NativeSelect aria-label={`Rôle de ${user.displayName}`} value={user.role} disabled={isSelf || actionId !== null} onChange={(event) => void changeRole(user, event.target.value as UserRole)} data={[{ value: 'user', label: 'Utilisateur' }, { value: 'admin', label: 'Administrateur' }]} />
                      </div>
                      <Button color="red" variant="light" className="admin-delete" disabled={isSelf || actionId !== null} onClick={() => setDeleteTarget(user)}>
                        <LuUserRoundX aria-hidden="true" /> Supprimer
                      </Button>
                    </article>;
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {deleteTarget && <div className="admin-confirmBackdrop" role="presentation">
          <section className="admin-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <h3 id="delete-title">Supprimer {deleteTarget.displayName} ?</h3>
            <p id="delete-description">Cette action supprimera définitivement ce compte ainsi que {deleteTarget.ownedProjectCount} projet{deleteTarget.ownedProjectCount > 1 ? 's' : ''} possédé{deleteTarget.ownedProjectCount > 1 ? 's' : ''} et toutes les données associées.</p>
            <div className="dashboard-modalActions">
              <Button variant="default" className="settings-secondaryButton" onClick={() => setDeleteTarget(null)}>Annuler</Button>
              <Button color="red" className="admin-delete admin-delete--confirm" loading={actionId !== null} onClick={() => void confirmDelete()} leftSection={<LuUserRoundX aria-hidden="true" />}>Confirmer la suppression</Button>
            </div>
          </section>
        </div>}
      </section>
    </div>
  );
}
