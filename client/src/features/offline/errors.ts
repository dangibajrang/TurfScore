export class OfflineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OfflineError';
    this.code = code;
  }
}

export const OFFLINE_UNAVAILABLE = 'OFFLINE_UNAVAILABLE';
export const QUEUE_LOCKED = 'QUEUE_LOCKED';
export const AUTH_PAUSED = 'AUTH_PAUSED';
export const CONFLICT_PAUSED = 'CONFLICT_PAUSED';
