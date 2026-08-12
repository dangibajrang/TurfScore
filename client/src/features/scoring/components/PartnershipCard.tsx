import { Card } from '@/components/ui';
import type { PartnershipState } from '../types';

type Props = {
  partnership: PartnershipState | undefined;
  playersById: Map<string, { id: string; name: string }>;
};

export function PartnershipCard({ partnership, playersById }: Props) {
  if (!partnership) {
    return (
      <Card data-testid="partnership">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Partnership
        </h3>
        <p className="mt-2 text-sm text-text-muted">No active partnership yet.</p>
      </Card>
    );
  }

  const a = playersById.get(partnership.batterAId)?.name ?? 'Batter A';
  const b = playersById.get(partnership.batterBId)?.name ?? 'Batter B';

  return (
    <Card data-testid="partnership">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Current partnership
      </h3>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
        {partnership.runs}
        <span className="text-base text-text-muted"> ({partnership.balls} balls)</span>
      </p>
      <p className="mt-1 text-sm text-text-muted">
        {a} & {b}
      </p>
    </Card>
  );
}
