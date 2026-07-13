import React from 'react';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreferencesGateway } from '../data/supabase/preferences';
import { DEFAULT_USER_PREFERENCES } from '../domain/userPreferences';
import { PreferencesProvider } from './PreferencesContext';
import { PreferencesModal } from './PreferencesModal';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

function renderPreferences(gateway: PreferencesGateway) {
  render(
    <MantineProvider>
      <PreferencesProvider gateway={gateway}>
        <PreferencesModal opened onClose={vi.fn()} />
      </PreferencesProvider>
    </MantineProvider>,
  );
}

describe('PreferencesModal', () => {
  it('relit les préférences et enregistre les valeurs de mur en centimètres', async () => {
    const gateway: PreferencesGateway = {
      load: vi.fn().mockResolvedValue({ ...DEFAULT_USER_PREFERENCES, lengthUnit: 'm' }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    renderPreferences(gateway);

    const height = await screen.findByRole('textbox', { name: 'Hauteur de mur par défaut (m)' });
    expect(height).toHaveValue('2.5');
    fireEvent.change(height, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les préférences' }));

    await waitFor(() => expect(gateway.save).toHaveBeenCalledWith(expect.objectContaining({
      lengthUnit: 'm',
      defaultWallHeightCm: 300,
      defaultWallThicknessCm: 10,
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('Préférences enregistrées.');
  });

  it('applique le thème enregistré dès le chargement', async () => {
    const gateway: PreferencesGateway = {
      load: vi.fn().mockResolvedValue({ ...DEFAULT_USER_PREFERENCES, theme: 'foncé' }),
      save: vi.fn(),
    };
    renderPreferences(gateway);

    await waitFor(() => expect(document.documentElement.dataset.mantineColorScheme).toBe('dark'));
  });
});
