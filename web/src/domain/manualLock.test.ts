import { describe, expect, it } from 'vitest';
import {
  manualLockActionLabel,
  profileLockState,
  roomLockState,
  setProfilePointLocks,
  setVertexLocks,
  wallLockState,
} from './manualLock';

describe('manualLockActionLabel', () => {
  it('propose de verrouiller une ressource libre', () => {
    expect(manualLockActionLabel(false)).toBe('Verrouiller');
  });

  it('conserve le déverrouillage disponible sur une ressource verrouillée', () => {
    expect(manualLockActionLabel(true)).toBe('Déverrouiller');
  });
});

describe('verrouillage calculé par points', () => {
  const vertices = [
    { id: 'a', pieceId: 'pièce', order: 0, x: 0, y: 0, isLocked: true },
    { id: 'b', pieceId: 'pièce', order: 1, x: 100, y: 0, isLocked: false },
  ];

  it('calcule les états d’un mur et d’une pièce depuis leurs sommets', () => {
    expect(wallLockState({ startVertexId: 'a', endVertexId: 'b' }, vertices)).toBe(false);
    expect(roomLockState(vertices)).toBe(false);
    const locked = setVertexLocks(vertices, new Set(['b']), true);
    expect(wallLockState({ startVertexId: 'a', endVertexId: 'b' }, locked)).toBe(true);
    expect(roomLockState(locked)).toBe(true);
  });

  it('verrouille un profil en modifiant uniquement ses points', () => {
    const points = [
      { id: 'p1', wallId: 'mur', faceSide: 'gauche' as const, order: 0, positionCm: 0, heightCm: 250, isLocked: false },
      { id: 'p2', wallId: 'mur', faceSide: 'gauche' as const, order: 1, positionCm: 100, heightCm: 250, isLocked: false },
    ];
    expect(profileLockState(points)).toBe(false);
    expect(profileLockState(setProfilePointLocks(points, true))).toBe(true);
  });
});
