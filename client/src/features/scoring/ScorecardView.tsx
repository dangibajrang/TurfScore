import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, EmptyState, Skeleton, Tabs } from '@/components/ui';
import type { MatchDto } from '@/features/matches/types';
import { WICKET_LABELS } from './deliveryDisplay';
import type { MatchScorecard } from './types';

type Props = {
  match: MatchDto;
  scorecard: MatchScorecard;
  highlightPlayerId?: string | null;
};

export function ScorecardView({ match, scorecard, highlightPlayerId }: Props) {
  const innings = scorecard.innings;
  const [tab, setTab] = useState(String(Math.max(0, innings.length - 1)));

  const playersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of [...match.teamA.playingXi, ...match.teamB.playingXi]) {
      map.set(p.playerId, p.playerName ?? 'Player');
    }
    return map;
  }, [match]);

  const teamName = (id: string) =>
    match.teamA.teamId === id
      ? match.teamA.teamName
      : match.teamB.teamId === id
        ? match.teamB.teamName
        : 'Team';

  if (innings.length === 0) {
    return (
      <EmptyState
        title="No scorecard data yet"
        description="Score some deliveries to build the scorecard."
        action={
          match.status === 'LIVE' ? (
            <Link to={`/matches/${match.id}/live`} className="text-sm font-semibold text-primary">
              Open scoring
            </Link>
          ) : null
        }
      />
    );
  }

  const active = innings[Number(tab)] ?? innings[0];

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="scorecard-view">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">{match.name}</h2>
            <p className="text-sm text-text-muted">
              {match.venue}
              {match.startedAt ? ` · ${new Date(match.startedAt).toLocaleString()}` : ''}
            </p>
          </div>
          <Badge tone={match.status === 'LIVE' ? 'danger' : 'info'}>{match.status}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {innings.map((inn) => (
            <div key={inn.inningsNumber} className="rounded-control border border-border-subtle p-3">
              <p className="text-xs uppercase text-text-muted">{teamName(inn.battingTeamId)}</p>
              <p className="font-display text-3xl font-bold">
                {inn.totalRuns}/{inn.wickets}
              </p>
              <p className="text-sm text-text-muted">{inn.oversDisplay} overs</p>
            </div>
          ))}
        </div>

        {scorecard.result?.resultText || match.resultText ? (
          <p className="rounded-control border border-primary/30 bg-primary-muted px-3 py-2 text-sm font-semibold text-primary">
            {scorecard.result?.resultText ?? match.resultText}
          </p>
        ) : null}
      </Card>

      {innings.length > 1 ? (
        <Tabs
          value={tab}
          onChange={setTab}
          items={innings.map((inn, i) => ({
            id: String(i),
            label: `Innings ${inn.inningsNumber}`,
          }))}
        />
      ) : null}

      <Card className="space-y-4">
        <h3 className="font-semibold">
          {teamName(active.battingTeamId)} innings · {active.totalRuns}/{active.wickets} (
          {active.oversDisplay})
        </h3>

        {/* Desktop batting table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-text-muted">
              <tr>
                <th className="py-2 pr-2">Batter</th>
                <th className="py-2 pr-2">Dismissal</th>
                <th className="py-2 pr-2">R</th>
                <th className="py-2 pr-2">B</th>
                <th className="py-2 pr-2">4s</th>
                <th className="py-2 pr-2">6s</th>
                <th className="py-2">SR</th>
              </tr>
            </thead>
            <tbody>
              {active.batting.map((b) => (
                <tr
                  key={b.playerId}
                  className={
                    highlightPlayerId === b.playerId
                      ? 'border-t border-border-subtle bg-primary/10'
                      : 'border-t border-border-subtle'
                  }
                >
                  <td className="py-2 pr-2 font-medium">
                    {playersById.get(b.playerId) ?? 'Player'}
                    {b.isStriker || b.isNonStriker ? (
                      <span className="text-primary"> *</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-text-muted">
                    {b.isOut
                      ? WICKET_LABELS[b.wicketType ?? ''] ?? b.wicketType ?? 'Out'
                      : b.isRetiredHurt
                        ? 'Retired hurt'
                        : 'not out'}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{b.runs}</td>
                  <td className="py-2 pr-2 tabular-nums">{b.balls}</td>
                  <td className="py-2 pr-2 tabular-nums">{b.fours}</td>
                  <td className="py-2 pr-2 tabular-nums">{b.sixes}</td>
                  <td className="py-2 tabular-nums">{b.strikeRate.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile batting cards */}
        <ul className="space-y-2 md:hidden">
          {active.batting.map((b) => (
            <li
              key={b.playerId}
              className={
                highlightPlayerId === b.playerId
                  ? 'rounded-control border border-primary/40 bg-primary/10 p-3'
                  : 'rounded-control border border-border-subtle p-3'
              }
            >
              <div className="flex justify-between gap-2">
                <p className="font-semibold">
                  {playersById.get(b.playerId) ?? 'Player'}
                  {b.isStriker || b.isNonStriker ? ' *' : ''}
                </p>
                <p className="font-display text-lg tabular-nums">
                  {b.runs} <span className="text-sm text-text-muted">({b.balls})</span>
                </p>
              </div>
              <p className="text-xs text-text-muted">
                4s {b.fours} · 6s {b.sixes} · SR {b.strikeRate.toFixed(1)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {b.isOut
                  ? WICKET_LABELS[b.wicketType ?? ''] ?? 'Out'
                  : b.isRetiredHurt
                    ? 'Retired hurt'
                    : 'not out'}
              </p>
            </li>
          ))}
        </ul>

        <div className="rounded-control border border-border-subtle bg-surface-elevated p-3 text-sm">
          <p className="font-semibold">Extras: {active.extrasTotal}</p>
          <p className="text-text-muted">
            WD {active.extras.wide} · NB {active.extras.noBall} · B {active.extras.bye} · LB{' '}
            {active.extras.legBye}
          </p>
          <p className="mt-2 font-display text-xl font-bold">
            Total {active.totalRuns}/{active.wickets} ({active.oversDisplay} ov)
          </p>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Bowling</h3>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase text-text-muted">
              <tr>
                <th className="py-2 pr-2">Bowler</th>
                <th className="py-2 pr-2">O</th>
                <th className="py-2 pr-2">M</th>
                <th className="py-2 pr-2">R</th>
                <th className="py-2 pr-2">W</th>
                <th className="py-2">Econ</th>
              </tr>
            </thead>
            <tbody>
              {active.bowling.map((b) => (
                <tr key={b.playerId} className="border-t border-border-subtle">
                  <td className="py-2 pr-2 font-medium">
                    {playersById.get(b.playerId) ?? 'Player'}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{b.oversDisplay}</td>
                  <td className="py-2 pr-2 tabular-nums">{b.maidens}</td>
                  <td className="py-2 pr-2 tabular-nums">{b.runsConceded}</td>
                  <td className="py-2 pr-2 tabular-nums">{b.wickets}</td>
                  <td className="py-2 tabular-nums">{b.economy.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-2 md:hidden">
          {active.bowling.map((b) => (
            <li key={b.playerId} className="rounded-control border border-border-subtle p-3">
              <p className="font-semibold">{playersById.get(b.playerId) ?? 'Player'}</p>
              <p className="text-sm text-text-muted tabular-nums">
                {b.oversDisplay}–{b.maidens}–{b.runsConceded}–{b.wickets} · Econ{' '}
                {b.economy.toFixed(2)}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {active.fallOfWickets.length ? (
        <Card className="space-y-2">
          <h3 className="font-semibold">Fall of wickets</h3>
          <ul className="space-y-1 text-sm">
            {active.fallOfWickets.map((f) => (
              <li key={`${f.wicketNumber}-${f.playerOutId}`}>
                {f.wicketNumber}-{f.scoreAtWicket} {playersById.get(f.playerOutId) ?? 'Player'}{' '}
                <span className="text-text-muted">({f.overDisplay})</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {active.partnerships.length ? (
        <Card className="space-y-2">
          <h3 className="font-semibold">Partnerships</h3>
          <ul className="space-y-1 text-sm">
            {active.partnerships.map((p, i) => (
              <li key={`${p.batterAId}-${p.batterBId}-${i}`}>
                {playersById.get(p.batterAId) ?? 'A'} / {playersById.get(p.batterBId) ?? 'B'} —{' '}
                {p.runs} ({p.balls} balls)
                {p.isActive ? ' · active' : ''}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

export function ScorecardSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
