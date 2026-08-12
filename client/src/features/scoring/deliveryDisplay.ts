import type { DeliveryDto } from './types';

/** Label for ball chip — presentation only from stored delivery fields. */
export function deliveryChipLabel(d: DeliveryDto): string {
  if (d.wicket?.isWicket) return 'W';
  if ((d.extras?.wide ?? 0) > 0) return `WD${d.extras.wide > 1 ? d.extras.wide : ''}`;
  if ((d.extras?.noBall ?? 0) > 0) {
    const bat = d.runs.batterRuns;
    return bat > 0 ? `NB+${bat}` : 'NB';
  }
  if ((d.extras?.bye ?? 0) > 0) return `B${d.extras.bye}`;
  if ((d.extras?.legBye ?? 0) > 0) return `LB${d.extras.legBye}`;
  return String(d.runs.batterRuns);
}

export function deliveryChipTone(
  d: DeliveryDto,
): 'default' | 'wicket' | 'wide' | 'noball' | 'bye' | 'boundary' {
  if (d.wicket?.isWicket) return 'wicket';
  if ((d.extras?.wide ?? 0) > 0) return 'wide';
  if ((d.extras?.noBall ?? 0) > 0) return 'noball';
  if ((d.extras?.bye ?? 0) > 0 || (d.extras?.legBye ?? 0) > 0) return 'bye';
  if (d.runs.batterRuns === 4 || d.runs.batterRuns === 6) return 'boundary';
  return 'default';
}

export const chipToneClass: Record<ReturnType<typeof deliveryChipTone>, string> = {
  default: 'bg-surface-elevated text-text border-border-subtle',
  wicket: 'bg-danger text-white border-danger',
  wide: 'bg-[color:var(--color-wide)] text-white border-transparent',
  noball: 'bg-[color:var(--color-noball)] text-white border-transparent',
  bye: 'bg-[color:var(--color-bye)] text-white border-transparent',
  boundary: 'bg-primary text-background border-primary',
};

export const WICKET_LABELS: Record<string, string> = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  LBW: 'LBW',
  STUMPED: 'Stumped',
  RUN_OUT: 'Run Out',
  HIT_WICKET: 'Hit Wicket',
  RETIRED_HURT: 'Retired Hurt',
  OTHER: 'Other',
};
