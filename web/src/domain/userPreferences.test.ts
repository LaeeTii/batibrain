import { describe, expect, it } from 'vitest';
import {
  centimetersToDisplay,
  displayToCentimeters,
  displayToSquareCentimeters,
  formatLength,
  formatSurface,
  squareCentimetersToDisplay,
  validateUserPreferences,
  DEFAULT_USER_PREFERENCES,
} from './userPreferences';

describe('préférences utilisateur', () => {
  it('convertit les valeurs affichées sans changer l’unité métier en centimètres', () => {
    expect(centimetersToDisplay(250, 'm')).toBe(2.5);
    expect(centimetersToDisplay(10, 'mm')).toBe(100);
    expect(displayToCentimeters(2.5, 'm')).toBe(250);
    expect(displayToCentimeters(100, 'mm')).toBe(10);
  });

  it.each([
    ['cm', 250, '250 cm'],
    ['m', 2.5, '2,5 m'],
    ['mm', 2500, '2 500 mm'],
  ] as const)('affiche et relit une longueur en %s', (unit, displayed, label) => {
    expect(centimetersToDisplay(250, unit)).toBe(displayed);
    expect(displayToCentimeters(displayed, unit)).toBe(250);
    expect(formatLength(250, unit)).toBe(label);
  });

  it.each([
    ['m2', 6, '6 m²'],
    ['cm2', 60_000, '60 000 cm²'],
    ['mm2', 6_000_000, '6 000 000 mm²'],
  ] as const)('affiche et relit une surface en %s', (unit, displayed, label) => {
    expect(squareCentimetersToDisplay(60_000, unit)).toBe(displayed);
    expect(displayToSquareCentimeters(displayed, unit)).toBe(60_000);
    expect(formatSurface(60_000, unit)).toBe(label);
  });

  it('refuse les valeurs de mur nulles ou négatives', () => {
    expect(validateUserPreferences({ ...DEFAULT_USER_PREFERENCES, defaultWallHeightCm: 0 }))
      .toContain('hauteur');
    expect(validateUserPreferences({ ...DEFAULT_USER_PREFERENCES, defaultWallThicknessCm: -1 }))
      .toContain('épaisseur');
  });
});
