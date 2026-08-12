import { Avatar, Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  chipToneClass,
  deliveryChipLabel,
  deliveryChipTone,
  WICKET_LABELS,
} from '../deliveryDisplay';
import type { DeliveryDto } from '../types';

type Props = {
  deliveries: DeliveryDto[];
  playersById: Map<string, { id: string; name: string }>;
  onSelect: (d: DeliveryDto) => void;
  compact?: boolean;
};

export function RecentDeliveries({ deliveries, playersById, onSelect, compact }: Props) {
  const items = deliveries.slice(0, 12);

  return (
    <div data-testid="recent-deliveries">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Recent balls
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">No deliveries yet.</p>
      ) : (
        <ul className={cn('space-y-1', compact ? '' : 'max-h-72 overflow-y-auto')}>
          {items.map((d) => {
            const tone = deliveryChipTone(d);
            return (
              <li key={d.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-control px-2 py-2 text-left hover:bg-surface-elevated"
                  onClick={() => onSelect(d)}
                >
                  <span className="text-xs text-text-muted">
                    {d.overNumber}.{d.ballNumber}
                  </span>
                  <span
                    className={cn(
                      'inline-flex min-h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-bold',
                      chipToneClass[tone],
                    )}
                  >
                    {deliveryChipLabel(d)}
                  </span>
                  <span className="truncate text-xs text-text-muted">
                    {playersById.get(d.batterId)?.name ?? 'Batter'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type DetailProps = {
  open: boolean;
  delivery: DeliveryDto | null;
  playersById: Map<string, { id: string; name: string }>;
  onClose: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
};

export function DeliveryDetailModal({
  open,
  delivery,
  playersById,
  onClose,
  onEdit,
  canEdit,
}: DetailProps) {
  if (!delivery) return null;
  const batter = playersById.get(delivery.batterId)?.name ?? 'Batter';
  const bowler = playersById.get(delivery.bowlerId)?.name ?? 'Bowler';

  return (
    <Modal
      open={open}
      title={`${delivery.overNumber}.${delivery.ballNumber}`}
      onClose={onClose}
      footer={
        canEdit && onEdit ? (
          <Button className="w-full" onClick={onEdit}>
            Edit delivery
          </Button>
        ) : null
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <Avatar name={batter} size="sm" />
          <span>
            {batter} <span className="text-text-muted">vs</span> {bowler}
          </span>
        </div>
        <p className="font-display text-2xl font-semibold">
          {delivery.runs.totalRuns} run{delivery.runs.totalRuns === 1 ? '' : 's'}
        </p>
        <p className="text-text-muted">
          Bat {delivery.runs.batterRuns}
          {(delivery.extras.wide ?? 0) > 0 ? ` · Wide ${delivery.extras.wide}` : ''}
          {(delivery.extras.noBall ?? 0) > 0 ? ` · NB ${delivery.extras.noBall}` : ''}
          {(delivery.extras.bye ?? 0) > 0 ? ` · Bye ${delivery.extras.bye}` : ''}
          {(delivery.extras.legBye ?? 0) > 0 ? ` · LB ${delivery.extras.legBye}` : ''}
        </p>
        {delivery.wicket?.isWicket ? (
          <p className="text-danger">
            Wicket: {WICKET_LABELS[delivery.wicket.wicketType ?? ''] ?? delivery.wicket.wicketType}
          </p>
        ) : null}
        {delivery.isCorrection ? (
          <p className="text-xs text-warning">This delivery was corrected.</p>
        ) : null}
      </div>
    </Modal>
  );
}
