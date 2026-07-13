import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentification requise.' }, 401);

    const supabaseUrl = requiredEnvironment('SUPABASE_URL');
    const anonKey = requiredEnvironment('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Session administrateur invalide.' }, 401);

    const { data: profile, error: profileError } = await userClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .single();
    if (profileError || profile?.role !== 'admin') return json({ error: 'Accès administrateur requis.' }, 403);

    const body = await request.json() as { requestId?: string };
    if (!body.requestId) return json({ error: 'Identifiant de demande requis.' }, 400);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: accountRequest, error: requestError } = await serviceClient
      .from('account_creation_requests')
      .select('id,email,status')
      .eq('id', body.requestId)
      .single();
    if (requestError || !accountRequest) return json({ error: 'Demande de compte introuvable.' }, 404);
    if (accountRequest.status !== 'en_attente') return json({ error: 'Cette demande a déjà été traitée.' }, 409);

    const { error: invitationError } = await serviceClient.auth.admin.inviteUserByEmail(
      accountRequest.email,
      {
        data: {
          account_creation_request_id: accountRequest.id,
          approved_by_user_id: authData.user.id,
        },
      },
    );
    if (invitationError) return json({ error: invitationError.message }, 409);

    return json({ approved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur inattendue.';
    return json({ error: message }, 500);
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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
