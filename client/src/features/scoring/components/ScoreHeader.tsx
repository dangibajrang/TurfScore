import { Badge } from '@/components/ui';
import { OfflineScoreBadge } from '@/features/offline/OfflineScoreBadge';
import { cn } from '@/lib/cn';
import type { LivePresentation } from '../types';

type TeamSide = {
  teamId: string;
  teamName: string | null;
  teamShortName: string | null;
};

type Props = {
  presentation: LivePresentation;
  battingTeam: TeamSide;
  bowlingTeam: TeamSide;
  flash?: 'four' | 'six' | 'wicket' | 'over' | null;
};

export function ScoreHeader({ presentation, battingTeam, bowlingTeam, flash }: Props) {
  const batName = battingTeam.teamShortName || battingTeam.teamName || 'Bat';
  const bowlName = bowlingTeam.teamShortName || bowlingTeam.teamName || 'Bowl';
  const chase = presentation.target != null && presentation.inningsNumber >= 2;

  return (
    <section
      className={cn(
        'min-w-0 rounded-card border border-border-subtle bg-surface p-3 transition sm:p-4',
        flash === 'wicket' && 'motion-safe:animate-pulse border-danger/50',
        (flash === 'four' || flash === 'six') && 'motion-safe:ring-2 motion-safe:ring-primary/50',
      )}
      aria-live="polite"
      data-testid="score-header"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-text-muted">
            {batName}
          </p>
          <p className="font-display text-3xl font-bold tracking-tight text-text sm:text-5xl">
            {presentation.totalRuns}
            <span className="text-text-muted"> / {presentation.wickets}</span>
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {presentation.oversDisplay} Overs
            {presentation.currentRunRate != null
              ? ` · CRR ${presentation.currentRunRate.toFixed(2)}`
              : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <OfflineScoreBadge />
            <Badge tone="danger">LIVE</Badge>
          </div>
          <p className="mt-2 truncate text-sm text-text-muted">vs {bowlName}</p>
        </div>
      </div>

      {chase ? (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-control border border-border-subtle bg-surface-elevated p-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-text-muted">Target</p>
            <p className="font-semibold">{presentation.target}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Required</p>
            <p className="font-semibold">{presentation.requiredRuns ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Balls left</p>
            <p className="font-semibold">{presentation.remainingBalls ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">RRR</p>
            <p className="font-semibold">
              {presentation.requiredRunRate != null
                ? presentation.requiredRunRate.toFixed(2)
                : '—'}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
