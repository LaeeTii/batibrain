import { describe, expect, it } from 'vitest';
import { manualLockActionLabel } from './manualLock';

describe('manualLockActionLabel', () => {
  it('propose de verrouiller une ressource libre', () => {
    expect(manualLockActionLabel(false)).toBe('Verrouiller');
  });

  it('conserve le déverrouillage disponible sur une ressource verrouillée', () => {
    expect(manualLockActionLabel(true)).toBe('Déverrouiller');
  });
});
