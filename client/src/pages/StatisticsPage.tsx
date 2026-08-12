import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Target,
  Trophy,
  Users,
  UserRound,
} from 'lucide-react';
import { Avatar, Button, Card, EmptyState, Skeleton, SkeletonStatCard, Tabs } from '@/components/ui';
import { requireAccountMessage, useAuthStore } from '@/features/auth/authStore';
import { statisticsApi, type StatsRange } from '@/features/statistics/statisticsApi';

const ranges: Array<{ id: StatsRange; label: string }> = [
  { id: 'ALL_TIME', label: 'All time' },
  { id: 'THIS_MONTH', label: 'This month' },
  { id: 'THIS_YEAR', label: 'This year' },
];

export function StatisticsPage() {
  const status = useAuthStore((s) => s.status);
  const [range, setRange] = useState<StatsRange>('ALL_TIME');

  const stats = useQuery({
    queryKey: ['statistics', 'summary', range],
    queryFn: () => statisticsApi.summary(range),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });

  if (status === 'guest') {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sign in for statistics"
        description={requireAccountMessage()}
        action={
          <Link
            to="/register"
            className="inline-flex h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-background"
          >
            Create Account
          </Link>
        }
      />
    );
  }

  if (stats.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (stats.isError || !stats.data) {
    return (
      <EmptyState
        title="Could not load statistics"
        description="Check your connection and try again."
        action={<Button onClick={() => void stats.refetch()}>Retry</Button>}
      />
    );
  }

  const data = stats.data;
  const hasPlayerStats = data.topBatters.length > 0 || data.topBowlers.length > 0;

  const metricCards = [
    { label: 'Completed', value: data.metrics.completedMatches, icon: CheckCircle2 },
    { label: 'Live now', value: data.metrics.liveMatches, icon: Activity },
    { label: 'Teams', value: data.metrics.teams, icon: Users },
    { label: 'Players', value: data.metrics.players, icon: UserRound },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Statistics</h2>
          <p className="text-sm text-text-muted">{data.note}</p>
        </div>
        <Tabs
          value={range}
          onChange={(v) => setRange(v as StatsRange)}
          items={ranges.map((r) => ({ id: r.id, label: r.label }))}
        />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      {!hasPlayerStats && data.metrics.completedMatches === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No completed matches yet"
          description="Play your first match to start building your stats."
          action={
            <Link
              to="/matches/create"
              className="inline-flex h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-background"
            >
              Create Match
            </Link>
          }
        />
      ) : null}

      {hasPlayerStats ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Top run scorers</h3>
            </div>
            <ul className="divide-y divide-border-subtle">
              {data.topBatters.map((row, idx) => (
                <li key={row.playerId} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-xs font-semibold text-text-subtle">{idx + 1}</span>
                  <Avatar name={row.name} src={row.profileImageUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/players/${row.playerId}`}
                      className="truncate text-sm font-semibold hover:text-primary"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-text-subtle">
                      SR {row.strikeRate}
                      {row.average != null ? ` · Avg ${row.average}` : ''}
                      {row.highestScoreDisplay ? ` · Best ${row.highestScoreDisplay}` : ''}
                    </p>
                  </div>
                  <p className="font-display text-lg font-semibold">{row.runs}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Top wicket takers</h3>
            </div>
            <ul className="divide-y divide-border-subtle">
              {data.topBowlers.map((row, idx) => (
                <li key={row.playerId} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-xs font-semibold text-text-subtle">{idx + 1}</span>
                  <Avatar name={row.name} src={row.profileImageUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/players/${row.playerId}`}
                      className="truncate text-sm font-semibold hover:text-primary"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-text-subtle">
                      {row.overs} ov · Econ {row.economy}
                      {row.bestBowling ? ` · Best ${row.bestBowling}` : ''}
                    </p>
                  </div>
                  <p className="font-display text-lg font-semibold">{row.wickets}</p>
                </li>
              ))}
            </ul>
          </Card>

          {(data.bestStrikeRate?.length ?? 0) > 0 ? (
            <Card>
              <h3 className="mb-4 font-semibold">Best strike rate (min 20 balls)</h3>
              <ul className="divide-y divide-border-subtle">
                {(data.bestStrikeRate ?? []).map((row) => (
                  <li key={row.playerId} className="flex justify-between gap-2 py-2 text-sm">
                    <Link to={`/players/${row.playerId}`} className="font-medium hover:text-primary">
                      {row.name}
                    </Link>
                    <span className="tabular-nums text-primary">{row.strikeRate}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {(data.bestEconomy?.length ?? 0) > 0 ? (
            <Card>
              <h3 className="mb-4 font-semibold">Best economy (min 2 overs)</h3>
              <ul className="divide-y divide-border-subtle">
                {(data.bestEconomy ?? []).map((row) => (
                  <li key={row.playerId} className="flex justify-between gap-2 py-2 text-sm">
                    <Link to={`/players/${row.playerId}`} className="font-medium hover:text-primary">
                      {row.name}
                    </Link>
                    <span className="tabular-nums text-primary">{row.economy}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : null}

      {data.teamRecords.length > 0 ? (
        <Card>
          <h3 className="mb-4 font-semibold">Team records</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-text-subtle">
                <tr>
                  <th className="pb-2 font-medium">Team</th>
                  <th className="pb-2 font-medium">P</th>
                  <th className="pb-2 font-medium">W</th>
                  <th className="pb-2 font-medium">L</th>
                  <th className="pb-2 font-medium">Win %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.teamRecords.map((t) => (
                  <tr key={t.teamId}>
                    <td className="py-2.5">
                      <Link to={`/teams/${t.teamId}`} className="font-medium hover:text-primary">
                        {t.shortName ?? t.name}
                      </Link>
                    </td>
                    <td className="py-2.5">{t.played}</td>
                    <td className="py-2.5 text-primary">{t.won}</td>
                    <td className="py-2.5">{t.lost}</td>
                    <td className="py-2.5">{t.winPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {data.recentResults.length > 0 ? (
        <Card>
          <h3 className="mb-4 font-semibold">Recent results</h3>
          <ul className="space-y-3">
            {data.recentResults.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/matches/${m.id}/scorecard`}
                  className="block rounded-control border border-border-subtle px-3 py-3 transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {m.teamA.shortName ?? m.teamA.name} vs {m.teamB.shortName ?? m.teamB.name}
                    </p>
                    <span className="text-xs text-text-subtle">
                      {m.completedAt
                        ? new Date(m.completedAt).toLocaleDateString()
                        : 'Completed'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{m.resultText ?? m.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
