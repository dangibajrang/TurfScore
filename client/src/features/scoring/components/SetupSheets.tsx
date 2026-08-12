import { useMemo, useState } from 'react';
import { Avatar, Button, Modal } from '@/components/ui';
import type { MatchDto } from '@/features/matches/types';
import type { MatchState } from '../types';

type XiPlayer = {
  playerId: string;
  playerName: string | null;
  role: string | null;
};

function sidePlayers(match: MatchDto, teamId: string): XiPlayer[] {
  const side = match.teamA.teamId === teamId ? match.teamA : match.teamB;
  return [...side.playingXi].sort((a, b) => a.battingOrder - b.battingOrder);
}

type OpeningsProps = {
  open: boolean;
  match: MatchDto;
  state: MatchState;
  onClose: () => void;
  onConfirm: (strikerId: string, nonStrikerId: string) => void;
  pending?: boolean;
};

export function OpeningBattersSheet({
  open,
  match,
  state,
  onClose,
  onConfirm,
  pending,
}: OpeningsProps) {
  const inn = state.innings[state.currentInningsIndex];
  const players = useMemo(() => sidePlayers(match, inn.battingTeamId), [match, inn.battingTeamId]);
  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      title="Select opening batters"
      onClose={onClose}
      footer={
        <Button
          className="w-full"
          disabled={!strikerId || !nonStrikerId || strikerId === nonStrikerId || pending}
          onClick={() => strikerId && nonStrikerId && onConfirm(strikerId, nonStrikerId)}
          data-testid="confirm-openings"
        >
          {pending ? 'Saving…' : 'Confirm openings'}
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Striker</p>
          <div className="grid gap-2">
            {players.map((p) => (
              <PlayerPick
                key={`s-${p.playerId}`}
                name={p.playerName ?? 'Player'}
                role={p.role}
                selected={strikerId === p.playerId}
                disabled={nonStrikerId === p.playerId}
                onClick={() => setStrikerId(p.playerId)}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Non-striker</p>
          <div className="grid gap-2">
            {players.map((p) => (
              <PlayerPick
                key={`ns-${p.playerId}`}
                name={p.playerName ?? 'Player'}
                role={p.role}
                selected={nonStrikerId === p.playerId}
                disabled={strikerId === p.playerId}
                onClick={() => setNonStrikerId(p.playerId)}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

type BowlerProps = {
  open: boolean;
  match: MatchDto;
  state: MatchState;
  onClose: () => void;
  onConfirm: (bowlerId: string) => void;
  pending?: boolean;
};

export function BowlerSelectSheet({
  open,
  match,
  state,
  onClose,
  onConfirm,
  pending,
}: BowlerProps) {
  const inn = state.innings[state.currentInningsIndex];
  const players = useMemo(() => sidePlayers(match, inn.bowlingTeamId), [match, inn.bowlingTeamId]);
  const maxOvers = state.rules.maxOversPerBowler ?? Math.ceil(state.rules.overs / 5);
  const ballsPerOver = state.rules.ballsPerOver;

  return (
    <Modal
      open={open}
      title="Select bowler"
      onClose={onClose}
      className="sm:max-w-md"
    >
      <ul className="space-y-2">
        {players.map((p) => {
          const figs = inn.bowlers[p.playerId];
          const completedOvers = figs
            ? Math.floor(figs.legalBalls / ballsPerOver)
            : 0;
          const atLimit = completedOvers >= maxOvers;
          return (
            <li key={p.playerId}>
              <button
                type="button"
                disabled={atLimit || pending}
                className="flex w-full items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface-elevated px-3 py-3 text-left disabled:opacity-40"
                onClick={() => onConfirm(p.playerId)}
                data-testid={`pick-bowler-${p.playerId}`}
              >
                <span className="flex items-center gap-2">
                  <Avatar name={p.playerName ?? 'P'} size="sm" />
                  <span>
                    <span className="block font-semibold">{p.playerName ?? 'Player'}</span>
                    <span className="text-xs text-text-muted">{p.role ?? 'BOWLER'}</span>
                  </span>
                </span>
                <span className="text-right text-xs text-text-muted">
                  {completedOvers}/{maxOvers} ov
                  {figs
                    ? ` · ${figs.runsConceded}/${figs.wickets}`
                    : ' · available'}
                  {atLimit ? ' · limit' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

type ReplaceProps = {
  open: boolean;
  match: MatchDto;
  state: MatchState;
  onClose: () => void;
  onConfirm: (nextBatterId: string) => void;
  pending?: boolean;
};

export function ReplacementBatterSheet({
  open,
  match,
  state,
  onClose,
  onConfirm,
  pending,
}: ReplaceProps) {
  const inn = state.innings[state.currentInningsIndex];
  const players = useMemo(() => {
    return sidePlayers(match, inn.battingTeamId).filter((p) => {
      const st = inn.batters[p.playerId];
      if (st?.isOut || st?.isRetiredHurt) return false;
      if (p.playerId === inn.strikerId || p.playerId === inn.nonStrikerId) return false;
      return true;
    });
  }, [match, inn]);

  return (
    <Modal open={open} title="Select next batter" onClose={onClose}>
      {players.length === 0 ? (
        <p className="text-sm text-text-muted">No eligible batters remaining.</p>
      ) : (
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.playerId}>
              <button
                type="button"
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-control border border-border-subtle px-3 py-3 text-left hover:bg-surface-elevated"
                onClick={() => onConfirm(p.playerId)}
                data-testid={`pick-batter-${p.playerId}`}
              >
                <Avatar name={p.playerName ?? 'P'} size="sm" />
                <span className="font-semibold">{p.playerName ?? 'Player'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function PlayerPick({
  name,
  role,
  selected,
  disabled,
  onClick,
}: {
  name: string;
  role: string | null;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        selected
          ? 'flex w-full items-center gap-2 rounded-control border border-primary bg-primary-muted px-3 py-3 text-left'
          : 'flex w-full items-center gap-2 rounded-control border border-border-subtle px-3 py-3 text-left hover:bg-surface-elevated disabled:opacity-40'
      }
    >
      <Avatar name={name} size="sm" />
      <span>
        <span className="block font-semibold">{name}</span>
        <span className="text-xs text-text-muted">{role}</span>
      </span>
    </button>
  );
}
