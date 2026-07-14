import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CollaborationGateway } from '../data/supabase/collaboration';
import { AppNotifications } from './AppNotifications';
import { MantineProvider } from '@mantine/core';

describe('AppNotifications', () => {
  it('accepte une invitation et transmet le nouveau projet courant', async () => {
    const gateway: CollaborationGateway = {
      loadOverview: vi.fn(), invite: vi.fn(), resend: vi.fn(), cancel: vi.fn(), changeRole: vi.fn(), remove: vi.fn(),
      listPending: vi.fn()
        .mockResolvedValueOnce([{ id: 'i1', projectId: 'p1', projectName: 'Maison', role: 'écriture' }])
        .mockResolvedValueOnce([{ id: 'i1', projectId: 'p1', projectName: 'Maison', role: 'écriture' }])
        .mockResolvedValue([]),
      accept: vi.fn().mockResolvedValue('p1'),
    };
    const accepted = vi.fn();
    render(<MantineProvider><AppNotifications gateway={gateway} onProjectAccepted={accepted} /></MantineProvider>);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir les notifications' }));
    expect((await screen.findByLabelText('Notifications')).parentElement).toHaveClass('app-notificationsDropdown');
    fireEvent.click((await screen.findByText('Accepter')).closest('button')!);
    await waitFor(() => expect(accepted).toHaveBeenCalledWith('p1'));
  });
});
