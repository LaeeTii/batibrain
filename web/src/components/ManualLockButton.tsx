import { Button } from '@mantine/core';
import { LuLock, LuLockOpen } from 'react-icons/lu';
import { manualLockActionLabel } from '../domain/manualLock';

interface ManualLockButtonProps {
  isLocked: boolean;
  canChangeLock: boolean;
  busy?: boolean;
  onChange: (locked: boolean) => void | Promise<void>;
}

export function ManualLockButton({
  isLocked,
  canChangeLock,
  busy = false,
  onChange,
}: ManualLockButtonProps) {
  const label = manualLockActionLabel(isLocked);
  const Icon = isLocked ? LuLockOpen : LuLock;
  return (
    <Button
      type="button"
      variant="default"
      leftSection={<Icon aria-hidden="true" />}
      disabled={!canChangeLock || busy}
      loading={busy}
      onClick={() => void onChange(!isLocked)}
    >
      {label}
    </Button>
  );
}
