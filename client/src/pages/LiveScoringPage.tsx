import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui';
import { LiveScoringScreen, LiveScoringSkeleton } from '@/features/scoring/LiveScoringScreen';
import { useMatchMeta, useScoringState } from '@/features/scoring/useScoringActions';
import { getMatchContext, countByStatus } from '@/features/offline/queue';
import { ensureOfflineDb } from '@/features/offline/db';
import { useOfflineUiStore } from '@/features/offline/offlineUiStore';
import { ApiError } from '@/lib/apiClient';
import type { MatchDto } from '@/features/matches/types';
import type { ScoringStateResponse } from '@/features/scoring/types';

export function LiveScoringPage() {
  const { id } = useParams();
  const matchQ = useMatchMeta(id!);
  const scoringQ = useScoringState(id!);
  const [offlineFallback, setOfflineFallback] = useState<{
    match: MatchDto;
    scoring: ScoringStateResponse;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    // Prefer live query data when available; keep fallback only for API failures.
    if (matchQ.isSuccess && scoringQ.isSuccess) return;
    if (!matchQ.isError && !scoringQ.isError && (matchQ.isLoading || scoringQ.isLoading)) {
      return;
    }
    // Network / API failure — try IndexedDB resume snapshot
    let cancelled = false;
    void (async () => {
      await ensureOfflineDb();
      const ctx = await getMatchContext(id);
      if (!ctx || cancelled) return;
      useOfflineUiStore.getState().setConnection('OFFLINE');
      const counts = await countByStatus(id);
      useOfflineUiStore
        .getState()
        .setCounts(counts.PENDING + counts.SYNCING, counts.FAILED);
      setOfflineFallback({
        match: ctx.match,
        scoring: {
          ...ctx.serverSnapshot,
          presentation: ctx.localPresentationHint
            ? {
                ...ctx.serverSnapshot.presentation,
                totalRuns: ctx.localPresentationHint.totalRuns,
                wickets: ctx.localPresentationHint.wickets,
                legalBalls: ctx.localPresentationHint.legalBalls,
                oversDisplay: ctx.localPresentationHint.oversDisplay,
              }
            : ctx.serverSnapshot.presentation,
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    id,
    matchQ.isSuccess,
    scoringQ.isSuccess,
    matchQ.isError,
    scoringQ.isError,
    matchQ.isLoading,
    scoringQ.isLoading,
  ]);

  if (!id) {
    return <EmptyState title="Match not found" />;
  }

  if ((matchQ.isLoading || scoringQ.isLoading) && !offlineFallback) {
    return <LiveScoringSkeleton />;
  }

  const match = matchQ.data ?? offlineFallback?.match;
  const scoring = scoringQ.data ?? offlineFallback?.scoring;

  if (!match) {
    const msg =
      matchQ.error instanceof ApiError ? matchQ.error.message : 'Unable to load match';
    return (
      <EmptyState
        title="Match unavailable"
        description={msg}
        action={
          <Link to="/matches" className="text-sm font-semibold text-primary">
            Back to matches
          </Link>
        }
      />
    );
  }

  if (!scoring) {
    const err = scoringQ.error;
    const code = err instanceof ApiError ? err.code : '';
    if (code === 'FORBIDDEN') {
      return (
        <EmptyState
          title="Not authorized"
          description="Only the match owner can open live scoring."
          action={
            <Link to={`/matches/${id}`} className="text-sm font-semibold text-primary">
              Back to match
            </Link>
          }
        />
      );
    }
    return (
      <EmptyState
        title="Scoring state unavailable"
        description={
          err instanceof ApiError
            ? err.message
            : 'Try again shortly. If you were offline, reopen after scoring at least once online to cache this match.'
        }
        action={
          <Link to={`/matches/${id}`} className="text-sm font-semibold text-primary">
            Back to match
          </Link>
        }
      />
    );
  }

  if (match.status === 'DRAFT' || match.status === 'UPCOMING') {
    return (
      <EmptyState
        title="Match not started"
        description="Start the match before opening live scoring."
        action={
          <Link to={`/matches/${id}`} className="text-sm font-semibold text-primary">
            Go to match
          </Link>
        }
      />
    );
  }

  return <LiveScoringScreen matchId={id} match={match} scoring={scoring} />;
}
