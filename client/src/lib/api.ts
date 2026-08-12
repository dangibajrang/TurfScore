/**
 * API base URL.
 * Empty string = same-origin / Vite proxy in development.
 * Never hardcode localhost in production builds — set VITE_API_URL at deploy time.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.replace(/\/$/, '');
  }
  return '';
}

export async function fetchHealth(): Promise<{
  status: string;
  service: string;
  environment: string;
  database: { status: string; readyState: number };
}> {
  const res = await fetch(`${getApiBaseUrl()}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return res.json() as Promise<{
    status: string;
    service: string;
    environment: string;
    database: { status: string; readyState: number };
  }>;
}
