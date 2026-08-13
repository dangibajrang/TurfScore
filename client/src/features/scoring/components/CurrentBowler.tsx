import { Avatar, Button, Card } from '@/components/ui';
import type { InningsState, MatchScorecard } from '../types';

type PlayerInfo = { id: string; name: string };

type Props = {
  innings: InningsState;
  scorecardInnings: MatchScorecard['innings'][number] | undefined;
  playersById: Map<string, PlayerInfo>;
  onSelectBowler?: () => void;
};

export function CurrentBowler({ innings, scorecardInnings, playersById, onSelectBowler }: Props) {
  const id = innings.currentBowlerId;
  if (!id) {
    return (
      <Card className="space-y-3" data-testid="current-bowler">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Current bowler
        </h3>
        <p className="text-sm text-text-muted">No bowler selected for this over.</p>
        {onSelectBowler ? (
          <Button
            className="w-full"
            size="sm"
            onClick={onSelectBowler}
            data-testid="select-bowler"
          >
            Select bowler
          </Button>
        ) : null}
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
      <div className="flex min-w-0 items-center gap-2">
        <Avatar name={name} size="sm" className="shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="break-words text-sm text-text-muted tabular-nums">
            {sc?.oversDisplay ?? '0.0'} – {stats?.maidens ?? 0} – {stats?.runsConceded ?? 0} –{' '}
            {stats?.wickets ?? 0}
            {sc ? ` · Econ ${sc.economy.toFixed(2)}` : ''}
          </p>
        </div>
      </div>
    </Card>
  );
}
