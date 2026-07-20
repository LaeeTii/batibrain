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

const NUMBER_FORMATTER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const LENGTH_UNIT_LABELS: Record<LengthUnit, string> = {
  cm: 'cm',
  m: 'm',
  mm: 'mm',
};

export const SURFACE_UNIT_LABELS: Record<SurfaceUnit, string> = {
  m2: 'm²',
  cm2: 'cm²',
  mm2: 'mm²',
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

export function squareCentimetersToDisplay(valueCm2: number, unit: SurfaceUnit): number {
  if (unit === 'm2') return valueCm2 / 10_000;
  if (unit === 'mm2') return valueCm2 * 100;
  return valueCm2;
}

export function displayToSquareCentimeters(value: number, unit: SurfaceUnit): number {
  if (unit === 'm2') return value * 10_000;
  if (unit === 'mm2') return value / 100;
  return value;
}

export function formatLength(valueCm: number, unit: LengthUnit): string {
  return `${NUMBER_FORMATTER.format(centimetersToDisplay(valueCm, unit))} ${LENGTH_UNIT_LABELS[unit]}`;
}

export function formatSurface(valueCm2: number, unit: SurfaceUnit): string {
  return `${NUMBER_FORMATTER.format(squareCentimetersToDisplay(valueCm2, unit))} ${SURFACE_UNIT_LABELS[unit]}`;
}

export function formatSurfaceFromSquareMeters(valueM2: number, unit: SurfaceUnit): string {
  return formatSurface(valueM2 * 10_000, unit);
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
