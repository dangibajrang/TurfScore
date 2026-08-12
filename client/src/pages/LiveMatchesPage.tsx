import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { matchesApi } from '@/features/matches/matchesApi';
import { liveSharingApi } from '@/features/realtime/liveSharingApi';
import type { MatchDto } from '@/features/matches/types';

function LiveMatchCard({ match }: { match: MatchDto }) {
  const sharingQuery = useQuery({
    queryKey: ['live-sharing', match.id],
    queryFn: () => liveSharingApi.get(match.id),
  });
  const sharing = sharingQuery.data;
  const sharingOn = Boolean(sharing?.publicLiveEnabled ?? match.publicLiveEnabled);
  const publicPath =
    sharing?.publicPath ??
    (match.publicMatchId ? `/live/${match.publicMatchId}` : null);

  return (
    <Card className="space-y-3" data-testid="live-match-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{match.name}</h3>
            <Badge tone="danger">LIVE</Badge>
            {sharingOn ? <Badge tone="primary">Sharing on</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {match.teamA.teamName} vs {match.teamB.teamName}
          </p>
          <p className="text-xs text-text-muted">
            {match.venue || 'Venue TBD'}
            {match.startedAt ? ` · started ${new Date(match.startedAt).toLocaleString()}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to={`/matches/${match.id}/live`}
          className="inline-flex h-10 items-center rounded-control bg-primary px-4 text-sm font-semibold text-background"
        >
          Open scoring
        </Link>
        <Link
          to={`/matches/${match.id}`}
          className="inline-flex h-10 items-center rounded-control border border-border px-4 text-sm font-semibold"
        >
          Match details
        </Link>
        {sharingOn && publicPath ? (
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-control border border-primary/40 px-4 text-sm font-semibold text-primary"
          >
            Public viewer
          </a>
        ) : null}
      </div>
    </Card>
  );
}

export function LiveMatchesPage() {
  const query = useQuery({
    queryKey: ['matches', 'LIVE'],
    queryFn: () => matchesApi.list({ status: 'LIVE', limit: 20 }),
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const items = query.data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Live Matches</h2>
          <p className="mt-1 text-sm text-text-muted">
            Score in real time and share the public live link with viewers.
          </p>
        </div>
        <Link to="/matches/create">
          <Button size="sm">Start a match</Button>
        </Link>
      </div>

      {!items.length ? (
        <EmptyState
          icon={Radio}
          title="No live matches"
          description="Start a match from Matches to begin live scoring. Viewers can follow via the public share link."
          action={
            <Link to="/matches" className="text-sm font-semibold text-primary">
              Go to matches
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <LiveMatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
