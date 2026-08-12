import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui';
import { publicMatchApi } from '@/features/realtime/liveSharingApi';
import { PublicLiveViewer } from '@/features/realtime/PublicLiveViewer';
import { ScorecardSkeleton, ScorecardView } from '@/features/scoring/ScorecardView';
import type { MatchDto } from '@/features/matches/types';

export function PublicLivePage() {
  const { publicMatchId } = useParams();
  if (!publicMatchId) {
    return <EmptyState title="Match not found" />;
  }
  return <PublicLiveViewer publicMatchId={publicMatchId.toUpperCase()} />;
}

export function PublicScorecardPage() {
  const { publicMatchId } = useParams();
  if (!publicMatchId) {
    return <EmptyState title="Match not found" />;
  }
  const id = publicMatchId.toUpperCase();
  return <PublicScorecardLoader publicMatchId={id} />;
}

function PublicScorecardLoader({ publicMatchId }: { publicMatchId: string }) {
  const q = useQuery({
    queryKey: ['public-scorecard', publicMatchId],
    queryFn: () => publicMatchApi.scorecard(publicMatchId),
  });

  if (q.isLoading) return <ScorecardSkeleton />;
  if (q.isError || !q.data) {
    return (
      <EmptyState
        title="Scorecard unavailable"
        description="Live sharing may be disabled."
        action={
          <Link to={`/live/${publicMatchId}`} className="text-sm font-semibold text-primary">
            Back to live score
          </Link>
        }
      />
    );
  }

  const matchLike: MatchDto = {
    id: q.data.matchId,
    name: q.data.name,
    description: null,
    status: q.data.status as MatchDto['status'],
    venue: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    teamA: q.data.teamA,
    teamB: q.data.teamB,
    rules: { overs: 0, ballsPerOver: 6, playersPerSide: 11 },
    toss: null,
    firstInnings: null,
    innings: [],
    version: q.data.version,
    publicMatchId: q.data.publicMatchId,
    publicLiveEnabled: true,
    resultText: q.data.resultText,
    createdBy: '',
    createdAt: '',
    updatedAt: q.data.lastUpdatedAt,
    warnings: [],
  };

  return (
    <div className="min-h-screen bg-background px-4 py-4">
      <div className="mx-auto mb-3 flex max-w-4xl items-center justify-between">
        <Link to={`/live/${publicMatchId}`} className="text-sm text-primary">
          ← Live score
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">TurfScore</p>
      </div>
      <ScorecardView match={matchLike} scorecard={q.data.scorecard} />
    </div>
  );
}
