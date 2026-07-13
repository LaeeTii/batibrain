import { getSupabaseClient } from './client';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '../../domain/userPreferences';

export type PreferencesGateway = {
  load(): Promise<UserPreferences>;
  save(preferences: UserPreferences): Promise<void>;
};

export async function loadUserPreferences(): Promise<UserPreferences> {
  const client = getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error('Session introuvable.');
  const { data, error } = await client.from('user_preferences')
    .select('length_unit,surface_unit,theme,default_wall_height_cm,default_wall_thickness_cm')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_USER_PREFERENCES;
  return {
    lengthUnit: data.length_unit,
    surfaceUnit: data.surface_unit,
    theme: data.theme,
    defaultWallHeightCm: Number(data.default_wall_height_cm),
    defaultWallThicknessCm: Number(data.default_wall_thickness_cm),
  };
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  const client = getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error('Session introuvable.');
  const { error } = await client.from('user_preferences').upsert({
    user_id: authData.user.id,
    length_unit: preferences.lengthUnit,
    surface_unit: preferences.surfaceUnit,
    theme: preferences.theme,
    default_wall_height_cm: preferences.defaultWallHeightCm,
    default_wall_thickness_cm: preferences.defaultWallThicknessCm,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export const supabasePreferencesGateway: PreferencesGateway = {
  load: loadUserPreferences,
  save: saveUserPreferences,
};
