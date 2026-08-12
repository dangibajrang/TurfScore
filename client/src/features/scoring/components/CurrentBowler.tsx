import { Avatar, Card } from '@/components/ui';
import type { InningsState, MatchScorecard } from '../types';

type Props = {
  innings: InningsState;
  scorecardInnings: MatchScorecard['innings'][number] | undefined;
  playersById: Map<string, { id: string; name: string }>;
};

export function CurrentBowler({ innings, scorecardInnings, playersById }: Props) {
  const id = innings.currentBowlerId;
  if (!id) {
    return (
      <Card data-testid="current-bowler">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Current bowler
        </h3>
        <p className="mt-2 text-sm text-text-muted">Select a bowler to continue.</p>
      </Card>
    );
  }

  const name = playersById.get(id)?.name ?? 'Bowler';
  const sc = scorecardInnings?.bowling.find((b) => b.playerId === id);
  const stats = innings.bowlers[id];

  return (
    <Card className="space-y-2" data-testid="current-bowler">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Current bowler
      </h3>
      <div className="flex items-center gap-2">
        <Avatar name={name} size="sm" />
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-text-muted tabular-nums">
            {sc?.oversDisplay ?? '0.0'} – {stats?.maidens ?? 0} – {stats?.runsConceded ?? 0} –{' '}
            {stats?.wickets ?? 0}
            {sc ? ` · Econ ${sc.economy.toFixed(2)}` : ''}
          </p>
        </div>
      </div>
    </Card>
  );
}
