import { getApiBaseUrl } from './api';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
};

function encodeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body;
  return JSON.stringify(body);
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function tryRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = (await res.json()) as { accessToken?: string };
      const token = data.accessToken ?? null;
      setAccessToken(token);
      return token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = false, skipRefresh = false, headers, ...rest } = options;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const buildHeaders = (): HeadersInit => {
    const h = new Headers(headers);
    if (!isFormData && !h.has('Content-Type') && body !== undefined) {
      h.set('Content-Type', 'application/json');
    }
    if (auth && accessToken) {
      h.set('Authorization', `Bearer ${accessToken}`);
    }
    return h;
  };

  let res = await fetch(url, {
    ...rest,
    credentials: 'include',
    headers: buildHeaders(),
    body: encodeBody(body),
  });

  if (res.status === 401 && auth && !skipRefresh) {
    const newToken = await tryRefresh();
    if (newToken) {
      res = await fetch(url, {
        ...rest,
        credentials: 'include',
        headers: buildHeaders(),
        body: encodeBody(body),
      });
    }
  }

  const data = await parseJson(res);

  if (!res.ok) {
    const err = data as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      err?.error?.code ?? 'INTERNAL_ERROR',
      err?.error?.message ?? 'Request failed',
      err?.error?.details,
    );
  }

  return data as T;
}

export { tryRefresh };
