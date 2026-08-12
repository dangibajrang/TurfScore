/**
 * Shared domain types (no cricket calculation logic).
 * Scoring engine (Phase 5) will own pure state transitions.
 */

export type MatchRules = {
  overs: number;
  ballsPerOver: number;
  playersPerSide: number;
  maxOversPerBowler?: number;
  powerplayEnabled?: boolean;
  powerplayOvers?: number;
  superOverEnabled?: boolean;
  customRules?: Record<string, unknown>;
};

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

/** Offline queue shape (client Phase 8) — documented for cross-stack alignment */
export type OfflineScoringEvent = {
  eventId: string;
  matchId: string;
  sequenceNumber: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  syncStatus: SyncStatus;
};
