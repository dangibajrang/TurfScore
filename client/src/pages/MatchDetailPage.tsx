import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui';
import { LiveSharingPanel } from '@/features/realtime/LiveSharingPanel';
import { matchesApi } from '@/features/matches/matchesApi';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';

export function MatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const query = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchesApi.get(id!),
    enabled: !!id,
  });

  const start = useMutation({
    mutationFn: () => matchesApi.start(id!),
    onSuccess: () => {
      showToast('Match is LIVE');
      void qc.invalidateQueries({ queryKey: ['match', id] });
      void qc.invalidateQueries({ queryKey: ['matches'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not start'),
  });

  const remove = useMutation({
    mutationFn: () => matchesApi.remove(id!),
    onSuccess: () => {
      showToast('Match deleted');
      void qc.invalidateQueries({ queryKey: ['matches'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/matches');
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not delete'),
  });

  if (query.isLoading) return <Skeleton className="mx-auto h-80 max-w-3xl w-full" />;
  if (query.isError || !query.data) {
    const status = query.error instanceof ApiError ? query.error.status : undefined;
    return (
      <EmptyState
        title={status === 403 ? 'Access denied' : 'Match not found'}
        description={
          status === 403
            ? 'You do not have permission to view this match.'
            : 'It may have been deleted or the link is incorrect.'
        }
        action={
          <Link to="/matches" className="text-sm font-semibold text-primary">
            Back to matches
          </Link>
        }
      />
    );
  }

  const m = query.data;
  const editable = m.status === 'DRAFT' || m.status === 'UPCOMING';
  const deletable = m.status === 'DRAFT' || m.status === 'CANCELLED';
  const scoreA = m.scoreSummary?.teamA;
  const scoreB = m.scoreSummary?.teamB;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold">{m.name}</h2>
              <Badge tone={m.status === 'LIVE' ? 'danger' : 'info'}>{m.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {m.teamA.teamName} vs {m.teamB.teamName}
            </p>
            <p className="text-xs text-text-muted">
              {m.venue}
              {m.scheduledAt ? ` · ${new Date(m.scheduledAt).toLocaleString()}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {editable ? (
              <Link
                to={`/matches/${m.id}/edit`}
                className="inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-semibold"
              >
                Edit
              </Link>
            ) : null}
            {editable ? (
              <Button disabled={start.isPending} onClick={() => start.mutate()}>
                {start.isPending ? 'Starting…' : 'Start Match'}
              </Button>
            ) : null}
            {m.status === 'LIVE' ? (
              <Link
                to={`/matches/${m.id}/live`}
                className="inline-flex h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-background"
                data-testid="open-scoring"
              >
                Open Scoring
              </Link>
            ) : null}
            {m.status === 'LIVE' || m.status === 'COMPLETED' ? (
              <Link
                to={`/matches/${m.id}/scorecard`}
                className="inline-flex h-11 items-center rounded-control border border-border px-4 text-sm font-semibold"
                data-testid="view-scorecard"
              >
                {m.status === 'COMPLETED' ? 'View Scorecard' : 'Scorecard'}
              </Link>
            ) : null}
            {deletable ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        {(scoreA || scoreB) && (m.status === 'LIVE' || m.status === 'COMPLETED') ? (
          <div className="grid grid-cols-2 gap-4 rounded-control border border-border-subtle bg-surface-elevated/60 p-3">
            <div>
              <p className="text-sm font-semibold">{m.teamA.teamShortName || m.teamA.teamName}</p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {scoreA ? `${scoreA.runs}/${scoreA.wickets}` : '—'}
              </p>
              {scoreA ? <p className="text-xs text-text-muted">{scoreA.overs} OV</p> : null}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{m.teamB.teamShortName || m.teamB.teamName}</p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {scoreB ? `${scoreB.runs}/${scoreB.wickets}` : '—'}
              </p>
              {scoreB ? <p className="text-xs text-text-muted">{scoreB.overs} OV</p> : null}
            </div>
          </div>
        ) : null}

        {m.status === 'COMPLETED' && m.resultText ? (
          <p className="text-sm font-medium text-primary">{m.resultText}</p>
        ) : null}

        {m.status === 'LIVE' ? (
          <p className="rounded-control border border-primary/30 bg-primary-muted px-3 py-2 text-sm text-primary">
            Match is LIVE. Open Scoring to record deliveries with the TurfScore keypad.
          </p>
        ) : null}
      </Card>

      {m.status === 'LIVE' || m.status === 'COMPLETED' ? (
        <LiveSharingPanel matchId={m.id} />
      ) : null}

      <Card className="space-y-2 text-sm">
        <h3 className="font-semibold">Rules</h3>
        <p>
          {m.rules.overs} overs · {m.rules.ballsPerOver} balls/over · {m.rules.playersPerSide}{' '}
          players/side
          {m.rules.maxOversPerBowler ? ` · max ${m.rules.maxOversPerBowler} overs/bowler` : ''}
        </p>
        {m.rules.powerplayEnabled ? (
          <p>Powerplay: {m.rules.powerplayOvers} overs</p>
        ) : null}
        {m.rules.superOverEnabled ? <p>Super over enabled</p> : null}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {[m.teamA, m.teamB].map((side) => (
          <Card key={side.teamId} className="space-y-2">
            <h3 className="font-semibold">
              <Link to={`/teams/${side.teamId}`} className="hover:text-primary">
                {side.teamName ?? 'Team'}
              </Link>
            </h3>
            {side.playingXi.length ? (
              <ol className="space-y-1 text-sm">
                {[...side.playingXi]
                  .sort((a, b) => a.battingOrder - b.battingOrder)
                  .map((p) => (
                    <li key={p.playerId} className="flex justify-between gap-2">
                      <Link to={`/players/${p.playerId}`} className="hover:text-primary">
                        {p.battingOrder}. {p.playerName ?? 'Player'}
                        {p.isWicketKeeper ? ' (WK)' : ''}
                        {p.isCaptain ? ' (C)' : ''}
                      </Link>
                      <span className="text-xs text-text-muted">{p.role ?? ''}</span>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="text-sm text-text-muted">Playing XI not set</p>
            )}
          </Card>
        ))}
      </div>

      <Card className="space-y-1 text-sm">
        <h3 className="font-semibold">Toss</h3>
        {m.toss ? (
          <>
            <p>
              Winner team:{' '}
              {m.toss.wonByTeamId === m.teamA.teamId ? m.teamA.teamName : m.teamB.teamName}
            </p>
            <p>Decision: {m.toss.decision}</p>
            {m.firstInnings ? (
              <p>
                First batting:{' '}
                {m.firstInnings.battingTeamId === m.teamA.teamId
                  ? m.teamA.teamName
                  : m.teamB.teamName}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-text-muted">Toss not recorded</p>
        )}
      </Card>

      {m.warnings?.length ? (
        <Card className="text-sm text-warning">
          {m.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this match?"
        description="This will remove it from your match history. Only draft or cancelled matches can be deleted."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
