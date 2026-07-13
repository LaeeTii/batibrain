import { getSupabaseClient } from './client';

export type ProjectAccessRole = 'lecture' | 'écriture';
export type ProjectInvitation = { id: string; email: string; role: ProjectAccessRole; updatedAt: string };
export type ProjectCollaborator = { id: string; userId: string; email: string; displayName: string; role: ProjectAccessRole };
export type PendingProjectInvitation = { id: string; projectId: string; projectName: string; role: ProjectAccessRole };
export type CollaborationOverview = { invitations: ProjectInvitation[]; collaborators: ProjectCollaborator[] };

export interface CollaborationGateway {
  loadOverview(projectId: string): Promise<CollaborationOverview>;
  invite(projectId: string, email: string, role: ProjectAccessRole): Promise<void>;
  resend(invitationId: string): Promise<void>;
  cancel(invitationId: string): Promise<void>;
  changeRole(collaborationId: string, role: ProjectAccessRole): Promise<void>;
  remove(collaborationId: string): Promise<void>;
  listPending(): Promise<PendingProjectInvitation[]>;
  accept(invitationId: string): Promise<string>;
}

function fail(error: unknown): never {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  if (message.includes('PROJECT_INVITEE_NOT_FOUND')) throw new Error('Aucun compte BatiBrain ne correspond à cette adresse e-mail.');
  if (message.includes('PROJECT_COLLABORATION_EXISTS')) throw new Error('Ce compte collabore déjà au projet.');
  if (message.includes('duplicate key')) throw new Error('Une invitation est déjà en attente pour ce compte.');
  if (message.includes('PROJECT_OWNER_REQUIRED')) throw new Error('Seul le propriétaire peut gérer les accès au projet.');
  throw error instanceof Error ? error : new Error('L’opération de collaboration a échoué.');
}

export const supabaseCollaborationGateway: CollaborationGateway = {
  async loadOverview(projectId) {
    const { data, error } = await getSupabaseClient().rpc('project_collaboration_overview', { target_project_id: projectId });
    if (error) fail(error);
    const value = data as { invitations?: Record<string, unknown>[]; collaborators?: Record<string, unknown>[] };
    return {
      invitations: (value.invitations ?? []).map((item) => ({ id: String(item.id), email: String(item.email), role: item.role as ProjectAccessRole, updatedAt: String(item.updated_at) })),
      collaborators: (value.collaborators ?? []).map((item) => ({ id: String(item.id), userId: String(item.user_id), email: String(item.email), displayName: String(item.display_name ?? item.email), role: item.role as ProjectAccessRole })),
    };
  },
  async invite(projectId, email, role) { const { error } = await getSupabaseClient().rpc('invite_project_member', { target_project_id: projectId, target_email: email, target_role: role }); if (error) fail(error); },
  async resend(invitationId) { const { error } = await getSupabaseClient().rpc('resend_project_invitation', { target_invitation_id: invitationId }); if (error) fail(error); },
  async cancel(invitationId) { const { error } = await getSupabaseClient().rpc('cancel_project_invitation', { target_invitation_id: invitationId }); if (error) fail(error); },
  async changeRole(collaborationId, role) { const { error } = await getSupabaseClient().from('project_collaborations').update({ role, updated_at: new Date().toISOString() }).eq('id', collaborationId); if (error) fail(error); },
  async remove(collaborationId) { const { error } = await getSupabaseClient().from('project_collaborations').delete().eq('id', collaborationId); if (error) fail(error); },
  async listPending() { const { data, error } = await getSupabaseClient().rpc('pending_project_invitations'); if (error) fail(error); return (data ?? []).map((item: Record<string, unknown>) => ({ id: String(item.id), projectId: String(item.project_id), projectName: String(item.project_name), role: item.role as ProjectAccessRole })); },
  async accept(invitationId) { const { data, error } = await getSupabaseClient().rpc('accept_project_invitation', { target_invitation_id: invitationId }); if (error) fail(error); return String(data); },
};
