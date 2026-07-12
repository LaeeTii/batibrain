import { describe, expect, it } from 'vitest';
import { hasValidSupabaseConfig, parseSupabaseConfig } from './config';

describe('configuration Supabase', () => {
  it('accepte une configuration complète', () => {
    expect(parseSupabaseConfig({
      VITE_SUPABASE_URL: 'https://exemple.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'clé-publique',
    })).toEqual({
      url: 'https://exemple.supabase.co',
      anonKey: 'clé-publique',
    });
  });

  it.each([
    {},
    { VITE_SUPABASE_URL: 'adresse-invalide', VITE_SUPABASE_ANON_KEY: 'clé' },
    { VITE_SUPABASE_URL: 'https://exemple.supabase.co' },
  ])('signale une configuration invalide', (environment) => {
    expect(() => parseSupabaseConfig(environment)).toThrow(
      'Supabase n’est pas configuré correctement.',
    );
    expect(hasValidSupabaseConfig(environment)).toBe(false);
  });
});
