import { useQuery } from '@tanstack/react-query';
import { Avatar, Badge, Button, Skeleton } from '@/components/ui';
import { teamsApi } from '@/features/teams/teamsApi';
import type { PlayingXiEntry } from '../types';
import { cn } from '@/lib/cn';

type Props = {
  teamId: string;
  teamLabel: string;
  playersPerSide: number;
  value: PlayingXiEntry[];
  onChange: (next: PlayingXiEntry[]) => void;
};

export function PlayingXiPicker({ teamId, teamLabel, playersPerSide, value, onChange }: Props) {
  const roster = useQuery({
    queryKey: ['team-players', teamId],
    queryFn: () => teamsApi.players(teamId),
    enabled: !!teamId,
  });

  const selected = new Set(value.map((e) => e.playerId));

  const toggle = (playerId: string, role?: string) => {
    if (selected.has(playerId)) {
      const next = value
        .filter((e) => e.playerId !== playerId)
        .map((e, i) => ({ ...e, battingOrder: i + 1 }));
      onChange(next);
      return;
    }
    if (value.length >= playersPerSide) return;
    const mappedRole =
      role === 'BATSMAN'
        ? 'BATTER'
        : role === 'BATTER' || role === 'BOWLER' || role === 'ALL_ROUNDER' || role === 'WICKET_KEEPER'
          ? role
          : 'ALL_ROUNDER';
    onChange([
      ...value,
      {
        playerId,
        role: mappedRole,
        battingOrder: value.length + 1,
        isWicketKeeper: mappedRole === 'WICKET_KEEPER',
      },
    ]);
  };

  const move = (playerId: string, dir: -1 | 1) => {
    const sorted = [...value].sort((a, b) => a.battingOrder - b.battingOrder);
    const idx = sorted.findIndex((e) => e.playerId === playerId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const tmp = sorted[idx];
    sorted[idx] = sorted[swap];
    sorted[swap] = tmp;
    onChange(sorted.map((e, i) => ({ ...e, battingOrder: i + 1 })));
  };

  const setWk = (playerId: string) => {
    onChange(
      value.map((e) => ({
        ...e,
        isWicketKeeper: e.playerId === playerId,
      })),
    );
  };

  if (roster.isLoading) return <Skeleton className="h-40 w-full" />;

  const players = roster.data?.items ?? [];
  const captainMissing =
    players.find((p) => p.isCaptain) && !selected.has(players.find((p) => p.isCaptain)!.id);

  return (
    <div className="space-y-3 rounded-card border border-border-subtle bg-surface p-4" data-testid={`xi-picker-${teamLabel.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{teamLabel}</h3>
        <Badge tone={value.length === playersPerSide ? 'primary' : 'warning'}>
          Selected {value.length} / {playersPerSide}
        </Badge>
      </div>

      {captainMissing ? (
        <p className="text-xs text-warning">Team captain is not in the playing XI.</p>
      ) : null}

      {players.length < playersPerSide ? (
        <p className="text-sm text-danger">
          This team has {players.length} players but needs {playersPerSide} for this format.
        </p>
      ) : null}

      <ul className="space-y-2">
        {players.map((p) => {
          const isSelected = selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id, p.role)}
                disabled={!isSelected && value.length >= playersPerSide}
                aria-pressed={isSelected}
                className={cn(
                  'flex min-h-[44px] w-full items-center gap-3 rounded-control border px-3 py-2 text-left',
                  isSelected
                    ? 'border-primary bg-primary-muted'
                    : 'border-border-subtle hover:border-primary/40',
                  !isSelected && value.length >= playersPerSide && 'opacity-40',
                )}
              >
                <Avatar name={p.name} src={p.profileImageUrl ?? undefined} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.name}
                    {p.isCaptain ? ' · C' : ''}
                    {p.isViceCaptain ? ' · VC' : ''}
                  </p>
                  <p className="text-xs text-text-muted">{p.role.replaceAll('_', ' ')}</p>
                </div>
                <span className="text-xs font-semibold text-primary">
                  {isSelected ? 'In XI' : 'Add'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {value.length > 0 ? (
        <div className="space-y-2 border-t border-border-subtle pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
            Batting order
          </p>
          {[...value]
            .sort((a, b) => a.battingOrder - b.battingOrder)
            .map((e) => {
              const p = players.find((x) => x.id === e.playerId);
              return (
                <div
                  key={e.playerId}
                  className="flex min-h-[44px] items-center gap-2 rounded-control bg-surface-elevated px-2 py-1.5"
                >
                  <span className="w-6 text-sm font-bold text-primary">{e.battingOrder}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p?.name ?? e.playerId}</span>
                  <Button
                    size="sm"
                    variant={e.isWicketKeeper ? 'primary' : 'secondary'}
                    onClick={() => setWk(e.playerId)}
                    aria-label={`Set ${p?.name ?? 'player'} as wicketkeeper`}
                  >
                    WK
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(e.playerId, -1)} aria-label="Move up">
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(e.playerId, 1)} aria-label="Move down">
                    ↓
                  </Button>
                </div>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}
