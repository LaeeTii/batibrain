import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, withCors } from '../_shared/cors.ts';

Deno.serve(async (request) => {
  const headers = corsHeaders(request, 'POST, OPTIONS');
  if (!headers) return json({ error: 'Origine non autorisée.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return withCors(json({ error: 'Authentification requise.' }, 401), headers);

    const supabaseUrl = requiredEnvironment('SUPABASE_URL');
    const anonKey = requiredEnvironment('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return withCors(json({ error: 'Session administrateur invalide.' }, 401), headers);

    const { data: profile, error: profileError } = await userClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .single();
    if (profileError || profile?.role !== 'admin') return withCors(json({ error: 'Accès administrateur requis.' }, 403), headers);

    const body = await request.json() as { requestId?: string };
    if (!body.requestId) return withCors(json({ error: 'Identifiant de demande requis.' }, 400), headers);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: accountRequest, error: requestError } = await serviceClient
      .from('account_creation_requests')
      .select('id,email,status')
      .eq('id', body.requestId)
      .single();
    if (requestError || !accountRequest) return withCors(json({ error: 'Demande de compte introuvable.' }, 404), headers);
    if (accountRequest.status !== 'en_attente') return withCors(json({ error: 'Cette demande a déjà été traitée.' }, 409), headers);

    const { error: invitationError } = await serviceClient.auth.admin.inviteUserByEmail(
      accountRequest.email,
      {
        redirectTo: 'https://laeetii.github.io/batibrain/',
        data: {
          account_creation_request_id: accountRequest.id,
          approved_by_user_id: authData.user.id,
        },
      },
    );
    if (invitationError) return withCors(json({ error: invitationError.message }, 409), headers);

    return withCors(json({ approved: true }), headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur inattendue.';
    return withCors(json({ error: message }, 500), headers);
  }
});

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
