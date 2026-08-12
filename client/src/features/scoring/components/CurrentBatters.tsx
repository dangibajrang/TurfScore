import { Avatar, Card } from '@/components/ui';
import type { InningsState, MatchScorecard } from '../types';

type PlayerInfo = { id: string; name: string };

type Props = {
  innings: InningsState;
  scorecardInnings: MatchScorecard['innings'][number] | undefined;
  playersById: Map<string, PlayerInfo>;
};

export function CurrentBatters({ innings, scorecardInnings, playersById }: Props) {
  const rows = [innings.strikerId, innings.nonStrikerId].filter(Boolean) as string[];

  return (
    <Card className="space-y-3" data-testid="current-batters">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Batters</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No batters selected yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((id) => {
            const sc = scorecardInnings?.batting.find((b) => b.playerId === id);
            const stats = innings.batters[id];
            const name = playersById.get(id)?.name ?? 'Player';
            const isStriker = id === innings.strikerId;
            return (
              <li key={id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {name}
                      {isStriker ? <span className="text-primary"> *</span> : null}
                    </p>
                    <p className="text-xs text-text-muted">
                      4s {stats?.fours ?? 0} · 6s {stats?.sixes ?? 0}
                      {sc ? ` · SR ${sc.strikeRate.toFixed(1)}` : ''}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 font-display text-lg font-semibold tabular-nums">
                  {stats?.runs ?? 0}
                  <span className="text-sm text-text-muted"> ({stats?.balls ?? 0})</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
