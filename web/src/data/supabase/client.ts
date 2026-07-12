import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasValidSupabaseConfig, parseSupabaseConfig } from './config';

let supabaseClient: SupabaseClient | null = null;

function readSupabaseEnvironment() {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export function hasSupabaseConfig(): boolean {
  return hasValidSupabaseConfig(readSupabaseEnvironment());
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const { url, anonKey } = parseSupabaseConfig(readSupabaseEnvironment());
    supabaseClient = createClient(url, anonKey);
  }

  return supabaseClient;
}
