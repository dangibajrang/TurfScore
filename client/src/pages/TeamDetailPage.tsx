import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { teamsApi } from '@/features/teams/teamsApi';
import { playersApi } from '@/features/players/playersApi';
import { statisticsApi } from '@/features/statistics/statisticsApi';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export function TeamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const debounced = useDebouncedValue(playerSearch);

  const teamQuery = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamsApi.get(id!),
    enabled: !!id,
  });
  const rosterQuery = useQuery({
    queryKey: ['team-players', id],
    queryFn: () => teamsApi.players(id!),
    enabled: !!id,
  });
  const searchPlayers = useQuery({
    queryKey: ['players-search', debounced],
    queryFn: () => playersApi.list({ search: debounced || undefined, limit: 10 }),
    enabled: addOpen,
  });
  const teamStatsQuery = useQuery({
    queryKey: ['statistics', 'team', id],
    queryFn: () => statisticsApi.team(id!),
    enabled: !!id && (tab === 'matches' || tab === 'statistics' || tab === 'overview'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['team', id] });
    void qc.invalidateQueries({ queryKey: ['team-players', id] });
    void qc.invalidateQueries({ queryKey: ['teams'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const deleteMutation = useMutation({
    mutationFn: () => teamsApi.remove(id!),
    onSuccess: () => {
      showToast('Team deleted');
      navigate('/teams');
      invalidate();
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  const addMutation = useMutation({
    mutationFn: (playerId: string) => teamsApi.addPlayer(id!, playerId),
    onSuccess: () => {
      showToast('Player added');
      setAddOpen(false);
      invalidate();
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not add player'),
  });

  const removeMutation = useMutation({
    mutationFn: (playerId: string) => teamsApi.removePlayer(id!, playerId),
    onSuccess: () => {
      showToast('Player removed');
      invalidate();
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not remove'),
  });

  const captainMutation = useMutation({
    mutationFn: (playerId: string) => teamsApi.setCaptain(id!, playerId),
    onSuccess: () => {
      showToast('Captain updated');
      invalidate();
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not set captain'),
  });

  const viceMutation = useMutation({
    mutationFn: (playerId: string) => teamsApi.setViceCaptain(id!, playerId),
    onSuccess: () => {
      showToast('Vice captain updated');
      invalidate();
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not set vice captain'),
  });

  const captainName = useMemo(() => {
    const c = rosterQuery.data?.items.find((p) => p.isCaptain);
    return c?.name ?? 'Not set';
  }, [rosterQuery.data]);

  const viceName = useMemo(() => {
    const c = rosterQuery.data?.items.find((p) => p.isViceCaptain);
    return c?.name ?? 'Not set';
  }, [rosterQuery.data]);

  if (teamQuery.isLoading) return <Skeleton className="mx-auto h-64 max-w-4xl w-full" />;
  if (teamQuery.isError || !teamQuery.data) {
    return (
      <EmptyState
        title="Team not found"
        description="This team may have been deleted or you do not have access."
        action={
          <Link to="/teams" className="text-sm font-semibold text-primary">
            Back to teams
          </Link>
        }
      />
    );
  }

  const team = teamQuery.data;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-muted text-lg font-bold text-primary">
            {(team.shortName || team.name).slice(0, 3).toUpperCase()}
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold">{team.name}</h2>
            <p className="text-sm text-text-muted">
              {team.shortName || '—'} · {team.playerCount} players
            </p>
            {team.description ? (
              <p className="mt-1 text-sm text-text-muted">{team.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/teams/${team.id}/edit`}
            className="inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-semibold"
          >
            Edit
          </Link>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'players', label: 'Players' },
          { id: 'matches', label: 'Matches' },
          { id: 'statistics', label: 'Statistics' },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs uppercase tracking-wide text-text-subtle">Captain</p>
            <p className="mt-1 font-semibold">{captainName}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-text-subtle">Vice captain</p>
            <p className="mt-1 font-semibold">{viceName}</p>
          </Card>
          {teamStatsQuery.data ? (
            <>
              <Card>
                <p className="text-xs uppercase tracking-wide text-text-subtle">Record</p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {teamStatsQuery.data.statistics.wins}W · {teamStatsQuery.data.statistics.losses}L
                </p>
                <p className="text-xs text-text-muted">
                  {teamStatsQuery.data.statistics.winPct}% win rate ·{' '}
                  {teamStatsQuery.data.statistics.matches} matches
                </p>
              </Card>
              <Card>
                <p className="text-xs uppercase tracking-wide text-text-subtle">Highest score</p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {teamStatsQuery.data.statistics.highestScore}
                </p>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'players' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setAddOpen(true)}>Add Player</Button>
          </div>
          {rosterQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !rosterQuery.data?.items.length ? (
            <EmptyState title="No players on this team" description="Add players to build your roster." />
          ) : (
            <div className="space-y-2">
              {rosterQuery.data.items.map((p) => (
                <Card key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/players/${p.id}`} className="font-semibold hover:text-primary">
                        {p.name}
                      </Link>
                      {p.isCaptain ? <Badge tone="primary">Captain</Badge> : null}
                      {p.isViceCaptain ? <Badge tone="info">Vice</Badge> : null}
                    </div>
                    <p className="text-xs text-text-muted">
                      {p.role.replaceAll('_', ' ')}
                      {p.battingStyle ? ` · ${p.battingStyle.replaceAll('_', ' ')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => captainMutation.mutate(p.id)}>
                      Set captain
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => viceMutation.mutate(p.id)}>
                      Set vice
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeMutation.mutate(p.id)}>
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {addOpen ? (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Add player</h3>
                <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>
                  Close
                </Button>
              </div>
              <Input
                placeholder="Search players…"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
              />
              <ul className="mt-3 space-y-2">
                {searchPlayers.data?.items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {p.name} · {p.role}
                    </span>
                    <Button size="sm" onClick={() => addMutation.mutate(p.id)} disabled={addMutation.isPending}>
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === 'matches' ? (
        teamStatsQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !teamStatsQuery.data?.recentMatches.length ? (
          <EmptyState
            title="No completed matches"
            description="Team results appear after you finish scoring a match."
          />
        ) : (
          <div className="space-y-2">
            {teamStatsQuery.data.recentMatches.map((m) => (
              <Link key={m.id} to={`/matches/${m.id}/scorecard`}>
                <Card className="hover:border-primary/30">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-text-muted">vs {m.opponent.name}</p>
                  <p className="mt-1 text-sm text-primary">{m.resultText || 'Completed'}</p>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : null}

      {tab === 'statistics' ? (
        teamStatsQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !teamStatsQuery.data || teamStatsQuery.data.statistics.matches === 0 ? (
          <EmptyState
            title="No statistics yet"
            description="Play your first match to start building team stats."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['Matches', teamStatsQuery.data.statistics.matches],
                ['Wins', teamStatsQuery.data.statistics.wins],
                ['Losses', teamStatsQuery.data.statistics.losses],
                ['Win %', teamStatsQuery.data.statistics.winPct],
                ['Total runs', teamStatsQuery.data.statistics.totalRuns],
                ['Avg score', teamStatsQuery.data.statistics.averageScore],
                ['Highest', teamStatsQuery.data.statistics.highestScore],
                ['Wickets', teamStatsQuery.data.statistics.wickets],
              ] as const
            ).map(([label, value]) => (
              <Card key={label}>
                <p className="text-xs text-text-muted">{label}</p>
                <p className="font-display text-2xl font-semibold">{value}</p>
              </Card>
            ))}
          </div>
        )
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Team?"
        description="This action cannot be undone. The team will be deactivated."
        confirmLabel="Delete team"
        danger
        loading={deleteMutation.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
