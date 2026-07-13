import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountRequestForm } from './AccountRequestForm';

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: ' Camille@Example.com ' } });
  fireEvent.change(screen.getByLabelText('Nom d’affichage'), { target: { value: ' Camille R. ' } });
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: ' Camille ' } });
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: ' Robert ' } });
}

describe('AccountRequestForm', () => {
  it('ne demande aucun mot de passe et valide les champs obligatoires', () => {
    render(<AccountRequestForm onBack={vi.fn()} />);

    expect(screen.queryByLabelText(/mot de passe/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(screen.getByText('Saisissez une adresse e-mail valide.')).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse e-mail')).toHaveFocus();
  });

  it('normalise et envoie une demande complète', async () => {
    const submit = vi.fn().mockResolvedValue({ requestId: 'demande-1', error: null });
    render(<AccountRequestForm onBack={vi.fn()} submit={submit} />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith({
      email: 'camille@example.com',
      displayName: 'Camille R.',
      firstName: 'Camille',
      lastName: 'Robert',
    }));
    expect(await screen.findByText('Demande envoyée')).toBeInTheDocument();
    expect(screen.getByText(/administrateur doit l’approuver/)).toBeInTheDocument();
  });

  it('affiche explicitement un conflit d’unicité', async () => {
    const submit = vi.fn().mockResolvedValue({
      requestId: null,
      error: new Error('Ce nom d’affichage est déjà utilisé ou demandé.'),
    });
    render(<AccountRequestForm onBack={vi.fn()} submit={submit} />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('déjà utilisé ou demandé');
  });
});
