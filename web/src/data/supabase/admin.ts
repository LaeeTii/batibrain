import type { AccountRequestSummary, AdminUserSummary, UserRole } from '../../domain/types';
import { getSupabaseClient } from './client';

export type AdminOverview = { currentUserId: string; users: AdminUserSummary[]; requests: AccountRequestSummary[] };
export type AdminActionResult = { error: Error | null };

export interface AdminGateway {
  loadOverview(): Promise<{ overview: AdminOverview | null; error: Error | null }>;
  approveRequest(requestId: string): Promise<AdminActionResult>;
  changeRole(userId: string, role: UserRole): Promise<AdminActionResult>;
  deleteUser(userId: string, confirmedProjectCount: number): Promise<AdminActionResult>;
}

export const supabaseAdminGateway: AdminGateway = {
  async loadOverview() {
    const { data, error } = await getSupabaseClient().functions.invoke('admin-accounts', { method: 'GET' });
    if (error) return { overview: null, error: await normalizeFunctionError(error) };
    return {
      overview: {
        currentUserId: String(data.currentUserId),
        users: (data.users ?? []).map(mapUser),
        requests: (data.requests ?? []).map(mapRequest),
      },
      error: null,
    };
  },

  async approveRequest(requestId) {
    const { error } = await getSupabaseClient().functions.invoke('approve-account-request', { body: { requestId } });
    return { error: error ? await normalizeFunctionError(error) : null };
  },

  async changeRole(userId, role) {
    const { error } = await getSupabaseClient().functions.invoke('admin-accounts', {
      method: 'PATCH', body: { userId, role },
    });
    return { error: error ? await normalizeFunctionError(error) : null };
  },

  async deleteUser(userId, confirmedProjectCount) {
    const { error } = await getSupabaseClient().functions.invoke('admin-accounts', {
      method: 'DELETE', body: { userId, confirmedProjectCount },
    });
    return { error: error ? await normalizeFunctionError(error) : null };
  },
};

function mapUser(data: Record<string, unknown>): AdminUserSummary {
  return {
    userId: String(data.userId),
    displayName: String(data.displayName),
    firstName: String(data.firstName),
    lastName: String(data.lastName),
    email: String(data.email),
    role: data.role as UserRole,
    ownedProjectCount: Number(data.ownedProjectCount),
  };
}

function mapRequest(data: Record<string, unknown>): AccountRequestSummary {
  return {
    id: String(data.id),
    email: String(data.email),
    displayName: String(data.display_name),
    firstName: String(data.first_name),
    lastName: String(data.last_name),
    createdAt: String(data.created_at),
  };
}

async function normalizeFunctionError(error: unknown): Promise<Error> {
  if (typeof error === 'object' && error !== null && 'context' in error && error.context instanceof Response) {
    const body = await error.context.clone().json().catch(() => null) as { error?: string } | null;
    if (body?.error) return new Error(body.error);
  }
  return error instanceof Error ? error : new Error('Le service d’administration est indisponible.');
}
