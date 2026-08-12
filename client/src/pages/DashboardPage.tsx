import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Plus, Trophy, Users, UserRound, CalendarDays } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Skeleton, SkeletonStatCard } from '@/components/ui';
import { dashboardApi } from '@/features/dashboard/dashboardApi';
import { MiniCalendar } from '@/features/dashboard/MiniCalendar';
import { OfflineResumeCard } from '@/features/offline/OfflineResumeCard';
import { requireAccountMessage, useAuthStore } from '@/features/auth/authStore';
import { Avatar } from '@/components/ui/Avatar';

function scoreLine(
  side: { runs: number; wickets: number; overs: string } | null | undefined,
): string {
  if (!side) return '—';
  return `${side.runs}/${side.wickets} · ${side.overs} ov`;
}

export function DashboardPage() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary(),
    enabled: status === 'authenticated',
  });

  if (status === 'guest') {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="border-warning/30 bg-warning/10">
          <p className="text-sm font-medium">{requireAccountMessage()}</p>
          <Link to="/register" className="mt-2 inline-block text-sm font-semibold text-primary">
            Create an account
          </Link>
        </Card>
        <EmptyState
          title="Guest dashboard"
          description="Sign in to see live metrics, teams, and players from your account."
        />
      </div>
    );
  }

  if (summary.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <EmptyState
        title="Could not load dashboard"
        description="Check your connection and try again."
        action={<Button onClick={() => void summary.refetch()}>Retry</Button>}
      />
    );
  }

  const data = summary.data;
  const firstName = user?.name.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const metricCards = [
    { label: 'Matches', value: data.metrics.completedMatches + data.metrics.liveMatches + data.metrics.upcomingMatches, icon: CalendarDays },
    { label: 'Wins', value: data.metrics.wins, icon: Trophy },
    { label: 'Live', value: data.metrics.liveMatches, icon: Activity },
    { label: 'Completed', value: data.metrics.completedMatches, icon: CheckCircle2 },
    { label: 'Teams', value: data.metrics.teams, icon: Users },
    { label: 'Players', value: data.metrics.players, icon: UserRound },
  ];

  const performers = [
    data.topPerformers.topRunScorer,
    data.topPerformers.topWicketTaker,
    data.topPerformers.bestStrikeRate,
    data.topPerformers.bestEconomy,
  ].filter(Boolean);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-text-muted">
            {greeting}, {firstName}
          </p>
          <h2 className="font-display text-2xl font-semibold">Dashboard</h2>
        </div>
        <Link
          to="/matches/create"
          className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-background"
        >
          <Plus className="h-4 w-4" />
          Create Match
        </Link>
      </div>

      <OfflineResumeCard />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-text-muted">{label}</span>
              <span className="rounded-full bg-primary-muted p-2 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="font-display text-3xl font-semibold">{value}</div>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold">Live Matches</h3>
              <Badge tone="danger">Live</Badge>
            </div>
            {!data.liveMatches.length ? (
              <EmptyState
                title="No live matches right now"
                description="Start a match to see live scoring here."
              />
            ) : (
              <div className="space-y-2">
                {data.liveMatches.map((m) => (
                  <Link key={m.id} to={`/matches/${m.id}`}>
                    <Card className="hover:border-primary/30">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">
                          {m.teamA.shortName || m.teamA.name} vs {m.teamB.shortName || m.teamB.name}
                        </p>
                        <Badge tone="danger">LIVE</Badge>
                      </div>
                      {m.scoreSummary?.teamA || m.scoreSummary?.teamB ? (
                        <p className="mt-1 text-sm tabular-nums text-text">
                          {scoreLine(m.scoreSummary?.teamA)} · {scoreLine(m.scoreSummary?.teamB)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-text-muted">{m.venue || 'Venue TBD'}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 font-display text-lg font-semibold">Upcoming</h3>
            {!data.upcomingMatches.length ? (
              <EmptyState title="No upcoming matches" description="Create your first match." />
            ) : (
              <div className="space-y-2">
                {data.upcomingMatches.map((m) => (
                  <Link key={m.id} to={`/matches/${m.id}`}>
                    <Card className="hover:border-primary/30">
                      <p className="font-semibold">
                        {m.teamA.name} vs {m.teamB.name}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {m.scheduledAt
                          ? new Date(m.scheduledAt).toLocaleString()
                          : 'Time TBD'}
                        {m.venue ? ` · ${m.venue}` : ''}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 font-display text-lg font-semibold">Recent Matches</h3>
            {!data.recentMatches.length ? (
              <EmptyState
                title="No recent matches"
                description="Completed matches will appear here."
              />
            ) : (
              <div className="space-y-2">
                {data.recentMatches.map((m) => (
                  <Link key={m.id} to={`/matches/${m.id}/scorecard`}>
                    <Card className="hover:border-primary/30">
                      <p className="font-semibold">
                        {m.teamA.name} vs {m.teamB.name}
                      </p>
                      {m.scoreSummary?.teamA && m.scoreSummary?.teamB ? (
                        <p className="mt-1 text-sm tabular-nums text-text-muted">
                          {m.scoreSummary.teamA.runs}/{m.scoreSummary.teamA.wickets} vs{' '}
                          {m.scoreSummary.teamB.runs}/{m.scoreSummary.teamB.wickets}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-primary">
                        {m.resultText || 'Result pending'}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <MiniCalendar highlights={data.calendarHighlights} />

          {performers.length > 0 ? (
            <section>
              <h3 className="mb-3 font-display text-lg font-semibold">Top Performers</h3>
              <div className="space-y-2">
                {performers.map((p) =>
                  p ? (
                    <Link key={`${p.playerId}-${p.label}`} to={`/players/${p.playerId}`}>
                      <Card className="hover:border-primary/30">
                        <p className="text-xs uppercase tracking-wide text-text-subtle">{p.label}</p>
                        <p className="font-semibold">{p.name}</p>
                        <p className="font-display text-xl font-semibold text-primary">{p.value}</p>
                      </Card>
                    </Link>
                  ) : null,
                )}
              </div>
            </section>
          ) : null}

          {data.recentForm.length > 0 ? (
            <section>
              <h3 className="mb-3 font-display text-lg font-semibold">Last {data.recentForm.length} results</h3>
              <div className="flex flex-wrap gap-2">
                {data.recentForm.map((f) => (
                  <Link
                    key={f.matchId}
                    to={`/matches/${f.matchId}/scorecard`}
                    className="rounded-control border border-border-subtle px-2 py-1 text-xs font-semibold text-text-muted hover:border-primary/40"
                    title={f.label}
                  >
                    {f.outcome === 'TIE' ? 'T' : f.outcome === 'NR' ? 'NR' : 'R'}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-3 font-display text-lg font-semibold">Recently Added Players</h3>
            {!data.featuredPlayers.length ? (
              <EmptyState title="No players yet" description="Add players to see them here." />
            ) : (
              <div className="space-y-2">
                {data.featuredPlayers.map((p) => (
                  <Link key={p.id} to={`/players/${p.id}`}>
                    <Card className="flex items-center gap-3 hover:border-primary/30">
                      <Avatar name={p.name} src={p.profileImageUrl} size="sm" />
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-text-muted">{p.role.replaceAll('_', ' ')}</p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 font-display text-lg font-semibold">Recent Teams</h3>
            {!data.recentTeams.length ? (
              <EmptyState title="No teams yet" description="Create a team to get started." />
            ) : (
              <div className="space-y-2">
                {data.recentTeams.map((t) => (
                  <Link key={t.id} to={`/teams/${t.id}`}>
                    <Card className="hover:border-primary/30">
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-xs text-text-muted">
                        {t.shortName || '—'} · {t.playerCount} players
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
