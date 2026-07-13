import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabaseAuthGateway, type AuthGateway, type AuthResult } from '../data/supabase/auth';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'expired';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  signIn(email: string, password: string, remember: boolean): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  gateway = supabaseAuthGateway,
}: {
  children: ReactNode;
  gateway?: AuthGateway;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;

    void gateway.getSession().then(({ session: restoredSession, error }) => {
      if (!active) return;
      setSession(restoredSession);
      setStatus(restoredSession ? 'authenticated' : error ? 'expired' : 'anonymous');
    });

    const subscription = gateway.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);

      if (nextSession) {
        setStatus('authenticated');
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setStatus('expired');
      } else {
        setStatus('anonymous');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [gateway]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    signIn: gateway.signIn.bind(gateway),
    signOut: async () => {
      const result = await gateway.signOut();
      if (!result.error) {
        setSession(null);
        setStatus('anonymous');
      }
      return result;
    },
    requestPasswordReset: gateway.requestPasswordReset.bind(gateway),
  }), [gateway, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return context;
}
