import { ApiError } from '@/lib/apiClient';
import { scoringApi } from '@/features/scoring/scoringApi';
import type { ScoringStateResponse } from '@/features/scoring/types';
import {
  isAuthFailure,
  isConflictFailure,
  isNetworkFailure,
  markApiReachable,
  markApiUnreachable,
  probeApiHealth,
} from './connectivity';
import { countByStatus, listActiveQueue, saveMatchContext, updateQueueEvent } from './queue';
import { useOfflineUiStore } from './offlineUiStore';
import { withMatchSyncLock } from './syncLock';
import { cleanupSynced } from './queue';
import { getOfflineDb } from './db';
import type { QueuedScoringEvent } from './types';

const MAX_RETRIES = 8;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

function backoffMs(retryCount: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, retryCount));
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function refreshCounts(matchId: string) {
  const counts = await countByStatus(matchId);
  useOfflineUiStore.getState().setCounts(counts.PENDING + counts.SYNCING, counts.FAILED);
  const ui = useOfflineUiStore.getState();
  if (ui.authPaused) {
    ui.setConnection('AUTH_REQUIRED');
  } else if (ui.conflictPausedMatchId === matchId) {
    ui.setConnection('SYNC_ERROR');
  } else if (counts.FAILED > 0) {
    ui.setConnection('SYNC_ERROR');
  } else if (counts.SYNCING > 0 || counts.PENDING > 0) {
    // leave ONLINE/OFFLINE/SYNCING to caller
  }
}

async function submitEvent(
  matchId: string,
  event: QueuedScoringEvent,
  expectedVersion: number,
): Promise<{ matchVersion: number; stateResponsePartial?: Partial<ScoringStateResponse> }> {
  const payload = event.payload;

  if (payload.type === 'DELIVERY') {
    const res = await scoringApi.recordDelivery(matchId, {
      ...payload.body,
      eventId: event.eventId,
      expectedVersion,
    });
    return {
      matchVersion: res.matchVersion,
      stateResponsePartial: {
        matchVersion: res.matchVersion,
        state: res.state,
        scorecard: res.scorecard,
        // presentation rebuilt via invalidate; keep version
      },
    };
  }

  if (payload.type === 'UNDO') {
    const res = await scoringApi.undo(matchId, expectedVersion);
    return { matchVersion: res.matchVersion };
  }

  if (payload.type === 'SET_OPENINGS') {
    const res = await scoringApi.setOpenings(matchId, {
      ...payload.body,
      expectedVersion,
    });
    return { matchVersion: res.matchVersion };
  }

  if (payload.type === 'SELECT_BOWLER') {
    const res = await scoringApi.selectBowler(matchId, {
      ...payload.body,
      expectedVersion,
    });
    return { matchVersion: res.matchVersion };
  }

  if (payload.type === 'SELECT_BATTER') {
    const res = await scoringApi.selectBatter(matchId, {
      ...payload.body,
      expectedVersion,
    });
    return { matchVersion: res.matchVersion };
  }

  if (payload.type === 'START_INNINGS') {
    const res = await scoringApi.startInnings(matchId, {
      ...payload.body,
      expectedVersion,
    });
    return { matchVersion: res.matchVersion };
  }

  throw new Error(`Unknown command type`);
}

export type SyncResult = {
  synced: number;
  failed: number;
  paused?: 'AUTH' | 'CONFLICT' | 'NETWORK';
  lastMatchVersion: number | null;
};

/**
 * Synchronize PENDING (and retryable FAILED) events for one match, in clientSequence order.
 * Never reorders. Never concurrent for the same match.
 */
export async function syncMatchQueue(
  matchId: string,
  opts?: {
    initialVersion?: number;
    onAuthoritative?: (version: number) => Promise<void> | void;
  },
): Promise<SyncResult> {
  return withMatchSyncLock(matchId, async () => {
    const ui = useOfflineUiStore.getState();
    if (ui.authPaused) {
      ui.setConnection('AUTH_REQUIRED');
      return { synced: 0, failed: 0, paused: 'AUTH', lastMatchVersion: null };
    }
    if (ui.conflictPausedMatchId === matchId) {
      ui.setConnection('SYNC_ERROR');
      return { synced: 0, failed: 0, paused: 'CONFLICT', lastMatchVersion: null };
    }

    const reach = await probeApiHealth(true);
    if (!reach.browserOnline || reach.apiReachable === false) {
      ui.setConnection('OFFLINE');
      return { synced: 0, failed: 0, paused: 'NETWORK', lastMatchVersion: null };
    }

    ui.setSyncingMatchId(matchId);
    ui.setConnection('SYNCING');

    let version = opts?.initialVersion ?? 0;
    let synced = 0;
    let failed = 0;

    try {
      // Always prefer live server version before applying queued commands.
      // Partial sync / reload must not reuse stale baseExpectedVersion.
      try {
        const state = await scoringApi.getState(matchId);
        version = state.matchVersion ?? state.state.version ?? version;
      } catch {
        if (version <= 0) {
          const db = getOfflineDb();
          const syncedRows = await db.queue
            .where('matchId')
            .equals(matchId)
            .filter((r) => r.status === 'SYNCED' && r.serverVersion != null)
            .toArray();
          syncedRows.sort((a, b) => a.clientSequence - b.clientSequence);
          const lastSynced = syncedRows[syncedRows.length - 1];
          if (lastSynced?.serverVersion != null) version = lastSynced.serverVersion;
        }
      }

      const queue = await listActiveQueue(matchId);
      const toProcess = queue.filter(
        (e) =>
          e.status === 'PENDING' ||
          (e.status === 'FAILED' &&
            e.lastErrorCode !== 'MATCH_VERSION_CONFLICT' &&
            e.retryCount < MAX_RETRIES),
      );

      for (const event of toProcess) {
        if (event.id == null) continue;

        // Respect creation order — skip ahead only if earlier FAILED conflict remains
        const blockers = queue.filter(
          (e) =>
            e.clientSequence < event.clientSequence &&
            (e.status === 'PENDING' ||
              e.status === 'SYNCING' ||
              (e.status === 'FAILED' && e.lastErrorCode === 'MATCH_VERSION_CONFLICT')),
        );
        if (blockers.length > 0) break;

        if (event.retryCount > 0) {
          await sleep(backoffMs(event.retryCount - 1));
        }

        await updateQueueEvent(event.id, {
          status: 'SYNCING',
          lastAttemptAt: new Date().toISOString(),
        });

        try {
          const expectedVersion = version > 0 ? version : event.baseExpectedVersion;
          const res = await submitEvent(matchId, event, expectedVersion);
          markApiReachable();
          version = res.matchVersion;
          await updateQueueEvent(event.id, {
            status: 'SYNCED',
            syncedAt: new Date().toISOString(),
            serverVersion: res.matchVersion,
            lastError: null,
            lastErrorCode: null,
          });
          synced += 1;
          useOfflineUiStore.getState().setLastFlash('synced');
          if (opts?.onAuthoritative) {
            await opts.onAuthoritative(res.matchVersion);
          }
        } catch (err) {
          if (isAuthFailure(err)) {
            markApiReachable();
            await updateQueueEvent(event.id, { status: 'PENDING' });
            useOfflineUiStore.getState().setAuthPaused(true);
            useOfflineUiStore.getState().setConnection('AUTH_REQUIRED');
            await refreshCounts(matchId);
            return { synced, failed, paused: 'AUTH', lastMatchVersion: version || null };
          }

          if (isConflictFailure(err)) {
            markApiReachable();
            const msg = err instanceof ApiError ? err.message : 'Version conflict';
            await updateQueueEvent(event.id, {
              status: 'FAILED',
              lastError: msg,
              lastErrorCode: 'MATCH_VERSION_CONFLICT',
              retryCount: event.retryCount + 1,
            });
            useOfflineUiStore.getState().setConflictPausedMatchId(matchId);
            useOfflineUiStore.getState().setConnection('SYNC_ERROR');
            useOfflineUiStore.getState().setLastFlash('failed');
            failed += 1;
            await refreshCounts(matchId);
            return { synced, failed, paused: 'CONFLICT', lastMatchVersion: version || null };
          }

          if (isNetworkFailure(err)) {
            markApiUnreachable();
            await updateQueueEvent(event.id, {
              status: 'PENDING',
              retryCount: event.retryCount + 1,
              lastError: err instanceof Error ? err.message : 'Network error',
              lastErrorCode: 'NETWORK_ERROR',
            });
            useOfflineUiStore.getState().setConnection('OFFLINE');
            await refreshCounts(matchId);
            return { synced, failed, paused: 'NETWORK', lastMatchVersion: version || null };
          }

          // Business error — mark FAILED, do not invent retries as network
          const code = err instanceof ApiError ? err.code : 'BUSINESS_ERROR';
          const msg = err instanceof ApiError ? err.message : 'Sync failed';
          const nextRetry = event.retryCount + 1;
          await updateQueueEvent(event.id, {
            status: nextRetry >= MAX_RETRIES ? 'FAILED' : 'FAILED',
            retryCount: nextRetry,
            lastError: msg,
            lastErrorCode: code,
          });
          failed += 1;
          useOfflineUiStore.getState().setLastFlash('failed');
          // Stop ordered sync — later events depend on this one
          break;
        }
      }

      await cleanupSynced();
      await refreshCounts(matchId);
      const counts = await countByStatus(matchId);
      if (counts.PENDING + counts.SYNCING + counts.FAILED === 0) {
        useOfflineUiStore.getState().setConnection('SYNCED');
        setTimeout(() => {
          const s = useOfflineUiStore.getState();
          if (s.connection === 'SYNCED') s.setConnection('ONLINE');
        }, 2000);
      } else if (counts.FAILED > 0) {
        useOfflineUiStore.getState().setConnection('SYNC_ERROR');
      } else if (counts.PENDING > 0) {
        useOfflineUiStore.getState().setConnection('ONLINE');
      } else {
        useOfflineUiStore.getState().setConnection('ONLINE');
      }

      return { synced, failed, lastMatchVersion: version || null };
    } finally {
      useOfflineUiStore.getState().setSyncingMatchId(null);
    }
  });
}

export async function refreshOfflineCounts(matchId: string): Promise<void> {
  await refreshCounts(matchId);
}

/** Persist latest server snapshot into offline match context. */
export async function persistServerSnapshot(
  matchId: string,
  match: Parameters<typeof saveMatchContext>[0]['match'],
  serverSnapshot: ScoringStateResponse,
): Promise<void> {
  const counts = await countByStatus(matchId);
  const pending = counts.PENDING + counts.SYNCING + counts.FAILED;
  await saveMatchContext({
    matchId,
    match,
    serverSnapshot,
    localPresentationHint: {
      totalRuns: serverSnapshot.presentation.totalRuns,
      wickets: serverSnapshot.presentation.wickets,
      legalBalls: serverSnapshot.presentation.legalBalls,
      oversDisplay: serverSnapshot.presentation.oversDisplay,
      pendingCount: pending,
      confidence: pending > 0 ? 'LOCAL_PENDING' : 'SERVER_CONFIRMED',
    },
  });
}
