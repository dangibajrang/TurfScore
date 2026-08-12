import { getApiBaseUrl } from '@/lib/api';

export type Reachability = {
  browserOnline: boolean;
  apiReachable: boolean | null;
  checkedAt: number;
};

let lastProbe: Reachability = {
  browserOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  apiReachable: null,
  checkedAt: 0,
};

const PROBE_TTL_MS = 8_000;

export function getCachedReachability(): Reachability {
  return lastProbe;
}

export function isProbablyOnline(): boolean {
  const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (!browserOnline) return false;
  if (lastProbe.apiReachable === false && Date.now() - lastProbe.checkedAt < PROBE_TTL_MS) {
    return false;
  }
  return true;
}

export async function probeApiHealth(force = false): Promise<Reachability> {
  const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (!force && Date.now() - lastProbe.checkedAt < PROBE_TTL_MS) {
    return { ...lastProbe, browserOnline };
  }

  if (!browserOnline) {
    lastProbe = { browserOnline: false, apiReachable: false, checkedAt: Date.now() };
    return lastProbe;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4_000);
    const res = await fetch(`${getApiBaseUrl()}/api/health`, {
      method: 'GET',
      signal: ctrl.signal,
      credentials: 'omit',
    });
    clearTimeout(t);
    lastProbe = {
      browserOnline: true,
      apiReachable: res.ok,
      checkedAt: Date.now(),
    };
  } catch {
    lastProbe = {
      browserOnline: true,
      apiReachable: false,
      checkedAt: Date.now(),
    };
  }
  return lastProbe;
}

export function markApiUnreachable(): void {
  lastProbe = {
    browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    apiReachable: false,
    checkedAt: Date.now(),
  };
}

export function markApiReachable(): void {
  lastProbe = {
    browserOnline: true,
    apiReachable: true,
    checkedAt: Date.now(),
  };
}

/** Network / transport failures — safe to queue. Business 4xx are not. */
export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('abort')) {
      return true;
    }
  }
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number' && status >= 500) return true;
  return false;
}

export function isAuthFailure(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const code = (err as { code?: string })?.code;
  return status === 401 || code === 'AUTH_REQUIRED' || code === 'UNAUTHORIZED';
}

export function isConflictFailure(err: unknown): boolean {
  return (err as { code?: string })?.code === 'MATCH_VERSION_CONFLICT';
}
