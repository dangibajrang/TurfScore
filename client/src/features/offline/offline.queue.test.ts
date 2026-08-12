import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetOfflineDbForTests } from './db';
import { enqueueCommand, listActiveQueue, countByStatus, updateQueueEvent } from './queue';
import { projectPresentationAfterCommand } from './localProjection';
import type { LivePresentation } from '@/features/scoring/types';
import type { QueuedScoringEvent } from './types';

describe('offline queue', () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
  });

  it('persists events in clientSequence order per match', async () => {
    const matchId = 'm1';
    await enqueueCommand({
      matchId,
      eventId: 'e1',
      payload: { type: 'DELIVERY', body: { batterId: 'a', nonStrikerId: 'b', bowlerId: 'c', batterRuns: 1 } },
      baseExpectedVersion: 1,
    });
    await enqueueCommand({
      matchId,
      eventId: 'e2',
      payload: { type: 'DELIVERY', body: { batterId: 'a', nonStrikerId: 'b', bowlerId: 'c', batterRuns: 4 } },
      baseExpectedVersion: 1,
    });
    await enqueueCommand({
      matchId: 'm2',
      eventId: 'e3',
      payload: { type: 'UNDO', body: {} },
      baseExpectedVersion: 2,
    });

    const q1 = await listActiveQueue(matchId);
    expect(q1.map((e: QueuedScoringEvent) => e.eventId)).toEqual(['e1', 'e2']);
    expect(q1[0]!.clientSequence).toBeLessThan(q1[1]!.clientSequence);

    const q2 = await listActiveQueue('m2');
    expect(q2).toHaveLength(1);
    expect(q2[0]!.eventId).toBe('e3');
  });

  it('tracks status transitions without deleting failed rows', async () => {
    const row = await enqueueCommand({
      matchId: 'm1',
      eventId: 'fail-1',
      payload: { type: 'UNDO', body: {} },
      baseExpectedVersion: 3,
    });
    expect(row.id).toBeDefined();
    await updateQueueEvent(row.id!, {
      status: 'FAILED',
      lastError: 'conflict',
      lastErrorCode: 'MATCH_VERSION_CONFLICT',
    });
    const counts = await countByStatus('m1');
    expect(counts.FAILED).toBe(1);
    const still = await listActiveQueue('m1');
    expect(still[0]!.eventId).toBe('fail-1');
  });
});

describe('local projection', () => {
  const base: LivePresentation = {
    battingTeamId: 't1',
    bowlingTeamId: 't2',
    totalRuns: 10,
    wickets: 1,
    legalBalls: 6,
    oversDisplay: '1.0',
    currentRunRate: 10,
    target: null,
    requiredRuns: null,
    remainingBalls: null,
    requiredRunRate: null,
    openingsSelected: true,
    bowlerSelected: true,
    pendingNewBatter: false,
    pendingNewBowler: false,
    inningsComplete: false,
    matchComplete: false,
    strikerId: 'a',
    nonStrikerId: 'b',
    currentBowlerId: 'c',
    currentOverNumber: 2,
    ballsInCurrentOver: 0,
    inningsNumber: 1,
  };

  it('adds runs and legal balls for a normal delivery', () => {
    const next = projectPresentationAfterCommand(base, 6, {
      type: 'DELIVERY',
      body: { batterId: 'a', nonStrikerId: 'b', bowlerId: 'c', batterRuns: 4 },
    });
    expect(next.totalRuns).toBe(14);
    expect(next.legalBalls).toBe(7);
    expect(next.oversDisplay).toBe('1.1');
  });

  it('does not increment legal balls for a wide', () => {
    const next = projectPresentationAfterCommand(base, 6, {
      type: 'DELIVERY',
      body: {
        batterId: 'a',
        nonStrikerId: 'b',
        bowlerId: 'c',
        batterRuns: 0,
        extras: { wide: 1 },
      },
    });
    expect(next.totalRuns).toBe(11);
    expect(next.legalBalls).toBe(6);
  });
});
