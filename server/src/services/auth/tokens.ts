import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../../config/env.js';
import type { UserRole } from '../../models/User.js';
import { AppError } from '../../utils/errors.js';

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  typ: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  typ: 'refresh';
};

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function signAccessToken(userId: string, role: UserRole): string {
  const env = loadEnv();
  return jwt.sign({ sub: userId, role, typ: 'access' } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string, sessionId: string): string {
  const env = loadEnv();
  return jwt.sign(
    { sub: userId, sid: sessionId, typ: 'refresh' } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const env = loadEnv();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (payload.typ !== 'access' || !payload.sub || !payload.role) {
      throw new AppError('Invalid access token', {
        statusCode: 401,
        code: 'INVALID_TOKEN',
      });
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Access token expired', {
        statusCode: 401,
        code: 'TOKEN_EXPIRED',
      });
    }
    throw new AppError('Invalid access token', {
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const env = loadEnv();
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (payload.typ !== 'refresh' || !payload.sub || !payload.sid) {
      throw new AppError('Invalid refresh token', {
        statusCode: 401,
        code: 'INVALID_TOKEN',
      });
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Refresh token expired', {
        statusCode: 401,
        code: 'TOKEN_EXPIRED',
      });
    }
    throw new AppError('Invalid refresh token', {
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  }
}

/** Parse durations like 15m / 7d into milliseconds for cookies */
export function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/i.exec(duration.trim());
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * (multipliers[unit] ?? 86_400_000);
}
