import { createEventId } from '@/features/scoring/eventId';
import type { ScoringStateResponse } from '@/features/scoring/types';
import type { MatchDto } from '@/features/matches/types';
import {
  isProbablyOnline,
  isNetworkFailure,
  markApiUnreachable,
  markApiReachable,
  probeApiHealth,
} from './connectivity';
import { ensureOfflineDb } from './db';
import { OfflineError, OFFLINE_UNAVAILABLE } from './errors';
import { buildLocalHint, projectPresentationAfterCommand, projectStateAfterCommand } from './localProjection';
import { countByStatus, enqueueCommand, saveMatchContext } from './queue';
import { useOfflineUiStore } from './offlineUiStore';
import { syncMatchQueue } from './sync';
import type { OfflineCommandPayload, QueuedScoringEvent } from './types';
import { scoringApi } from '@/features/scoring/scoringApi';
import { ApiError } from '@/lib/apiClient';

export type SubmitOutcome =
  | {
      mode: 'online';
      response: unknown;
      matchVersion: number;
    }
  | {
      mode: 'queued';
      event: QueuedScoringEvent;
      projectedPresentation: ScoringStateResponse['presentation'];
      projectedState: ScoringStateResponse['state'];
    };

async function postOnline(
  matchId: string,
  eventId: string,
  expectedVersion: number,
  payload: OfflineCommandPayload,
): Promise<{ matchVersion: number; response: unknown }> {
  const run = async () => {
    if (payload.type === 'DELIVERY') {
      const response = await scoringApi.recordDelivery(matchId, {
        ...payload.body,
        eventId,
        expectedVersion,
      });
      return { matchVersion: response.matchVersion, response };
    }
    if (payload.type === 'UNDO') {
      const response = await scoringApi.undo(matchId, expectedVersion);
      return { matchVersion: response.matchVersion, response };
    }
    if (payload.type === 'SET_OPENINGS') {
      const response = await scoringApi.setOpenings(matchId, {
        ...payload.body,
        expectedVersion,
      });
      return { matchVersion: response.matchVersion, response };
    }
    if (payload.type === 'SELECT_BOWLER') {
      const response = await scoringApi.selectBowler(matchId, {
        ...payload.body,
        expectedVersion,
      });
      return { matchVersion: response.matchVersion, response };
    }
    if (payload.type === 'SELECT_BATTER') {
      const response = await scoringApi.selectBatter(matchId, {
        ...payload.body,
        expectedVersion,
      });
      return { matchVersion: response.matchVersion, response };
    }
    if (payload.type === 'START_INNINGS') {
      const response = await scoringApi.startInnings(matchId, {
        ...payload.body,
        expectedVersion,
      });
      return { matchVersion: response.matchVersion, response };
    }
    throw new Error('Unknown payload');
  };

  return Promise.race([
    run(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new TypeError('Network timeout')), 10_000);
    }),
  ]);
}

export async function queueLocally(input: {
  matchId: string;
  eventId: string;
  payload: OfflineCommandPayload;
  baseExpectedVersion: number;
  match: MatchDto;
  snapshot: ScoringStateResponse;
}): Promise<SubmitOutcome> {
  const ok = await ensureOfflineDb();
  if (!ok) {
    throw new OfflineError(OFFLINE_UNAVAILABLE, 'Offline scoring is unavailable on this browser.');
  }

  const event = await enqueueCommand({
    matchId: input.matchId,
    eventId: input.eventId,
    payload: input.payload,
    baseExpectedVersion: input.baseExpectedVersion,
  });

  const ballsPerOver = input.snapshot.state.rules.ballsPerOver ?? 6;
  const projected = projectPresentationAfterCommand(
    input.snapshot.presentation,
    ballsPerOver,
    input.payload,
  );
  const projectedState = projectStateAfterCommand(
    input.snapshot.state,
    ballsPerOver,
    input.payload,
    input.snapshot.presentation,
  );
  const counts = await countByStatus(input.matchId);
  const pending = counts.PENDING + counts.SYNCING + counts.FAILED;
  const hint = buildLocalHint(input.snapshot, pending, projected);

  // Update UI counts immediately so the scorer sees pending status before context write.
  useOfflineUiStore.getState().setCounts(pending, counts.FAILED);
  useOfflineUiStore.getState().setConnection('OFFLINE');
  useOfflineUiStore.getState().setLastFlash('queued');

  // Persist match context — awaited so refresh/crash after "queued" still has resume data.
  await saveMatchContext({
    matchId: input.matchId,
    match: input.match,
    serverSnapshot: {
      ...input.snapshot,
      presentation: projected,
      state: projectedState,
    },
    localPresentationHint: hint,
  });

  return {
    mode: 'queued',
    event,
    projectedPresentation: projected,
    projectedState,
  };
}

/**
 * Online-first: try API; on network failure, queue the same eventId.
 * Business errors propagate (not queued).
 */
function shouldForceOfflineQueue(forceQueue?: boolean): boolean {
  if (forceQueue) return true;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (useOfflineUiStore.getState().connection === 'OFFLINE') return true;
  if (!isProbablyOnline()) return true;
  return false;
}

export async function submitScoringCommand(input: {
  matchId: string;
  payload: OfflineCommandPayload;
  eventId?: string;
  expectedVersion: number;
  match: MatchDto;
  snapshot: ScoringStateResponse;
  forceQueue?: boolean;
}): Promise<SubmitOutcome> {
  const eventId = input.eventId ?? createEventId(input.payload.type === 'DELIVERY' ? 'del' : 'cmd');

  // Fast path: never touch the network when the browser/UI already know we are offline.
  // Awaiting probes/fetches while Playwright/browser is offline can hang indefinitely.
  if (shouldForceOfflineQueue(input.forceQueue)) {
    return queueLocally({
      matchId: input.matchId,
      eventId,
      payload: input.payload,
      baseExpectedVersion: input.expectedVersion,
      match: input.match,
      snapshot: input.snapshot,
    });
  }

  // Soft probe only when we think we are online — use a hard timeout so we never stall UI.
  try {
    const reach = await Promise.race([
      probeApiHealth(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 2_000);
      }),
    ]);
    if (reach && (!reach.browserOnline || reach.apiReachable === false)) {
      return queueLocally({
        matchId: input.matchId,
        eventId,
        payload: input.payload,
        baseExpectedVersion: input.expectedVersion,
        match: input.match,
        snapshot: input.snapshot,
      });
    }
  } catch {
    return queueLocally({
      matchId: input.matchId,
      eventId,
      payload: input.payload,
      baseExpectedVersion: input.expectedVersion,
      match: input.match,
      snapshot: input.snapshot,
    });
  }

  try {
    const { matchVersion, response } = await postOnline(
      input.matchId,
      eventId,
      input.expectedVersion,
      input.payload,
    );
    markApiReachable();
    // Persist context without blocking the scorer on IndexedDB write failures.
    void saveMatchContext({
      matchId: input.matchId,
      match: input.match,
      serverSnapshot: { ...input.snapshot, matchVersion },
      localPresentationHint: {
        totalRuns: input.snapshot.presentation.totalRuns,
        wickets: input.snapshot.presentation.wickets,
        legalBalls: input.snapshot.presentation.legalBalls,
        oversDisplay: input.snapshot.presentation.oversDisplay,
        pendingCount: 0,
        confidence: 'SERVER_CONFIRMED',
      },
    });
    void syncMatchQueue(input.matchId, { initialVersion: matchVersion });
    return { mode: 'online', response, matchVersion };
  } catch (err) {
    if (isNetworkFailure(err)) {
      markApiUnreachable();
      return queueLocally({
        matchId: input.matchId,
        eventId,
        payload: input.payload,
        baseExpectedVersion: input.expectedVersion,
        match: input.match,
        snapshot: input.snapshot,
      });
    }
    if (err instanceof ApiError) throw err;
    throw err;
  }
}
