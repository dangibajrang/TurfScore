const locks = new Map<string, Promise<void>>();

/** Ensure only one sync worker runs per matchId at a time. */
export async function withMatchSyncLock<T>(matchId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(matchId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = prev.then(() => gate);
  locks.set(
    matchId,
    chain.then(
      () => undefined,
      () => undefined,
    ),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(matchId) === chain) {
      // keep chain until next waiter attaches
    }
  }
}
