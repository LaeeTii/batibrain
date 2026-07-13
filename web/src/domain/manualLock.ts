export type ManualLockResourceType = 'pièce' | 'mur' | 'ouverture';

export interface ManualLockableResource {
  id: string;
  type: ManualLockResourceType;
  isLocked: boolean;
}

export function manualLockActionLabel(isLocked: boolean): 'Verrouiller' | 'Déverrouiller' {
  return isLocked ? 'Déverrouiller' : 'Verrouiller';
}
