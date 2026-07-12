export type SupabaseEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

const CONFIGURATION_ERROR =
  'Supabase n’est pas configuré correctement. Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans web/.env.local.';

export function parseSupabaseConfig(environment: SupabaseEnvironment): SupabaseConfig {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const anonKey = environment.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey || !isValidHttpUrl(url)) {
    throw new Error(CONFIGURATION_ERROR);
  }

  return { url, anonKey };
}

export function hasValidSupabaseConfig(environment: SupabaseEnvironment): boolean {
  try {
    parseSupabaseConfig(environment);
    return true;
  } catch {
    return false;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
