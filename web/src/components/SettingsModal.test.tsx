import React from 'react';
import { fireEvent, render as testingRender, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '../domain/types';
import type { AccountGateway } from '../data/supabase/account';
import { MAX_AVATAR_SIZE_BYTES, validateAvatar } from '../data/supabase/account';
import { SettingsModal } from './SettingsModal';

const render = (component: React.ReactNode) => testingRender(<MantineProvider>{component}</MantineProvider>);

const PROFILE: UserProfile = {
  userId: 'user-1',
  displayName: 'Camille',
  firstName: 'Camille',
  lastName: 'Robert',
  avatarStoragePath: null,
  avatarUrl: null,
  role: 'user',
};

function gateway(overrides: Partial<AccountGateway> = {}): AccountGateway {
  return {
    loadProfile: vi.fn().mockResolvedValue({ profile: PROFILE, email: 'camille@example.com', error: null }),
    updateProfile: vi.fn().mockResolvedValue({ profile: PROFILE, error: null }),
    requestEmailChange: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

async function renderModal(accountGateway = gateway()) {
  const onSignOut = vi.fn().mockResolvedValue(undefined);
  render(<SettingsModal onClose={vi.fn()} onSignOut={onSignOut} gateway={accountGateway} />);
  await screen.findByLabelText('Nom d’affichage');
  return { accountGateway, onSignOut };
}

describe('SettingsModal', () => {
  it('refuse une image dépassant 5 Mio', () => {
    const file = new File([new Uint8Array(MAX_AVATAR_SIZE_BYTES + 1)], 'avatar.png', { type: 'image/png' });
    expect(validateAvatar(file)).toBe('L’image ne doit pas dépasser 5 Mio.');
  });

  it('charge et enregistre les champs du profil', async () => {
    const updated = { ...PROFILE, displayName: 'Camille R.' };
    const accountGateway = gateway({ updateProfile: vi.fn().mockResolvedValue({ profile: updated, error: null }) });
    await renderModal(accountGateway);

    fireEvent.change(screen.getByLabelText('Nom d’affichage'), { target: { value: 'Camille R.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));

    await waitFor(() => expect(accountGateway.updateProfile).toHaveBeenCalledWith({
      displayName: 'Camille R.', firstName: 'Camille', lastName: 'Robert',
    }, null));
    expect(await screen.findByRole('status')).toHaveTextContent('Profil enregistré.');
  });

  it('signale un nom d’affichage déjà utilisé sans effacer les saisies', async () => {
    const accountGateway = gateway({
      updateProfile: vi.fn().mockResolvedValue({ profile: null, error: new Error('duplicate key unique') }),
    });
    await renderModal(accountGateway);
    fireEvent.change(screen.getByLabelText('Nom d’affichage'), { target: { value: 'Nom pris' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('déjà utilisé');
    expect(screen.getByLabelText('Nom d’affichage')).toHaveValue('Nom pris');
  });

  it('refuse un fichier qui n’est pas une image autorisée', async () => {
    await renderModal();
    const file = new File(['contenu'], 'avatar.txt', { type: 'text/plain' });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('JPEG, PNG, WebP ou GIF');
  });

  it('conserve l’adresse active pendant la confirmation de la nouvelle adresse', async () => {
    const { accountGateway } = await renderModal();
    fireEvent.change(screen.getByLabelText('Nouvelle adresse e-mail'), { target: { value: 'nouvelle@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Demander le changement' }));

    await waitFor(() => expect(accountGateway.requestEmailChange).toHaveBeenCalledWith('nouvelle@example.com'));
    expect(await screen.findByRole('status')).toHaveTextContent('L’adresse active reste camille@example.com');
  });

  it('valide la confirmation avant de modifier le mot de passe', async () => {
    const { accountGateway } = await renderModal();
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'nouveau-secret' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'différent-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ne correspondent pas');
    expect(accountGateway.updatePassword).not.toHaveBeenCalled();
  });

  it('permet la déconnexion depuis la section Compte', async () => {
    const { onSignOut } = await renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
