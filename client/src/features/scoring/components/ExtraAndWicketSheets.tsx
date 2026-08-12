import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { WICKET_LABELS } from '../deliveryDisplay';
import type { MatchDto } from '@/features/matches/types';
import type { MatchState, WicketType } from '../types';
import { useScoringUiStore } from '../scoringUiStore';

const WICKET_TYPES: WicketType[] = [
  'BOWLED',
  'CAUGHT',
  'LBW',
  'STUMPED',
  'RUN_OUT',
  'HIT_WICKET',
  'RETIRED_HURT',
  'OTHER',
];

type ExtraProps = {
  open: boolean;
  title: string;
  options: number[];
  onClose: () => void;
  onConfirm: (value: number) => void;
  pending?: boolean;
};

export function ExtraRunsSheet({ open, title, options, onClose, onConfirm, pending }: ExtraProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            className="min-h-12 rounded-control border border-border-subtle bg-surface-elevated text-lg font-bold disabled:opacity-40"
            onClick={() => onConfirm(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </Modal>
  );
}

type NoBallProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (batterRuns: number) => void;
  pending?: boolean;
};

export function NoBallSheet({ open, onClose, onConfirm, pending }: NoBallProps) {
  return (
    <ExtraRunsSheet
      open={open}
      title="No ball + bat runs"
      options={[0, 1, 2, 3, 4, 6]}
      onClose={onClose}
      onConfirm={onConfirm}
      pending={pending}
    />
  );
}

type WicketProps = {
  open: boolean;
  match: MatchDto;
  state: MatchState;
  onClose: () => void;
  onConfirm: (payload: {
    playerOutId: string;
    wicketType: WicketType;
    fielderId?: string;
    runsCompleted?: number;
    nextBatterId?: string;
  }) => void;
  pending?: boolean;
};

export function WicketSheet({ open, match, state, onClose, onConfirm, pending }: WicketProps) {
  const draft = useScoringUiStore((s) => s.wicketDraft);
  const setDraft = useScoringUiStore((s) => s.setWicketDraft);
  const reset = useScoringUiStore((s) => s.resetWicketDraft);
  const [step, setStep] = useState(1);

  const inn = state.innings[state.currentInningsIndex];
  const batters = [inn.strikerId, inn.nonStrikerId].filter(Boolean) as string[];
  const nameOf = (id: string) => {
    const xi = [...match.teamA.playingXi, ...match.teamB.playingXi].find((p) => p.playerId === id);
    return xi?.playerName ?? 'Player';
  };

  const bowlingXi =
    match.teamA.teamId === inn.bowlingTeamId ? match.teamA.playingXi : match.teamB.playingXi;
  const battingXi =
    match.teamA.teamId === inn.battingTeamId ? match.teamA.playingXi : match.teamB.playingXi;

  const needsFielder =
    draft.wicketType === 'CAUGHT' ||
    draft.wicketType === 'STUMPED' ||
    draft.wicketType === 'RUN_OUT';

  const eligibleNext = battingXi.filter((p) => {
    const st = inn.batters[p.playerId];
    if (st?.isOut || st?.isRetiredHurt) return false;
    if (p.playerId === inn.strikerId || p.playerId === inn.nonStrikerId) return false;
    if (draft.playerOutId && p.playerId === draft.playerOutId) return false;
    return true;
  });

  const close = () => {
    reset();
    setStep(1);
    onClose();
  };

  const canSubmit =
    draft.playerOutId &&
    draft.wicketType &&
    (!needsFielder || draft.fielderId) &&
    (draft.wicketType === 'RETIRED_HURT' || draft.nextBatterId || eligibleNext.length === 0);

  return (
    <Modal
      open={open}
      title={`Wicket · Step ${step}/4`}
      onClose={close}
      footer={
        <div className="flex gap-2">
          {step > 1 ? (
            <Button variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="secondary" className="flex-1" onClick={close}>
              Cancel
            </Button>
          )}
          {step < 4 ? (
            <Button
              className="flex-1"
              disabled={
                (step === 1 && !draft.playerOutId) ||
                (step === 2 && !draft.wicketType) ||
                (step === 3 && needsFielder && !draft.fielderId)
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={!canSubmit || pending}
              data-testid="confirm-wicket"
              onClick={() => {
                if (!draft.playerOutId || !draft.wicketType) return;
                onConfirm({
                  playerOutId: draft.playerOutId,
                  wicketType: draft.wicketType,
                  fielderId: draft.fielderId ?? undefined,
                  runsCompleted: draft.runsCompleted || undefined,
                  nextBatterId: draft.nextBatterId ?? undefined,
                });
                reset();
                setStep(1);
              }}
            >
              {pending ? 'Submitting…' : 'Confirm wicket'}
            </Button>
          )}
        </div>
      }
    >
      {step === 1 ? (
        <div className="space-y-2">
          <p className="text-sm text-text-muted">Who is out?</p>
          {batters.map((id) => (
            <button
              key={id}
              type="button"
              className={
                draft.playerOutId === id
                  ? 'w-full rounded-control border border-primary bg-primary-muted px-3 py-3 text-left font-semibold'
                  : 'w-full rounded-control border border-border-subtle px-3 py-3 text-left'
              }
              onClick={() => setDraft({ playerOutId: id })}
            >
              {nameOf(id)}
              {id === inn.strikerId ? ' *' : ''}
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid grid-cols-2 gap-2">
          {WICKET_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={
                draft.wicketType === t
                  ? 'min-h-12 rounded-control border border-danger bg-danger-muted font-semibold'
                  : 'min-h-12 rounded-control border border-border-subtle font-semibold'
              }
              onClick={() => setDraft({ wicketType: t })}
            >
              {WICKET_LABELS[t]}
            </button>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          {needsFielder ? (
            <>
              <p className="text-sm text-text-muted">
                {draft.wicketType === 'STUMPED' ? 'Wicketkeeper / fielder' : 'Fielder'}
              </p>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {bowlingXi.map((p) => (
                  <button
                    key={p.playerId}
                    type="button"
                    className={
                      draft.fielderId === p.playerId
                        ? 'w-full rounded-control border border-primary bg-primary-muted px-3 py-2 text-left'
                        : 'w-full rounded-control border border-border-subtle px-3 py-2 text-left'
                    }
                    onClick={() => setDraft({ fielderId: p.playerId })}
                  >
                    {p.playerName}
                    {p.isWicketKeeper ? ' (WK)' : ''}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">No fielder required for this dismissal.</p>
          )}
          {(draft.wicketType === 'RUN_OUT' || draft.wicketType === 'OTHER') && (
            <div>
              <p className="mb-2 text-sm text-text-muted">Runs completed before wicket</p>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={
                      draft.runsCompleted === n
                        ? 'min-h-10 min-w-10 rounded-control border border-primary bg-primary-muted font-bold'
                        : 'min-h-10 min-w-10 rounded-control border border-border-subtle font-bold'
                    }
                    onClick={() => setDraft({ runsCompleted: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-2">
          <p className="text-sm text-text-muted">Replacement batter</p>
          {eligibleNext.length === 0 ? (
            <p className="text-sm text-warning">No remaining batters — innings may end.</p>
          ) : (
            eligibleNext.map((p) => (
              <button
                key={p.playerId}
                type="button"
                className={
                  draft.nextBatterId === p.playerId
                    ? 'w-full rounded-control border border-primary bg-primary-muted px-3 py-3 text-left font-semibold'
                    : 'w-full rounded-control border border-border-subtle px-3 py-3 text-left'
                }
                onClick={() => setDraft({ nextBatterId: p.playerId })}
              >
                {p.playerName}
              </button>
            ))
          )}
        </div>
      ) : null}
    </Modal>
  );
}
