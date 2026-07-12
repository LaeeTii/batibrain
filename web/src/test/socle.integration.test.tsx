import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function TestWitness() {
  return <main>Socle BatiBrain opérationnel</main>;
}

describe('socle React', () => {
  it('rend un composant dans le DOM de test', () => {
    render(<TestWitness />);
    expect(screen.getByRole('main')).toHaveTextContent('Socle BatiBrain opérationnel');
  });
});
