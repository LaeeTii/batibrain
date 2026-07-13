import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../components/AuthProvider';
import type { AuthGateway } from '../data/supabase/auth';
import { LoginView } from './LoginView';

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  const emptyListener = vi.fn();
  return {
    getSession: vi.fn().mockResolvedValue({ session: null, error: null }),
    onAuthStateChange: vi.fn(() => ({
      id: 'test-subscription',
      callback: emptyListener,
      unsubscribe: vi.fn(),
    } as Subscription)),
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    requestPasswordReset: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

function renderLogin(gateway: AuthGateway) {
  return render(<AuthProvider gateway={gateway}><LoginView /></AuthProvider>);
}

describe('LoginView', () => {
  it('valide les champs avant de solliciter Supabase', async () => {
    const gateway = createGateway();
    renderLogin(gateway);

    fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: 'adresse-invalide' } });
    fireEvent.blur(screen.getByLabelText('Adresse e-mail'));

    expect(await screen.findByText('Saisissez une adresse e-mail valide.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeDisabled();
    expect(gateway.signIn).not.toHaveBeenCalled();
  });

  it('conserve l’e-mail et purge le mot de passe après un échec', async () => {
    const gateway = createGateway({
      signIn: vi.fn().mockResolvedValue({ error: new Error('Identifiants invalides') }),
    });
    renderLogin(gateway);

    fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: 'camille@example.com' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion impossible');
    expect(screen.getByLabelText('Adresse e-mail')).toHaveValue('camille@example.com');
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('');
  });

  it('transmet le choix de persistance lors de la connexion', async () => {
    const gateway = createGateway();
    renderLogin(gateway);

    fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: 'camille@example.com' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByLabelText('Se souvenir de moi'));
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(gateway.signIn).toHaveBeenCalledWith('camille@example.com', 'secret', false));
  });

  it('lance le flux de mot de passe oublié avec un retour neutre', async () => {
    const gateway = createGateway();
    renderLogin(gateway);

    fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: 'camille@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Si cette adresse correspond à un compte');
    expect(gateway.requestPasswordReset).toHaveBeenCalledWith('camille@example.com');
  });
});

describe('AuthProvider', () => {
  it('restaure une session existante', async () => {
    const session = { access_token: 'jeton' } as Session;
    const gateway = createGateway({
      getSession: vi.fn().mockResolvedValue({ session, error: null }),
    });

    function Witness() {
      return <LoginView />;
    }

    render(<AuthProvider gateway={gateway}><Witness /></AuthProvider>);
    await waitFor(() => expect(gateway.getSession).toHaveBeenCalledOnce());
  });

  it('écoute l’expiration de la session', async () => {
    let listener: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;
    const gateway = createGateway({
      onAuthStateChange: vi.fn((callback) => {
        listener = callback;
        return {
          id: 'expiration-subscription',
          callback,
          unsubscribe: vi.fn(),
        } as Subscription;
      }),
    });

    function GuardWitness() {
      const { status } = useAuth();
      return <LoginView sessionExpired={status === 'expired'} />;
    }

    render(<AuthProvider gateway={gateway}><GuardWitness /></AuthProvider>);
    await waitFor(() => expect(listener).toBeDefined());
    listener?.('TOKEN_REFRESHED', null);
    expect(await screen.findByText('Votre session a expiré. Veuillez vous reconnecter.')).toBeInTheDocument();
  });
});
