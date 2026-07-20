import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../components/PreferencesContext';
import { DEFAULT_USER_PREFERENCES } from '../domain/userPreferences';
import { RoomsDashboard } from './RoomsDashboard';

vi.mock('../lib/supabase', () => ({
  hasSupabaseConfig: () => true,
  getSupabaseClient: vi.fn(),
}));

describe('état sans projet du dashboard', () => {
  it('affiche uniquement l’action de création du premier projet', () => {
    const onCreateProject = vi.fn();
    const preferencesGateway = {
      load: vi.fn().mockResolvedValue(DEFAULT_USER_PREFERENCES),
      save: vi.fn().mockResolvedValue(undefined),
    };

    render(<MantineProvider><PreferencesProvider gateway={preferencesGateway}>
      <RoomsDashboard
        projectId=""
        onCreateProject={onCreateProject}
        onOpenGlobalEditor={vi.fn()}
        onOpenRoom={vi.fn()}
      />
    </PreferencesProvider></MantineProvider>);

    const action = screen.getByRole('button', { name: 'Créer un nouveau projet' });
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByText(/bienvenue|commencer à structurer/i)).not.toBeInTheDocument();
    fireEvent.click(action);
    expect(onCreateProject).toHaveBeenCalledOnce();
  });
});
