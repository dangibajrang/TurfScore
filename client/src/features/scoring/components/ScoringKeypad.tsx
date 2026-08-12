import { cn } from '@/lib/cn';

type Props = {
  disabled?: boolean;
  onRuns: (runs: number) => void;
  onWicket: () => void;
  onWide: () => void;
  onNoBall: () => void;
  onBye: () => void;
  onLegBye: () => void;
  onUndo: () => void;
};

const runBtn =
  'min-h-[52px] min-w-[52px] rounded-control border border-border-subtle bg-surface-elevated text-xl font-bold text-text transition active:scale-[0.97] disabled:opacity-40 sm:min-h-[56px]';

export function ScoringKeypad({
  disabled,
  onRuns,
  onWicket,
  onWide,
  onNoBall,
  onBye,
  onLegBye,
  onUndo,
}: Props) {
  return (
    <div className="space-y-2" data-testid="scoring-keypad" aria-label="Scoring keypad">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            className={cn(runBtn, n === 4 || n === 6 ? 'border-primary/40 text-primary' : '')}
            onClick={() => onRuns(n)}
            aria-label={`Score ${n}`}
            data-testid={`score-${n}`}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        className="min-h-[52px] w-full rounded-control bg-danger text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
        onClick={onWicket}
        data-testid="score-wicket"
      >
        WICKET
      </button>

      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          disabled={disabled}
          className="min-h-[48px] rounded-control bg-[color:var(--color-wide)] font-semibold text-white disabled:opacity-40"
          onClick={onWide}
          data-testid="score-wide"
        >
          WIDE
        </button>
        <button
          type="button"
          disabled={disabled}
          className="min-h-[48px] rounded-control bg-[color:var(--color-noball)] font-semibold text-white disabled:opacity-40"
          onClick={onNoBall}
          data-testid="score-noball"
        >
          NO BALL
        </button>
        <button
          type="button"
          disabled={disabled}
          className="min-h-[48px] rounded-control bg-[color:var(--color-bye)] font-semibold text-white disabled:opacity-40"
          onClick={onBye}
          data-testid="score-bye"
        >
          BYE
        </button>
        <button
          type="button"
          disabled={disabled}
          className="min-h-[48px] rounded-control bg-[color:var(--color-bye)]/80 font-semibold text-white disabled:opacity-40"
          onClick={onLegBye}
          data-testid="score-legbye"
        >
          LEG BYE
        </button>
      </div>

      <button
        type="button"
        disabled={disabled}
        className="min-h-[48px] w-full rounded-control border border-border bg-surface font-semibold text-text-muted transition hover:text-text disabled:opacity-40"
        onClick={onUndo}
        data-testid="score-undo"
      >
        UNDO
      </button>
    </div>
  );
}
