import { describe, expect, it } from 'vitest';
import {
  centimetersToDisplay,
  displayToCentimeters,
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

  it('refuse les valeurs de mur nulles ou négatives', () => {
    expect(validateUserPreferences({ ...DEFAULT_USER_PREFERENCES, defaultWallHeightCm: 0 }))
      .toContain('hauteur');
    expect(validateUserPreferences({ ...DEFAULT_USER_PREFERENCES, defaultWallThicknessCm: -1 }))
      .toContain('épaisseur');
  });
});
