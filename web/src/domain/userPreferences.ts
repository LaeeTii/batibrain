export type LengthUnit = 'cm' | 'm' | 'mm';
export type SurfaceUnit = 'm2' | 'cm2' | 'mm2';
export type UiTheme = 'clair' | 'foncé' | 'system';

export type UserPreferences = {
  lengthUnit: LengthUnit;
  surfaceUnit: SurfaceUnit;
  theme: UiTheme;
  defaultWallHeightCm: number;
  defaultWallThicknessCm: number;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  lengthUnit: 'cm',
  surfaceUnit: 'm2',
  theme: 'system',
  defaultWallHeightCm: 250,
  defaultWallThicknessCm: 10,
};

export function centimetersToDisplay(valueCm: number, unit: LengthUnit): number {
  if (unit === 'm') return valueCm / 100;
  if (unit === 'mm') return valueCm * 10;
  return valueCm;
}

export function displayToCentimeters(value: number, unit: LengthUnit): number {
  if (unit === 'm') return value * 100;
  if (unit === 'mm') return value / 10;
  return value;
}

export function validateUserPreferences(preferences: UserPreferences): string | null {
  if (!Number.isFinite(preferences.defaultWallHeightCm) || preferences.defaultWallHeightCm <= 0) {
    return 'La hauteur de mur par défaut doit être strictement positive.';
  }
  if (!Number.isFinite(preferences.defaultWallThicknessCm) || preferences.defaultWallThicknessCm <= 0) {
    return 'L’épaisseur de mur par défaut doit être strictement positive.';
  }
  return null;
}
