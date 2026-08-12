import { getApiBaseUrl } from './api';

/** Resolve stored media paths (`/uploads/...`) or absolute URLs for <img src>. */
export function resolveMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  if (src.startsWith('/')) {
    return `${getApiBaseUrl()}${src}`;
  }
  return src;
}
