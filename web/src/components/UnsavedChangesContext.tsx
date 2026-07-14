import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface UnsavedChangesContextValue {
  hasUnsavedChanges: boolean;
  setSourceDirty(source: string, dirty: boolean): void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [dirtySources, setDirtySources] = useState<Record<string, boolean>>({});

  const setSourceDirty = useCallback((source: string, dirty: boolean) => {
    setDirtySources((current) => {
      const currentValue = current[source] === true;

      if (dirty) {
        if (currentValue) return current;
        return { ...current, [source]: true };
      }

      if (!currentValue) return current;

      const next = { ...current };
      delete next[source];
      return next;
    });
  }, []);

  const value = useMemo<UnsavedChangesContextValue>(() => ({
    hasUnsavedChanges: Object.values(dirtySources).some((dirty) => dirty),
    setSourceDirty,
  }), [dirtySources, setSourceDirty]);

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) throw new Error('useUnsavedChanges doit être utilisé dans UnsavedChangesProvider.');
  return context;
}
