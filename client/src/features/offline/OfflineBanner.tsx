import { useOfflineUiStore } from './offlineUiStore';
import { cn } from '@/lib/cn';

export function OfflineBanner({ className }: { className?: string }) {
  const connection = useOfflineUiStore((s) => s.connection);
  const pending = useOfflineUiStore((s) => s.pendingCount);
  const failed = useOfflineUiStore((s) => s.failedCount);
  const authPaused = useOfflineUiStore((s) => s.authPaused);

  if (connection === 'ONLINE' || connection === 'SYNCED') {
    if (pending === 0 && failed === 0) return null;
  }

  const offline = connection === 'OFFLINE';
  const syncing = connection === 'SYNCING';
  const error = connection === 'SYNC_ERROR' || failed > 0;
  const auth = connection === 'AUTH_REQUIRED' || authPaused;

  return (
    <div
      className={cn(
        'rounded-control border px-3 py-2.5 text-sm',
        offline && 'border-warning/40 bg-warning/10 text-warning',
        syncing && 'border-info/40 bg-info/10 text-info',
        error && 'border-danger/40 bg-danger/10 text-danger',
        auth && 'border-warning/40 bg-warning/10 text-warning',
        !offline && !syncing && !error && !auth && 'border-primary/30 bg-primary/10 text-primary',
        className,
      )}
      data-testid="offline-banner"
      role="status"
    >
      {auth ? (
        <p>
          <span className="font-semibold">Sign in required</span> — {pending} scoring action
          {pending === 1 ? '' : 's'} are saved on this device. Sign in again to sync. Queue is
          preserved.
        </p>
      ) : offline ? (
        <p>
          <span className="font-semibold">OFFLINE MODE</span> — Your scoring is being saved on this
          device.{' '}
          <span data-testid="offline-banner-pending">
            {pending} action{pending === 1 ? '' : 's'} waiting to sync.
          </span>
        </p>
      ) : syncing ? (
        <p>
          <span className="font-semibold">SYNCING</span> — {pending} action
          {pending === 1 ? '' : 's'} remaining.
        </p>
      ) : error ? (
        <p>
          <span className="font-semibold">SYNC ERROR</span> — {failed} action
          {failed === 1 ? '' : 's'} need attention. Review below.
        </p>
      ) : (
        <p>
          <span className="font-semibold">LOCAL PENDING</span> — {pending} action
          {pending === 1 ? '' : 's'} waiting to sync.
        </p>
      )}
    </div>
  );
}
