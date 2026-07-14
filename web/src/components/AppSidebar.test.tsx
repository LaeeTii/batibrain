import React from 'react';
import { fireEvent, render as testingRender, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { AppSidebar } from './AppSidebar';

const render = (component: React.ReactNode) => testingRender(<MantineProvider>{component}</MantineProvider>);

const defaultProps = {
  projects: [],
  currentProjectId: '',
  canManageCurrentProject: false,
  onCreateProject: vi.fn(),
  onEditProject: vi.fn(),
  onDeleteProject: vi.fn(),
  onManageCollaborators: vi.fn(),
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
    render(<AppSidebar {...defaultProps} projects={[{ id: 'p1', name: 'Maison', ownerUserId: 'u1', updatedAt: '2026-07-13T10:00:00Z' }]} currentProjectId="p1" activeRoute="dashboard" onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Projet courant' })).toHaveValue('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Créer un projet' }));
    expect(defaultProps.onCreateProject).toHaveBeenCalled();
  });

  it('expose les actions du projet courant', () => {
    render(<AppSidebar {...defaultProps} canManageCurrentProject projects={[{ id: 'p1', name: 'Maison', ownerUserId: 'u1', updatedAt: '2026-07-13T10:00:00Z' }]} currentProjectId="p1" activeRoute="dashboard" onClose={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le projet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le projet' }));
    expect(defaultProps.onEditProject).toHaveBeenCalled();
    expect(defaultProps.onDeleteProject).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Gérer les collaborateurs' }));
    expect(defaultProps.onManageCollaborators).toHaveBeenCalled();
  });

  it('masque les actions de gestion sans droit propriétaire', () => {
    render(<AppSidebar {...defaultProps} projects={[{ id: 'p1', name: 'Projet partagé', ownerUserId: 'autre', updatedAt: '2026-07-13T10:00:00Z' }]} currentProjectId="p1" activeRoute="dashboard" onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Modifier le projet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer le projet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gérer les collaborateurs' })).not.toBeInTheDocument();
  });

});
