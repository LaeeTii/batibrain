import React, { useCallback, useEffect, useState } from 'react';
import { ActionIcon, Button, Popover } from '@mantine/core';
import { LuArrowUpRight, LuBell, LuBellOff, LuCheck, LuFolderInput, LuUserRoundCheck } from 'react-icons/lu';
import { supabaseCollaborationGateway, type CollaborationGateway, type PendingProjectInvitation } from '../data/supabase/collaboration';
import { supabaseAdminGateway } from '../data/supabase/admin';
import { useAdminControls } from './AdminContext';

export function AppNotifications({ onProjectAccepted, gateway = supabaseCollaborationGateway }: { onProjectAccepted(projectId: string): void; gateway?: CollaborationGateway }) {
  const { isAdmin, openAdmin } = useAdminControls();
  const [open, setOpen] = useState(false);
  const [invitations, setInvitations] = useState<PendingProjectInvitation[]>([]);
  const [adminRequestCount, setAdminRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pending = await gateway.listPending();
      setInvitations(pending);
      if (isAdmin) {
        const { overview } = await supabaseAdminGateway.loadOverview();
        setAdminRequestCount(overview?.requests.length ?? 0);
      }
      setError('');
    } catch { setError('Les notifications n’ont pas pu être chargées.'); }
    finally { setLoading(false); }
  }, [gateway, isAdmin]);
  useEffect(() => { void load(); }, [load]);
  const count = invitations.length + adminRequestCount;
  async function accept(invitation: PendingProjectInvitation) {
    setBusy(invitation.id);
    try { const projectId = await gateway.accept(invitation.id); await load(); onProjectAccepted(projectId); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'L’invitation n’a pas pu être acceptée.'); }
    finally { setBusy(''); }
  }
  return <Popover opened={open} onChange={setOpen} position="bottom-end" width="min(440px, calc(100vw - 24px))" withinPortal shadow="md"><Popover.Target><div className="app-notificationsHost">
    <ActionIcon variant="default" className="app-iconButton" onClick={() => { setOpen((value) => !value); if (!open) void load(); }} aria-label="Ouvrir les notifications" aria-expanded={open} title="Ouvrir les notifications">
      <LuBell aria-hidden="true" />
    </ActionIcon>
    {count > 0 && <span className="app-notificationsBadge" aria-hidden="true">{count}</span>}
    </div></Popover.Target><Popover.Dropdown className="app-notificationsDropdown"><section className="app-notifications" aria-label="Notifications">
      {loading ? <p>Chargement…</p> : error ? <p role="alert">{error}</p> : count === 0 ? <><LuBellOff aria-hidden="true" /><p>Aucune notification.</p></> : <div className="app-notificationsList">
        {invitations.map((invitation) => <div className="app-notificationRow" key={invitation.id}><LuFolderInput aria-hidden="true" /><span>Invitation au projet <strong>{invitation.projectName}</strong> en {invitation.role}</span><Button size="xs" loading={busy === invitation.id} onClick={() => void accept(invitation)} leftSection={<LuCheck />}>Accepter</Button></div>)}
        {adminRequestCount > 0 && <div className="app-notificationRow"><LuUserRoundCheck aria-hidden="true" /><span>{adminRequestCount} demande{adminRequestCount > 1 ? 's' : ''} de compte</span><Button size="xs" variant="subtle" onClick={() => { openAdmin(); setOpen(false); }} leftSection={<LuArrowUpRight />}>Administration</Button></div>}
      </div>}
    </section></Popover.Dropdown></Popover>;
}
