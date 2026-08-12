import { describe, expect, it } from 'vitest';
import { AppError } from './errors.js';

describe('AppError', () => {
  it('creates an operational error with defaults', () => {
    const err = new AppError('boom');
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
  });

  it('supports MATCH_VERSION_CONFLICT code for future scoring concurrency', () => {
    const err = new AppError('Stale match version', {
      statusCode: 409,
      code: 'MATCH_VERSION_CONFLICT',
    });
    expect(err.code).toBe('MATCH_VERSION_CONFLICT');
    expect(err.statusCode).toBe(409);
  });
});
