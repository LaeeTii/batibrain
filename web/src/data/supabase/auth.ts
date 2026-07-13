import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import {
  clearSessionPersistence,
  getSupabaseClient,
  selectSessionPersistence,
} from './client';

export type AuthResult = { error: Error | null };

export interface AuthGateway {
  getSession(): Promise<{ session: Session | null; error: Error | null }>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): Subscription;
  signIn(email: string, password: string, remember: boolean): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<AuthResult>;
}

export const supabaseAuthGateway: AuthGateway = {
  async getSession() {
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      return { session: data.session, error };
    } catch (error) {
      return { session: null, error: normalizeError(error) };
    }
  },

  onAuthStateChange(callback) {
    return getSupabaseClient().auth.onAuthStateChange(callback).data.subscription;
  },

  async signIn(email, password, remember) {
    try {
      selectSessionPersistence(remember);
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });

      if (!error && !data.session) {
        return { error: new Error('Aucune session valide n’a été créée.') };
      }

      return { error };
    } catch (error) {
      return { error: normalizeError(error) };
    }
  },

  async signOut() {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (!error) clearSessionPersistence();
      return { error };
    } catch (error) {
      return { error: normalizeError(error) };
    }
  },

  async requestPasswordReset(email) {
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo });
      return { error };
    } catch (error) {
      return { error: normalizeError(error) };
    }
  },
};

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Le service d’authentification est indisponible.');
}
