import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { playersApi } from '@/features/players/playersApi';
import { statisticsApi } from '@/features/statistics/statisticsApi';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';

export function PlayerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [confirm, setConfirm] = useState(false);

  const playerQuery = useQuery({
    queryKey: ['player', id],
    queryFn: () => playersApi.get(id!),
    enabled: !!id,
  });
  const teamsQuery = useQuery({
    queryKey: ['player-teams', id],
    queryFn: () => playersApi.teams(id!),
    enabled: !!id,
  });
  const statsQuery = useQuery({
    queryKey: ['statistics', 'player', id],
    queryFn: () => statisticsApi.player(id!),
    enabled: !!id && (tab === 'statistics' || tab === 'overview'),
  });
  const matchHistoryQuery = useQuery({
    queryKey: ['statistics', 'player-matches', id],
    queryFn: () => statisticsApi.playerMatches(id!, { limit: 20 }),
    enabled: !!id && tab === 'matches',
  });

  const deactivate = useMutation({
    mutationFn: () => playersApi.remove(id!),
    onSuccess: () => {
      showToast('Player deactivated');
      void qc.invalidateQueries({ queryKey: ['players'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/players');
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Failed'),
  });

  if (playerQuery.isLoading) return <Skeleton className="mx-auto h-72 max-w-3xl w-full" />;
  if (playerQuery.isError || !playerQuery.data) {
    return (
      <EmptyState
        title="Player not found"
        action={
          <Link to="/players" className="text-sm font-semibold text-primary">
            Back to players
          </Link>
        }
      />
    );
  }

  const player = playerQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Avatar name={player.name} src={player.profileImageUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold">{player.name}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="primary">{player.role.replaceAll('_', ' ')}</Badge>
            {player.battingStyle ? (
              <Badge>{player.battingStyle.replaceAll('_', ' ')}</Badge>
            ) : null}
            {player.bowlingStyle ? (
              <Badge tone="info">{player.bowlingStyle.replaceAll('_', ' ')}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/players/${player.id}/edit`}
            className="inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-semibold"
          >
            Edit
          </Link>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Deactivate
          </Button>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'teams', label: 'Teams' },
          { id: 'matches', label: 'Matches' },
          { id: 'statistics', label: 'Statistics' },
        ]}
      />

      {tab === 'overview' ? (
        <Card>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Phone</dt>
              <dd>{player.phone || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Bio</dt>
              <dd className="text-right">{player.bio || '—'}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      {tab === 'teams' ? (
        teamsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !teamsQuery.data?.items.length ? (
          <EmptyState title="No teams yet" description="Add this player to a team roster." />
        ) : (
          <div className="space-y-2">
            {teamsQuery.data.items.map((t) => (
              <Card key={t.id} className="flex items-center justify-between">
                <Link to={`/teams/${t.id}`} className="font-semibold hover:text-primary">
                  {t.name}
                </Link>
                <div className="flex gap-2">
                  {t.isCaptain ? <Badge tone="primary">Captain</Badge> : null}
                  {t.isViceCaptain ? <Badge tone="info">Vice</Badge> : null}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === 'matches' ? (
        matchHistoryQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !matchHistoryQuery.data?.items.length ? (
          <EmptyState
            title="No match history yet"
            description="Play your first completed match to start building your record."
          />
        ) : (
          <div className="space-y-2">
            {matchHistoryQuery.data.items.map((row) => (
              <Link key={row.matchId} to={`/matches/${row.matchId}/scorecard?highlight=${id}`}>
                <Card className="hover:border-primary/30">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{row.matchName}</p>
                      <p className="text-xs text-text-muted">
                        {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                        {row.teamName ? ` · ${row.teamName}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>
                        {row.runs} runs
                        {row.balls ? ` (${row.balls})` : ''}
                      </p>
                      <p className="text-text-muted">{row.wickets} wicket{row.wickets === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  {row.resultText ? (
                    <p className="mt-2 text-xs text-primary">{row.resultText}</p>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : null}

      {tab === 'statistics' ? (
        statsQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : statsQuery.isError || !statsQuery.data ? (
          <EmptyState
            title="Could not load statistics"
            description="Check your connection and try again."
            action={<Button onClick={() => void statsQuery.refetch()}>Retry</Button>}
          />
        ) : !statsQuery.data.batting && !statsQuery.data.bowling ? (
          <EmptyState
            title="No statistics yet"
            description="Figures appear after this player bats or bowls in a completed match."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-semibold">Batting</h3>
              {statsQuery.data.batting ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Runs</dt>
                    <dd className="font-display text-lg font-semibold">
                      {statsQuery.data.batting.runs}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Innings</dt>
                    <dd>
                      {statsQuery.data.batting.innings}
                      {statsQuery.data.batting.notOuts
                        ? ` (${statsQuery.data.batting.notOuts}*)`
                        : ''}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Average</dt>
                    <dd>{statsQuery.data.batting.average ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Strike rate</dt>
                    <dd>{statsQuery.data.batting.strikeRate}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Best</dt>
                    <dd>{statsQuery.data.batting.highestScoreDisplay ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">50s / 100s</dt>
                    <dd>
                      {statsQuery.data.batting.fifties ?? 0} / {statsQuery.data.batting.hundreds ?? 0}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Boundaries</dt>
                    <dd>
                      {statsQuery.data.batting.fours}×4 · {statsQuery.data.batting.sixes}×6
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-text-muted">No batting figures yet.</p>
              )}
            </Card>
            <Card>
              <h3 className="mb-3 font-semibold">Bowling</h3>
              {statsQuery.data.bowling ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Wickets</dt>
                    <dd className="font-display text-lg font-semibold">
                      {statsQuery.data.bowling.wickets}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Overs</dt>
                    <dd>{statsQuery.data.bowling.overs}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Runs</dt>
                    <dd>{statsQuery.data.bowling.runsConceded}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Economy</dt>
                    <dd>{statsQuery.data.bowling.economy}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Best</dt>
                    <dd>{statsQuery.data.bowling.bestBowling ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Average</dt>
                    <dd>{statsQuery.data.bowling.average ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Maidens</dt>
                    <dd>{statsQuery.data.bowling.maidens}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-text-muted">No bowling figures yet.</p>
              )}
            </Card>
            <p className="text-xs text-text-subtle sm:col-span-2">
              {statsQuery.data.matchesPlayed} completed match
              {statsQuery.data.matchesPlayed === 1 ? '' : 'es'} with scoring figures · rebuilt from
              match snapshots.
            </p>
          </div>
        )
      ) : null}

      <ConfirmDialog
        open={confirm}
        title="Deactivate player?"
        description="The player will be removed from active rosters. Historical scorecards and career stats remain readable."
        confirmLabel="Deactivate"
        danger
        loading={deactivate.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => deactivate.mutate()}
      />
    </div>
  );
}
