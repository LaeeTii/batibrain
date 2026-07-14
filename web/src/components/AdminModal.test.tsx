import React from 'react';
import { fireEvent, render as testingRender, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import type { AdminGateway, AdminOverview } from '../data/supabase/admin';
import { AdminModal } from './AdminModal';

const render = (component: React.ReactNode) => testingRender(<MantineProvider>{component}</MantineProvider>);

const OVERVIEW: AdminOverview = {
  currentUserId: 'admin-1',
  requests: [{
    id: 'request-1', email: 'alice@example.test', displayName: 'Alice',
    firstName: 'Alice', lastName: 'Martin', createdAt: '2026-07-13T10:00:00Z',
  }],
  users: [
    { userId: 'admin-1', displayName: 'Ada', firstName: 'Ada', lastName: 'Min', email: 'ada@example.test', role: 'admin', ownedProjectCount: 0 },
    { userId: 'user-1', displayName: 'Bob', firstName: 'Bob', lastName: 'Durand', email: 'bob@example.test', role: 'user', ownedProjectCount: 2 },
  ],
};

function gateway(overrides: Partial<AdminGateway> = {}): AdminGateway {
  return {
    loadOverview: vi.fn().mockResolvedValue({ overview: OVERVIEW, error: null }),
    approveRequest: vi.fn().mockResolvedValue({ error: null }),
    changeRole: vi.fn().mockResolvedValue({ error: null }),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

async function renderModal(adminGateway = gateway()) {
  render(<AdminModal onClose={vi.fn()} gateway={adminGateway} />);
  await screen.findByText('Bob');
  return adminGateway;
}

describe('AdminModal', () => {
  it('affiche les demandes et les comptes avec leurs rôles', async () => {
    await renderModal();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByLabelText('Rôle de Ada')).toHaveValue('admin');
    expect(screen.getByLabelText('Rôle de Bob')).toHaveValue('user');
  });

  it('approuve une demande puis recharge la liste', async () => {
    const adminGateway = await renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Approuver' }));
    await waitFor(() => expect(adminGateway.approveRequest).toHaveBeenCalledWith('request-1'));
    await waitFor(() => expect(adminGateway.loadOverview).toHaveBeenCalledTimes(2));
  });

  it('interdit de modifier ou supprimer son propre compte', async () => {
    await renderModal();
    const ownRow = screen.getByText('Ada (vous)').closest('article');
    expect(ownRow?.querySelector('select')).toBeDisabled();
    expect(ownRow?.querySelector('button')).toBeDisabled();
  });

  it('modifie le rôle d’un autre utilisateur', async () => {
    const adminGateway = await renderModal();
    const bobRow = screen.getByText('Bob').closest('article');
    fireEvent.change(bobRow!.querySelector('select')!, { target: { value: 'admin' } });
    await waitFor(() => expect(adminGateway.changeRole).toHaveBeenCalledWith('user-1', 'admin'));
  });

  it('confirme le nombre de projets avant de supprimer un compte', async () => {
    const adminGateway = await renderModal();
    const bobRow = screen.getByText('Bob').closest('article');
    fireEvent.click(bobRow!.querySelector('button')!);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('2 projets possédés');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    await waitFor(() => expect(adminGateway.deleteUser).toHaveBeenCalledWith('user-1', 2));
  });
});
