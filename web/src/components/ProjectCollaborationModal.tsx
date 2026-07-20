import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Select, TextInput } from '@mantine/core';
import { LuSend, LuShield, LuUserMinus, LuUserPlus, LuX } from 'react-icons/lu';
import { supabaseCollaborationGateway, type CollaborationGateway, type CollaborationOverview, type ProjectAccessRole } from '../data/supabase/collaboration';

export function ProjectCollaborationModal({ projectId, projectName, onClose, gateway = supabaseCollaborationGateway }: { projectId: string; projectName: string; onClose(): void; gateway?: CollaborationGateway }) {
  const [overview, setOverview] = useState<CollaborationOverview | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectAccessRole>('lecture');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setOverview(await gateway.loadOverview(projectId));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
    }
  }, [gateway, projectId]);
  useEffect(() => { void load(); }, [load]);
  async function act(id: string, action: () => Promise<void>): Promise<boolean> {
    setBusy(id);
    setError('');
    try {
      await action();
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action impossible.');
      return false;
    } finally {
      setBusy('');
    }
  }
  return <Modal opened onClose={onClose} title={`Collaborateurs — ${projectName}`} size="lg" centered>
    <form className="collaboration-form" onSubmit={(event) => { event.preventDefault(); void act('invite', () => gateway.invite(projectId, email.trim(), role)).then((succeeded) => { if (succeeded) setEmail(''); }); }}>
      <TextInput label="Adresse e-mail" type="email" required value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
      <Select label="Rôle" value={role} onChange={(value) => setRole(value as ProjectAccessRole)} data={[{ value: 'lecture', label: 'Lecture' }, { value: 'écriture', label: 'Écriture' }]} />
      <Button type="submit" loading={busy === 'invite'} leftSection={<LuUserPlus />}>Inviter</Button>
    </form>
    {error && <p role="alert">{error}</p>}
    <h3>Invitations en attente</h3>
    {!overview ? <p>Chargement…</p> : overview.invitations.length === 0 ? <p>Aucune invitation en attente.</p> : overview.invitations.map((invitation) => <div className="collaboration-row" key={invitation.id}><span>{invitation.email} — {invitation.role}</span><Button variant="subtle" loading={busy === invitation.id} onClick={() => void act(invitation.id, () => gateway.resend(invitation.id))} leftSection={<LuSend />}>Renvoyer</Button><Button color="red" variant="subtle" onClick={() => void act(invitation.id, () => gateway.cancel(invitation.id))} leftSection={<LuX />}>Annuler</Button></div>)}
    <h3>Collaborateurs</h3>
    {overview && overview.collaborators.length === 0 ? <p>Aucun collaborateur.</p> : overview?.collaborators.map((collaborator) => <div className="collaboration-row" key={collaborator.id}><span>{collaborator.displayName} — {collaborator.email}</span><Select aria-label={`Rôle de ${collaborator.displayName}`} value={collaborator.role} onChange={(value) => value && void act(collaborator.id, () => gateway.changeRole(collaborator.id, value as ProjectAccessRole))} data={[{ value: 'lecture', label: 'Lecture' }, { value: 'écriture', label: 'Écriture' }]} leftSection={<LuShield />} /><Button color="red" variant="subtle" onClick={() => void act(collaborator.id, () => gateway.remove(collaborator.id))} leftSection={<LuUserMinus />}>Retirer</Button></div>)}
  </Modal>;
}
