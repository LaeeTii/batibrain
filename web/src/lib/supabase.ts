import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function readSupabaseEnv() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export function hasSupabaseConfig(): boolean {
  const { url, anonKey } = readSupabaseEnv();
  return Boolean(url && anonKey);
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey } = readSupabaseEnv();

  if (!url || !anonKey) {
    throw new Error(
      'Supabase n\'est pas configuré. Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans web/.env.local.',
    );
  }

  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}