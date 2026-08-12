import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../models/User.js';
import { getUserById } from '../services/auth/authService.js';
import { verifyAccessToken } from '../services/auth/tokens.js';
import { AppError } from '../utils/errors.js';

export type AuthContext = {
  id: string;
  role: UserRole;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthContext;
};

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearer(req);
    if (!token) {
      throw new AppError('Authentication required', {
        statusCode: 401,
        code: 'AUTH_REQUIRED',
      });
    }

    const payload = verifyAccessToken(token);
    await getUserById(payload.sub);
    (req as AuthenticatedRequest).auth = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.auth) {
      next(
        new AppError('Authentication required', {
          statusCode: 401,
          code: 'AUTH_REQUIRED',
        }),
      );
      return;
    }

    if (!roles.includes(authReq.auth.role)) {
      next(
        new AppError('You do not have permission to perform this action', {
          statusCode: 403,
          code: 'FORBIDDEN',
        }),
      );
      return;
    }

    next();
  };
}
