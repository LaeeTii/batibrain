import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CollaborationGateway } from '../data/supabase/collaboration';
import { ProjectCollaborationModal } from './ProjectCollaborationModal';
import { MantineProvider } from '@mantine/core';

function gateway(): CollaborationGateway {
  return {
    loadOverview: vi.fn().mockResolvedValue({ invitations: [{ id: 'i1', email: 'invite@example.test', role: 'lecture', updatedAt: '' }], collaborators: [] }),
    invite: vi.fn().mockResolvedValue(undefined), resend: vi.fn().mockResolvedValue(undefined), cancel: vi.fn().mockResolvedValue(undefined),
    changeRole: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined), listPending: vi.fn().mockResolvedValue([]), accept: vi.fn(),
  };
}

describe('ProjectCollaborationModal', () => {
  it('invite un compte existant et affiche les invitations en attente', async () => {
    const mock = gateway();
    render(<MantineProvider><ProjectCollaborationModal projectId="p1" projectName="Maison" onClose={vi.fn()} gateway={mock} /></MantineProvider>);
    expect(await screen.findByText(/invite@example.test/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Adresse e-mail' }), { target: { value: 'ami@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inviter' }));
    await waitFor(() => expect(mock.invite).toHaveBeenCalledWith('p1', 'ami@example.test', 'lecture'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Adresse e-mail' })).toHaveValue(''));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('conserve l’adresse et affiche une erreur lorsque l’invitation échoue', async () => {
    const mock = gateway();
    mock.invite = vi.fn().mockRejectedValue(new Error('Compte introuvable.'));
    render(<MantineProvider><ProjectCollaborationModal projectId="p1" projectName="Maison" onClose={vi.fn()} gateway={mock} /></MantineProvider>);
    await screen.findByText(/invite@example.test/);
    fireEvent.change(screen.getByRole('textbox', { name: 'Adresse e-mail' }), { target: { value: 'inconnu@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inviter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Compte introuvable.');
    expect(screen.getByRole('textbox', { name: 'Adresse e-mail' })).toHaveValue('inconnu@example.test');
  });
});
