import { useOfflineUiStore } from './offlineUiStore';
import { cn } from '@/lib/cn';

/** Compact badge for the live score header. */
export function OfflineScoreBadge() {
  const connection = useOfflineUiStore((s) => s.connection);
  const pending = useOfflineUiStore((s) => s.pendingCount);
  const failed = useOfflineUiStore((s) => s.failedCount);
  const flash = useOfflineUiStore((s) => s.lastFlash);

  if (connection === 'ONLINE' && pending === 0 && failed === 0 && !flash) {
    return (
      <span
        className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary"
        data-testid="sync-confidence-badge"
      >
        Synced
      </span>
    );
  }

  if (connection === 'OFFLINE' || pending > 0) {
    return (
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
          'bg-warning/15 text-warning',
        )}
        data-testid="sync-confidence-badge"
      >
        Offline{pending > 0 ? ` · ${pending} pending` : ''}
      </span>
    );
  }

  if (failed > 0 || connection === 'SYNC_ERROR') {
    return (
      <span
        className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-danger"
        data-testid="sync-confidence-badge"
      >
        Sync error
      </span>
    );
  }

  if (connection === 'SYNCING') {
    return (
      <span
        className="rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-info"
        data-testid="sync-confidence-badge"
      >
        Syncing
      </span>
    );
  }

  return null;
}
