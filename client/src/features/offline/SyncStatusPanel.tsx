import { useQuery } from '@tanstack/react-query';
import { Button, Card } from '@/components/ui';
import { ensureOfflineDb } from './db';
import { listActiveQueue, resetFailedToPending } from './queue';
import { useOfflineUiStore } from './offlineUiStore';

type Props = {
  matchId: string;
  onRetry: () => void;
};

export function SyncStatusPanel({ matchId, onRetry }: Props) {
  const pending = useOfflineUiStore((s) => s.pendingCount);
  const failed = useOfflineUiStore((s) => s.failedCount);
  const connection = useOfflineUiStore((s) => s.connection);
  const conflict = useOfflineUiStore((s) => s.conflictPausedMatchId === matchId);

  const queueQ = useQuery({
    queryKey: ['offline-queue', matchId],
    queryFn: async () => {
      await ensureOfflineDb();
      return listActiveQueue(matchId);
    },
    refetchInterval: pending + failed > 0 ? 3_000 : false,
  });

  // Always show while offline or when there is queue work — pending count is E2E-critical.
  if (
    pending === 0 &&
    failed === 0 &&
    connection !== 'SYNCING' &&
    connection !== 'OFFLINE' &&
    connection !== 'SYNC_ERROR' &&
    connection !== 'AUTH_REQUIRED'
  ) {
    return null;
  }

  const failedRows = (queueQ.data ?? []).filter((e) => e.status === 'FAILED');

  return (
    <Card className="space-y-3" data-testid="sync-status-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Sync status</h3>
          <p className="text-xs text-text-muted">
            Offline scoring is safest with one active scorer device per match.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void resetFailedToPending(matchId, !conflict).then(() => onRetry());
          }}
          data-testid="retry-failed-sync"
        >
          Retry failed
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span data-testid="sync-pending-count">↻ {pending} pending</span>
        <span className="text-danger" data-testid="sync-failed-count">
          ⚠ {failed} failed
        </span>
      </div>

      {conflict ? (
        <p className="rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Version conflict — another scorer may have updated this match. Fetch latest state, then
          review failed actions. Do not blindly overwrite the server.
        </p>
      ) : null}

      {failedRows.length > 0 ? (
        <ul className="divide-y divide-border-subtle text-sm" data-testid="failed-queue-list">
          {failedRows.slice(0, 8).map((row) => (
            <li key={row.eventId} className="py-2">
              <p className="font-medium">
                #{row.clientSequence} · {row.commandType}
              </p>
              <p className="text-xs text-text-muted">
                {new Date(row.clientCreatedAt).toLocaleTimeString()} ·{' '}
                {row.lastErrorCode ?? 'ERROR'}
              </p>
              <p className="text-xs text-danger">{row.lastError ?? 'Could not sync'}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
