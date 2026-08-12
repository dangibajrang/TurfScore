import { describe, expect, it } from 'vitest';
import { deliveryChipLabel, deliveryChipTone } from './deliveryDisplay';
import type { DeliveryDto } from './types';
import { createEventId } from './eventId';
import { scoringErrorMessage } from './errorMessages';
import { ApiError } from '@/lib/apiClient';

function d(partial: Partial<DeliveryDto>): DeliveryDto {
  return {
    id: '1',
    eventId: 'e1',
    inningsNumber: 1,
    overNumber: 0,
    ballNumber: 1,
    sequence: 1,
    batterId: 'b1',
    nonStrikerId: 'b2',
    bowlerId: 'p1',
    runs: { batterRuns: 0, extrasRuns: 0, totalRuns: 0 },
    extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 },
    wicket: { isWicket: false },
    isLegalDelivery: true,
    ...partial,
  };
}

describe('deliveryDisplay', () => {
  it('labels normal runs from server fields only', () => {
    expect(deliveryChipLabel(d({ runs: { batterRuns: 4, extrasRuns: 0, totalRuns: 4 } }))).toBe(
      '4',
    );
    expect(deliveryChipTone(d({ runs: { batterRuns: 6, extrasRuns: 0, totalRuns: 6 } }))).toBe(
      'boundary',
    );
  });

  it('labels extras and wickets from stored delivery', () => {
    expect(deliveryChipLabel(d({ extras: { wide: 1, noBall: 0, bye: 0, legBye: 0, penalty: 0 } }))).toBe(
      'WD',
    );
    expect(
      deliveryChipLabel(
        d({
          extras: { wide: 0, noBall: 1, bye: 0, legBye: 0, penalty: 0 },
          runs: { batterRuns: 4, extrasRuns: 1, totalRuns: 5 },
        }),
      ),
    ).toBe('NB+4');
    expect(
      deliveryChipTone(
        d({ wicket: { isWicket: true, wicketType: 'BOWLED', playerOutId: 'b1' } }),
      ),
    ).toBe('wicket');
  });
});

describe('eventId + errors', () => {
  it('creates unique event ids', () => {
    expect(createEventId('t')).not.toEqual(createEventId('t'));
  });

  it('maps version conflict message', () => {
    const msg = scoringErrorMessage(
      new ApiError(409, 'MATCH_VERSION_CONFLICT', 'conflict'),
    );
    expect(msg).toMatch(/refreshing/i);
  });
});
