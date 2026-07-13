import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppSidebar } from './AppSidebar';

const defaultProps = {
  projects: [],
  currentProjectId: '',
  onCreateProject: vi.fn(),
  onSelectProject: vi.fn(),
};

describe('AppSidebar', () => {
  it('expose la vue active et navigue avec des liens', () => {
    const onNavigate = vi.fn();
    render(<AppSidebar {...defaultProps} activeRoute="dashboard" onClose={vi.fn()} onNavigate={onNavigate} />);

    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('link', { name: 'Édition globale' }));
    expect(onNavigate).toHaveBeenCalledWith('global-editor');
  });

  it('rend les destinations futures indisponibles et non activables au clavier', () => {
    render(<AppSidebar {...defaultProps} activeRoute="dashboard" onClose={vi.fn()} onNavigate={vi.fn()} />);

    const photos = screen.getByText('Photos').closest('a');
    expect(photos).toHaveAttribute('aria-disabled', 'true');
    expect(photos).toHaveAttribute('tabindex', '-1');
    expect(photos).not.toHaveAttribute('href');
  });

  it('permet de fermer la barre latérale avec une commande nommée', () => {
    const onClose = vi.fn();
    render(<AppSidebar {...defaultProps} activeRoute="dashboard" onClose={onClose} onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fermer la barre latérale' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('affiche le sélecteur de projet avant la navigation et le bouton de création', () => {
    render(<AppSidebar {...defaultProps} projects={[{ id: 'p1', name: 'Maison' }]} currentProjectId="p1" activeRoute="dashboard" onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Projet courant' })).toHaveValue('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Créer un projet' }));
    expect(defaultProps.onCreateProject).toHaveBeenCalled();
  });

});
