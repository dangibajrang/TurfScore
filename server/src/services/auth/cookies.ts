import type { CookieOptions, Response } from 'express';
import { loadEnv } from '../../config/env.js';
import { durationToMs } from './tokens.js';

export const REFRESH_COOKIE_NAME = 'ts_refresh';

export function getRefreshCookieOptions(): CookieOptions {
  const env = loadEnv();
  const maxAge = durationToMs(env.JWT_REFRESH_EXPIRES_IN);

  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth',
    maxAge,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  const opts = getRefreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
  });
}
