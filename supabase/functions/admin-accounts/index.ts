import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, withCors } from '../_shared/cors.ts';

Deno.serve(async (request) => {
  const headers = corsHeaders(request, 'GET, PATCH, DELETE, OPTIONS');
  if (!headers) return json({ error: 'Origine non autorisée.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const context = await createAdminContext(request);
    if (context instanceof Response) return withCors(context, headers);

    if (request.method === 'GET') return withCors(await listAccounts(context.serviceClient, context.adminUser.id), headers);
    if (request.method === 'PATCH') return withCors(await changeRole(request, context), headers);
    if (request.method === 'DELETE') return withCors(await deleteAccount(request, context), headers);
    return withCors(json({ error: 'Méthode non autorisée.' }, 405), headers);
  } catch (error) {
    return withCors(json({ error: error instanceof Error ? error.message : 'Erreur serveur inattendue.' }, 500), headers);
  }
});

type AdminContext = {
  adminUser: User;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
};

async function createAdminContext(request: Request): Promise<AdminContext | Response> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentification requise.' }, 401);

  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const userClient = createClient(supabaseUrl, requiredEnvironment('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Session administrateur invalide.' }, 401);

  const { data: profile, error: profileError } = await userClient
    .from('user_profiles').select('role').eq('user_id', authData.user.id).single();
  if (profileError || profile?.role !== 'admin') return json({ error: 'Accès administrateur requis.' }, 403);

  return {
    adminUser: authData.user,
    userClient,
    serviceClient: createClient(supabaseUrl, requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function listAccounts(serviceClient: SupabaseClient, currentUserId: string): Promise<Response> {
  const [{ data: profiles, error: profilesError }, { data: requests, error: requestsError }, authResult] = await Promise.all([
    serviceClient.from('user_profiles').select('user_id,display_name,first_name,last_name,role').order('created_at'),
    serviceClient.from('account_creation_requests').select('id,email,display_name,first_name,last_name,created_at').eq('status', 'en_attente').order('created_at'),
    serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (profilesError || requestsError || authResult.error) {
    return json({ error: 'Les comptes n’ont pas pu être chargés.' }, 500);
  }

  const emails = new Map(authResult.data.users.map((user) => [user.id, user.email ?? '']));
  const projectCounts = await Promise.all((profiles ?? []).map(async (profile) => {
    const { count } = await serviceClient.from('projects').select('id', { count: 'exact', head: true }).eq('owner_user_id', profile.user_id);
    return [profile.user_id, count ?? 0] as const;
  }));
  const counts = new Map(projectCounts);

  return json({
    currentUserId,
    users: (profiles ?? []).map((profile) => ({
      userId: profile.user_id,
      displayName: profile.display_name,
      firstName: profile.first_name,
      lastName: profile.last_name,
      role: profile.role,
      email: emails.get(profile.user_id) ?? '',
      ownedProjectCount: counts.get(profile.user_id) ?? 0,
    })),
    requests: requests ?? [],
  });
}

async function changeRole(request: Request, context: AdminContext): Promise<Response> {
  const body = await request.json() as { userId?: string; role?: string };
  if (!body.userId || !body.role) return json({ error: 'Utilisateur et rôle requis.' }, 400);
  if (body.userId === context.adminUser.id) return json({ error: 'Un administrateur ne peut pas modifier son propre rôle.' }, 409);
  if (!['user', 'admin'].includes(body.role)) return json({ error: 'Rôle utilisateur invalide.' }, 400);

  const { error } = await context.userClient.rpc('set_user_role', {
    target_user_id: body.userId,
    new_role: body.role,
  });
  if (error) return json({ error: error.message }, 409);
  return json({ updated: true });
}

async function deleteAccount(request: Request, context: AdminContext): Promise<Response> {
  const body = await request.json() as { userId?: string; confirmedProjectCount?: number };
  const confirmedProjectCount = body.confirmedProjectCount;
  if (!body.userId || !Number.isInteger(confirmedProjectCount) || (confirmedProjectCount ?? -1) < 0) {
    return json({ error: 'Confirmation de suppression invalide.' }, 400);
  }
  if (body.userId === context.adminUser.id) return json({ error: 'Un administrateur ne peut pas supprimer son propre compte.' }, 409);

  const { data: target, error: targetError } = await context.serviceClient
    .from('user_profiles').select('role').eq('user_id', body.userId).single();
  if (targetError || !target) return json({ error: 'Utilisateur introuvable.' }, 404);

  if (target.role === 'admin') {
    const { count } = await context.serviceClient.from('user_profiles').select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
    if ((count ?? 0) <= 1) return json({ error: 'Le dernier administrateur ne peut pas être supprimé.' }, 409);
  }

  const { count: projectCount } = await context.serviceClient
    .from('projects').select('id', { count: 'exact', head: true }).eq('owner_user_id', body.userId);
  if ((projectCount ?? 0) !== confirmedProjectCount) {
    return json({ error: 'Le nombre de projets a changé. Rechargez la liste avant de confirmer.' }, 409);
  }

  const { error } = await context.serviceClient.auth.admin.deleteUser(body.userId);
  if (error) return json({ error: error.message }, 409);
  return json({ deleted: true });
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variable serveur manquante : ${name}.`);
  return value;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
