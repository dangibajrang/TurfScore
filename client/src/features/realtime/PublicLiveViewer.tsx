import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui';
import { CurrentOver } from '@/features/scoring/components/CurrentOver';
import { cn } from '@/lib/cn';
import { publicMatchApi, type PublicMatchSnapshot } from './liveSharingApi';
import { useMatchRealtime } from './useMatchRealtime';
import type { MatchRealtimePayload } from './socketEvents';
import type { ConnectionStatus } from './socketEvents';

type Props = {
  publicMatchId: string;
};

function formatAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 5_000) return 'Updated just now';
  if (ms < 60_000) return `Updated ${Math.floor(ms / 1000)} seconds ago`;
  return `Updated ${Math.floor(ms / 60_000)} min ago`;
}

function statusLabel(s: ConnectionStatus): string {
  switch (s) {
    case 'connected':
      return 'LIVE';
    case 'connecting':
      return 'CONNECTING…';
    case 'reconnecting':
      return 'RECONNECTING…';
    case 'disconnected':
      return 'LIVE CONNECTION LOST';
    case 'error':
      return 'CONNECTION ERROR';
    default:
      return '…';
  }
}

function mergeRealtime(
  prev: PublicMatchSnapshot,
  payload: MatchRealtimePayload,
): PublicMatchSnapshot {
  return {
    ...prev,
    version: payload.version,
    lastUpdatedAt: payload.timestamp,
    presentation: payload.presentation,
    state: {
      ...prev.state,
      version: payload.version,
      status: payload.state.status as typeof prev.state.status,
      target: payload.presentation.target,
      result: payload.resultText
        ? {
            winnerTeamId: null,
            resultType: null,
            resultText: payload.resultText,
          }
        : prev.state.result,
    },
    scorecard: payload.scorecard ?? prev.scorecard,
    resultText: payload.resultText ?? prev.resultText,
  };
}

export function PublicLiveViewer({ publicMatchId }: Props) {
  const qc = useQueryClient();
  const [flash, setFlash] = useState<'four' | 'six' | 'wicket' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [agoTick, setAgoTick] = useState(0);

  const queryKey = useMemo(() => ['public-match', publicMatchId] as const, [publicMatchId]);

  const query = useQuery({
    queryKey,
    queryFn: () => publicMatchApi.get(publicMatchId),
    retry: 1,
  });

  const snapshot = query.data ?? null;

  useEffect(() => {
    const t = window.setInterval(() => setAgoTick((n) => n + 1), 5_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    document.title = `${snapshot.teamA.teamShortName ?? snapshot.teamA.teamName} vs ${snapshot.teamB.teamShortName ?? snapshot.teamB.teamName} — Live Score | TurfScore`;
    return () => {
      document.title = 'TurfScore';
    };
  }, [snapshot]);

  const applyPayload = useCallback(
    (payload: MatchRealtimePayload) => {
      qc.setQueryData<PublicMatchSnapshot>(queryKey, (prev) =>
        prev ? mergeRealtime(prev, payload) : prev,
      );

      const runs =
        payload.delivery &&
        typeof payload.delivery === 'object' &&
        'runs' in payload.delivery
          ? (payload.delivery as { runs?: { batterRuns?: number } }).runs?.batterRuns
          : undefined;
      if (payload.result?.wicket) {
        setFlash('wicket');
        setToast('WICKET!');
      } else if (runs === 6) {
        setFlash('six');
        setToast('SIX!');
      } else if (runs === 4) {
        setFlash('four');
        setToast('FOUR!');
      }
    },
    [qc, queryKey],
  );

  const refetchAuthoritative = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const { status, viewerCount, lastUpdatedAt } = useMatchRealtime(
    { publicMatchId },
    {
      enabled: !!snapshot && !query.isError,
      localVersion: snapshot?.version ?? 0,
      onPayload: applyPayload,
      onVersionGap: async () => {
        await refetchAuthoritative();
      },
      onSharingDisabled: () => {
        void qc.resetQueries({ queryKey });
      },
      onReconnect: () => {
        void refetchAuthoritative();
      },
    },
  );

  useEffect(() => {
    if (!flash && !toast) return;
    const t = window.setTimeout(() => {
      setFlash(null);
      setToast(null);
    }, 900);
    return () => window.clearTimeout(t);
  }, [flash, toast]);

  const playersById = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (!snapshot) return map;
    for (const p of [...snapshot.teamA.playingXi, ...snapshot.teamB.playingXi]) {
      map.set(p.playerId, { id: p.playerId, name: p.playerName ?? 'Player' });
    }
    return map;
  }, [snapshot]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (query.isError || !snapshot) {
    const msg =
      query.error instanceof Error ? query.error.message : 'Live score unavailable.';
    return (
      <div className="mx-auto max-w-lg p-4">
        <EmptyState
          title="Live score unavailable"
          description={
            msg.includes('no longer') || msg.includes('not enabled')
              ? 'Ask the scorer to enable live sharing.'
              : msg
          }
        />
      </div>
    );
  }

  const p = snapshot.presentation;
  const batting =
    snapshot.teamA.teamId === p.battingTeamId ? snapshot.teamA : snapshot.teamB;
  const bowling =
    snapshot.teamA.teamId === p.bowlingTeamId ? snapshot.teamA : snapshot.teamB;
  const inn = snapshot.state.innings[snapshot.state.currentInningsIndex];
  const scInn = snapshot.scorecard.innings[snapshot.state.currentInningsIndex];
  const completed = snapshot.status === 'COMPLETED' || p.matchComplete;
  const abandoned = snapshot.status === 'ABANDONED';
  const cancelled = snapshot.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-background" data-testid="public-live-viewer">
      <header className="border-b border-border-subtle px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              TurfScore
            </p>
            <h1 className="font-display text-lg font-semibold sm:text-xl">{snapshot.name}</h1>
          </div>
          <div className="text-right">
            <Badge
              tone={status === 'connected' ? 'danger' : 'warning'}
              data-testid="live-connection-status"
            >
              {completed ? 'FINAL' : statusLabel(status)}
              {status === 'connected' && !completed ? ' ●' : ''}
            </Badge>
            {viewerCount != null ? (
              <p className="mt-1 text-xs text-text-muted">{viewerCount} watching</p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {cancelled ? (
          <Card className="text-center">
            <p className="font-display text-2xl font-bold">Match cancelled</p>
          </Card>
        ) : null}
        {abandoned ? (
          <Card className="text-center">
            <p className="font-display text-2xl font-bold">Match abandoned</p>
          </Card>
        ) : null}

        <section
          className={cn(
            'rounded-card border border-border-subtle bg-surface p-5 text-center transition',
            flash === 'wicket' && 'motion-safe:ring-2 motion-safe:ring-danger',
            (flash === 'four' || flash === 'six') &&
              'motion-safe:ring-2 motion-safe:ring-primary',
          )}
          aria-live="polite"
        >
          <div className="flex items-center justify-center gap-6 sm:gap-12">
            <div>
              <p className="text-xs uppercase text-text-muted">
                {batting.teamShortName || batting.teamName}
              </p>
              <p
                className="font-display text-5xl font-bold tabular-nums sm:text-6xl"
                data-testid="public-live-score"
              >
                {p.totalRuns}
                <span className="text-text-muted">/{p.wickets}</span>
              </p>
              <p className="mt-1 text-sm text-text-muted">{p.oversDisplay} OV</p>
            </div>
            <div className="text-text-muted">vs</div>
            <div>
              <p className="text-xs uppercase text-text-muted">
                {bowling.teamShortName || bowling.teamName}
              </p>
              <p className="text-sm text-text-muted">Bowling</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm text-text-muted">
            {p.currentRunRate != null ? <span>CRR {p.currentRunRate.toFixed(2)}</span> : null}
            {p.target != null && p.inningsNumber >= 2 ? (
              <>
                <span>Target {p.target}</span>
                <span>Req {p.requiredRuns ?? 0}</span>
                {p.requiredRunRate != null ? (
                  <span>RRR {p.requiredRunRate.toFixed(2)}</span>
                ) : null}
              </>
            ) : null}
          </div>

          {toast ? (
            <p className="mt-3 font-display text-xl font-bold text-primary motion-safe:animate-pulse">
              {toast}
            </p>
          ) : null}

          {completed && snapshot.resultText ? (
            <p className="mt-4 rounded-control border border-primary/30 bg-primary-muted px-3 py-2 font-semibold text-primary">
              {snapshot.resultText}
            </p>
          ) : null}
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Batters
            </h2>
            {[p.strikerId, p.nonStrikerId].filter(Boolean).map((id) => {
              const pid = id!;
              const stats = inn?.batters[pid];
              const sc = scInn?.batting.find((b) => b.playerId === pid);
              return (
                <div key={pid} className="flex justify-between gap-2">
                  <span className="font-semibold">
                    {playersById.get(pid)?.name ?? 'Player'}
                    {pid === p.strikerId ? ' *' : ''}
                  </span>
                  <span className="tabular-nums">
                    {stats?.runs ?? sc?.runs ?? 0} ({stats?.balls ?? sc?.balls ?? 0})
                  </span>
                </div>
              );
            })}
          </Card>

          <Card className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Bowler
            </h2>
            {p.currentBowlerId ? (
              (() => {
                const id = p.currentBowlerId!;
                const sc = scInn?.bowling.find((b) => b.playerId === id);
                const st = inn?.bowlers[id];
                return (
                  <div>
                    <p className="font-semibold">{playersById.get(id)?.name ?? 'Bowler'}</p>
                    <p className="text-sm text-text-muted tabular-nums">
                      {sc?.oversDisplay ?? '0.0'} – {st?.maidens ?? 0} –{' '}
                      {st?.runsConceded ?? 0} – {st?.wickets ?? 0}
                    </p>
                  </div>
                );
              })()
            ) : (
              <p className="text-sm text-text-muted">—</p>
            )}
          </Card>
        </div>

        <Card>
          <CurrentOver presentation={p} recentDeliveries={snapshot.recentDeliveries} />
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
          <span key={agoTick}>{formatAgo(lastUpdatedAt ?? snapshot.lastUpdatedAt)}</span>
          <Link
            to={`/live/${publicMatchId}/scorecard`}
            className="font-semibold text-primary"
            data-testid="public-scorecard-link"
          >
            View full scorecard
          </Link>
        </div>
      </main>
    </div>
  );
}
