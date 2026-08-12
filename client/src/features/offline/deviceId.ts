import { ensureOfflineDb, getOfflineDb } from './db';
import { createEventId } from '@/features/scoring/eventId';

const DEVICE_KEY = 'device';

export async function getOrCreateDeviceId(): Promise<string> {
  const ok = await ensureOfflineDb();
  if (!ok) {
    return createEventId('dev');
  }
  const db = getOfflineDb();
  const existing = await db.meta.get(DEVICE_KEY);
  if (existing?.deviceId) return existing.deviceId;

  const deviceId = createEventId('dev');
  await db.meta.put({
    id: DEVICE_KEY,
    deviceId,
    createdAt: new Date().toISOString(),
  });
  return deviceId;
}
