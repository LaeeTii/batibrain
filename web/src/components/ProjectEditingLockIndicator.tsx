import { Alert } from '@mantine/core';
import { useEffect, useState } from 'react';
import { LuLock } from 'react-icons/lu';
import { getProjectEditingLock } from '../data/supabase/editingLock';
import type { ProjectEditingLock } from '../domain/types';

export function ProjectEditingLockIndicator({ projectId }: { projectId: string }) {
  const [lock, setLock] = useState<ProjectEditingLock | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const nextLock = await getProjectEditingLock(projectId);
        if (active) setLock(nextLock);
      } catch {
        if (active) setLock(null);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [projectId]);

  if (!lock?.isActive || lock.heldByCurrentUser) return null;

  return (
    <Alert color="orange" icon={<LuLock aria-hidden="true" />} role="status">
      Lecture seule temporaire : {lock.holderDisplayName ?? 'un autre utilisateur'} modifie ce projet.
    </Alert>
  );
}
