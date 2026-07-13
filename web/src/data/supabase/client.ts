import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasValidSupabaseConfig, parseSupabaseConfig } from './config';

let supabaseClient: SupabaseClient | null = null;

const REMEMBER_SESSION_KEY = 'batibrain.auth.remember';

const authStorage = {
  getItem(key: string): string | null {
    const remember = window.localStorage.getItem(REMEMBER_SESSION_KEY) === 'true';
    return (remember ? window.localStorage : window.sessionStorage).getItem(key);
  },
  setItem(key: string, value: string): void {
    const remember = window.localStorage.getItem(REMEMBER_SESSION_KEY) === 'true';
    const selectedStorage = remember ? window.localStorage : window.sessionStorage;
    const otherStorage = remember ? window.sessionStorage : window.localStorage;

    selectedStorage.setItem(key, value);
    otherStorage.removeItem(key);
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

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
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: authStorage,
      },
    });
  }

  return supabaseClient;
}

export function selectSessionPersistence(remember: boolean): void {
  if (remember) {
    window.localStorage.setItem(REMEMBER_SESSION_KEY, 'true');
  } else {
    window.localStorage.removeItem(REMEMBER_SESSION_KEY);
  }
}

export function clearSessionPersistence(): void {
  window.localStorage.removeItem(REMEMBER_SESSION_KEY);
}
