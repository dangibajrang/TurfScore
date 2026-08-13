import type { ZodError } from 'zod';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'MATCH_VERSION_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'AUTH_REQUIRED'
  | 'INVALID_TOKEN'
  | 'INVALID_RESET_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'DUPLICATE_EMAIL'
  | 'RATE_LIMITED'
  | 'MATCH_NOT_LIVE'
  | 'INNINGS_COMPLETED'
  | 'MATCH_COMPLETED'
  | 'INVALID_DELIVERY'
  | 'INVALID_EXTRA'
  | 'INVALID_WICKET'
  | 'INVALID_BATTER'
  | 'INVALID_BOWLER'
  | 'BOWLER_LIMIT_REACHED'
  | 'CONSECUTIVE_OVERS'
  | 'INVALID_STRIKER'
  | 'INVALID_NON_STRIKER'
  | 'NEW_BATTER_REQUIRED'
  | 'NEW_BOWLER_REQUIRED'
  | 'DUPLICATE_EVENT'
  | 'NO_DELIVERY_TO_UNDO'
  | 'INVALID_INNINGS';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: ErrorCode;
      details?: unknown;
      isOperational?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function formatZodError(error: ZodError): unknown {
  return error.flatten();
}
