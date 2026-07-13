import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_USER_PREFERENCES,
  type UiTheme,
  type UserPreferences,
} from '../domain/userPreferences';
import {
  supabasePreferencesGateway,
  type PreferencesGateway,
} from '../data/supabase/preferences';

type PreferencesContextValue = {
  preferences: UserPreferences;
  loading: boolean;
  loadError: string;
  save(preferences: UserPreferences): Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
  gateway = supabasePreferencesGateway,
}: {
  children: ReactNode;
  gateway?: PreferencesGateway;
}) {
  const [preferences, setPreferences] = useState(DEFAULT_USER_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    void gateway.load()
      .then((loaded) => {
        if (!active) return;
        setPreferences(loaded);
        applyTheme(loaded.theme);
      })
      .catch(() => {
        if (!active) return;
        setLoadError('Les préférences n’ont pas pu être chargées. Les valeurs par défaut sont utilisées.');
        applyTheme(DEFAULT_USER_PREFERENCES.theme);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [gateway]);

  useEffect(() => {
    if (preferences.theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme('system');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preferences.theme]);

  const value = useMemo<PreferencesContextValue>(() => ({
    preferences,
    loading,
    loadError,
    save: async (nextPreferences) => {
      await gateway.save(nextPreferences);
      setPreferences(nextPreferences);
      applyTheme(nextPreferences.theme);
    },
  }), [gateway, loadError, loading, preferences]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences doit être utilisé dans PreferencesProvider.');
  return context;
}

export function applyTheme(theme: UiTheme): void {
  const dark = theme === 'foncé'
    || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mantineColorScheme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
