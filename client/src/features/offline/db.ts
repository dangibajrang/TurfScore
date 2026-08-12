import Dexie, { type EntityTable } from 'dexie';
import type { DeviceMeta, OfflineMatchContext, QueuedScoringEvent } from './types';

export const OFFLINE_DB_NAME = 'turfscore-offline-v1';

export class TurfScoreOfflineDb extends Dexie {
  queue!: EntityTable<QueuedScoringEvent, 'id'>;
  matchContexts!: EntityTable<OfflineMatchContext, 'matchId'>;
  meta!: EntityTable<DeviceMeta, 'id'>;

  constructor() {
    super(OFFLINE_DB_NAME);
    this.version(1).stores({
      queue: '++id, eventId, matchId, [matchId+clientSequence], status, createdAt',
      matchContexts: 'matchId, updatedAt',
      meta: 'id',
    });
  }
}

let dbSingleton: TurfScoreOfflineDb | null = null;
let unavailable = false;

export function isOfflineDbUnavailable(): boolean {
  return unavailable;
}

export function getOfflineDb(): TurfScoreOfflineDb {
  if (unavailable) {
    throw new Error('IndexedDB unavailable');
  }
  if (!dbSingleton) {
    dbSingleton = new TurfScoreOfflineDb();
  }
  return dbSingleton;
}

/** Probe IndexedDB once; marks offline scoring unavailable if it fails. */
export async function ensureOfflineDb(): Promise<boolean> {
  if (unavailable) return false;
  if (typeof indexedDB === 'undefined') {
    unavailable = true;
    return false;
  }
  try {
    const db = getOfflineDb();
    await Promise.race([
      db.open(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('IndexedDB open timeout')), 5_000);
      }),
    ]);
    return true;
  } catch {
    unavailable = true;
    dbSingleton = null;
    return false;
  }
}

/** Test helper */
export async function resetOfflineDbForTests(): Promise<void> {
  if (dbSingleton) {
    dbSingleton.close();
    dbSingleton = null;
  }
  unavailable = false;
  await Dexie.delete(OFFLINE_DB_NAME);
}
