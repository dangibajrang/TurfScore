import { cn } from '@/lib/cn';
import { chipToneClass, deliveryChipLabel, deliveryChipTone } from '../deliveryDisplay';
import type { DeliveryDto, LivePresentation } from '../types';

type Props = {
  presentation: LivePresentation;
  recentDeliveries: DeliveryDto[];
};

export function CurrentOver({ presentation, recentDeliveries }: Props) {
  const overBalls = recentDeliveries
    .filter(
      (d) =>
        d.inningsNumber === presentation.inningsNumber &&
        d.overNumber === presentation.currentOverNumber,
    )
    .sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="space-y-2" data-testid="current-over">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Over {presentation.currentOverNumber + 1}
        </h3>
        <p className="text-xs text-text-muted">
          {presentation.ballsInCurrentOver} legal ball
          {presentation.ballsInCurrentOver === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {overBalls.length === 0 ? (
          <p className="text-sm text-text-muted">No balls in this over yet.</p>
        ) : (
          overBalls.map((d) => {
            const tone = deliveryChipTone(d);
            return (
              <span
                key={d.id}
                className={cn(
                  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border px-2 text-sm font-bold',
                  chipToneClass[tone],
                )}
                aria-label={deliveryChipLabel(d)}
              >
                {deliveryChipLabel(d)}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
