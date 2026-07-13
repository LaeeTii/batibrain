import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ManualLockButton } from './ManualLockButton';

describe('ManualLockButton', () => {
  const renderButton = (component: ReactNode) => render(
    <MantineProvider>{component}</MantineProvider>,
  );

  it('permet à un éditeur de verrouiller', () => {
    const onChange = vi.fn();
    renderButton(<ManualLockButton isLocked={false} canChangeLock onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verrouiller' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('laisse le déverrouillage visible mais indisponible en lecture', () => {
    renderButton(<ManualLockButton isLocked canChangeLock={false} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Déverrouiller' })).toBeDisabled();
  });
});
