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
  'min-h-[48px] min-w-0 w-full rounded-control border border-border-subtle bg-surface-elevated text-lg font-bold text-text transition active:scale-[0.97] disabled:opacity-40 sm:min-h-[56px] sm:text-xl';

const extraBtn =
  'min-h-[44px] min-w-0 w-full rounded-control px-0.5 text-center text-[11px] font-semibold leading-tight text-white disabled:opacity-40 sm:min-h-[48px] sm:px-1 sm:text-sm';

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
    <div className="min-w-0 space-y-2" data-testid="scoring-keypad" aria-label="Scoring keypad">
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
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

      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        <button
          type="button"
          disabled={disabled}
          className={cn(extraBtn, 'bg-[color:var(--color-wide)]')}
          onClick={onWide}
          data-testid="score-wide"
        >
          WIDE
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cn(extraBtn, 'bg-[color:var(--color-noball)]')}
          onClick={onNoBall}
          data-testid="score-noball"
        >
          NO BALL
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cn(extraBtn, 'bg-[color:var(--color-bye)]')}
          onClick={onBye}
          data-testid="score-bye"
        >
          BYE
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cn(extraBtn, 'bg-[color:var(--color-bye)]/80')}
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
