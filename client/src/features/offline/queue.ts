import { ensureOfflineDb, getOfflineDb } from './db';
import { getOrCreateDeviceId } from './deviceId';
import { OfflineError, OFFLINE_UNAVAILABLE } from './errors';
import type {
  OfflineCommandPayload,
  OfflineMatchContext,
  QueueStatus,
  QueuedScoringEvent,
} from './types';
import type { MatchDto } from '@/features/matches/types';
import type { ScoringStateResponse } from '@/features/scoring/types';

function nowIso() {
  return new Date().toISOString();
}

export async function nextClientSequence(matchId: string): Promise<number> {
  const db = getOfflineDb();
  // sortBy always ascends; reverse() does not affect sortBy — take the last row.
  const rows = await db.queue.where('matchId').equals(matchId).sortBy('clientSequence');
  const top = rows[rows.length - 1];
  return (top?.clientSequence ?? 1000) + 1;
}

export async function enqueueCommand(input: {
  matchId: string;
  eventId: string;
  payload: OfflineCommandPayload;
  baseExpectedVersion: number;
}): Promise<QueuedScoringEvent> {
  const ok = await ensureOfflineDb();
  if (!ok) throw new OfflineError(OFFLINE_UNAVAILABLE, 'Offline scoring is unavailable on this browser.');

  const db = getOfflineDb();
  const deviceId = await getOrCreateDeviceId();
  const ts = nowIso();

  // Allocate sequence + insert atomically to avoid races when offline taps are rapid.
  const row = await db.transaction('rw', db.queue, async () => {
    const rows = await db.queue.where('matchId').equals(input.matchId).sortBy('clientSequence');
    const top = rows[rows.length - 1];
    const clientSequence = (top?.clientSequence ?? 1000) + 1;
    const event: QueuedScoringEvent = {
      eventId: input.eventId,
      matchId: input.matchId,
      clientSequence,
      commandType: input.payload.type,
      payload: input.payload,
      baseExpectedVersion: input.baseExpectedVersion,
      status: 'PENDING',
      createdAt: ts,
      updatedAt: ts,
      clientCreatedAt: ts,
      retryCount: 0,
      lastAttemptAt: null,
      lastError: null,
      lastErrorCode: null,
      syncedAt: null,
      serverVersion: null,
      deviceId,
    };
    const id = await db.queue.add(event);
    return { ...event, id };
  });

  return row;
}

export async function listPendingOrdered(matchId: string): Promise<QueuedScoringEvent[]> {
  const ok = await ensureOfflineDb();
  if (!ok) return [];
  const db = getOfflineDb();
  const rows = await db.queue.where('matchId').equals(matchId).sortBy('clientSequence');
  return rows.filter((r) => r.status === 'PENDING' || r.status === 'SYNCING' || r.status === 'FAILED');
}

export async function listActiveQueue(matchId: string): Promise<QueuedScoringEvent[]> {
  const ok = await ensureOfflineDb();
  if (!ok) return [];
  const db = getOfflineDb();
  const rows = await db.queue.where('matchId').equals(matchId).sortBy('clientSequence');
  return rows.filter((r) => r.status !== 'SYNCED');
}

export async function countByStatus(
  matchId: string,
): Promise<Record<QueueStatus, number>> {
  const rows = await listActiveQueue(matchId);
  const counts: Record<QueueStatus, number> = {
    PENDING: 0,
    SYNCING: 0,
    SYNCED: 0,
    FAILED: 0,
  };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

export async function updateQueueEvent(
  id: number,
  patch: Partial<QueuedScoringEvent>,
): Promise<void> {
  const db = getOfflineDb();
  await db.queue.update(id, { ...patch, updatedAt: nowIso() });
}

export async function getEventByEventId(eventId: string): Promise<QueuedScoringEvent | undefined> {
  const ok = await ensureOfflineDb();
  if (!ok) return undefined;
  return getOfflineDb().queue.where('eventId').equals(eventId).first();
}

export async function saveMatchContext(input: {
  matchId: string;
  match: MatchDto;
  serverSnapshot: ScoringStateResponse;
  localPresentationHint?: OfflineMatchContext['localPresentationHint'];
}): Promise<void> {
  const ok = await ensureOfflineDb();
  if (!ok) return;
  const deviceId = await getOrCreateDeviceId();
  const db = getOfflineDb();
  await db.matchContexts.put({
    matchId: input.matchId,
    updatedAt: nowIso(),
    deviceId,
    match: input.match,
    serverSnapshot: input.serverSnapshot,
    localPresentationHint: input.localPresentationHint ?? null,
  });
}

export async function getMatchContext(matchId: string): Promise<OfflineMatchContext | undefined> {
  const ok = await ensureOfflineDb();
  if (!ok) return undefined;
  return getOfflineDb().matchContexts.get(matchId);
}

export async function listResumeCandidates(): Promise<OfflineMatchContext[]> {
  const ok = await ensureOfflineDb();
  if (!ok) return [];
  const db = getOfflineDb();
  const contexts = await db.matchContexts.toArray();
  const withPending: OfflineMatchContext[] = [];
  for (const ctx of contexts) {
    const counts = await countByStatus(ctx.matchId);
    if (counts.PENDING + counts.SYNCING + counts.FAILED > 0) {
      withPending.push(ctx);
    }
  }
  return withPending.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Keep SYNCED rows for a short retention window, then prune. */
export async function cleanupSynced(retentionMs = 1000 * 60 * 60 * 24): Promise<number> {
  const ok = await ensureOfflineDb();
  if (!ok) return 0;
  const db = getOfflineDb();
  const cutoff = Date.now() - retentionMs;
  const synced = await db.queue.where('status').equals('SYNCED').toArray();
  let removed = 0;
  for (const row of synced) {
    const t = row.syncedAt ? Date.parse(row.syncedAt) : Date.parse(row.updatedAt);
    if (Number.isFinite(t) && t < cutoff && row.id != null) {
      await db.queue.delete(row.id);
      removed += 1;
    }
  }
  return removed;
}

export async function resetFailedToPending(matchId: string, onlyNetwork = true): Promise<number> {
  const rows = await listActiveQueue(matchId);
  let n = 0;
  for (const row of rows) {
    if (row.status !== 'FAILED' || row.id == null) continue;
    if (onlyNetwork && row.lastErrorCode === 'MATCH_VERSION_CONFLICT') continue;
    await updateQueueEvent(row.id, {
      status: 'PENDING',
      lastError: null,
      lastErrorCode: null,
    });
    n += 1;
  }
  return n;
}
