/** Phase 8 offline queue — scoring commands only (no secrets). */

import type { DeliveryCommandPayload, ScoringStateResponse } from '@/features/scoring/types';
import type { MatchDto } from '@/features/matches/types';

export type QueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export type ConnectionUiState =
  | 'ONLINE'
  | 'OFFLINE'
  | 'SYNCING'
  | 'SYNCED'
  | 'SYNC_ERROR'
  | 'AUTH_REQUIRED';

export type OfflineCommandType =
  | 'DELIVERY'
  | 'UNDO'
  | 'SET_OPENINGS'
  | 'SELECT_BOWLER'
  | 'SELECT_BATTER'
  | 'START_INNINGS';

export type DeliveryCommandBody = Omit<DeliveryCommandPayload, 'eventId' | 'expectedVersion'>;

export type OfflineCommandPayload =
  | { type: 'DELIVERY'; body: DeliveryCommandBody }
  | { type: 'UNDO'; body: Record<string, never> }
  | { type: 'SET_OPENINGS'; body: { strikerId: string; nonStrikerId: string } }
  | { type: 'SELECT_BOWLER'; body: { bowlerId: string } }
  | { type: 'SELECT_BATTER'; body: { nextBatterId: string } }
  | {
      type: 'START_INNINGS';
      body: { strikerId: string; nonStrikerId: string; bowlerId: string };
    };

export type QueuedScoringEvent = {
  id?: number;
  eventId: string;
  matchId: string;
  clientSequence: number;
  commandType: OfflineCommandType;
  payload: OfflineCommandPayload;
  /** Server version known when the command was created (informational). */
  baseExpectedVersion: number;
  status: QueueStatus;
  createdAt: string;
  updatedAt: string;
  clientCreatedAt: string;
  retryCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  lastErrorCode: string | null;
  syncedAt: string | null;
  serverVersion: number | null;
  deviceId: string;
};

export type OfflineMatchContext = {
  matchId: string;
  updatedAt: string;
  deviceId: string;
  /** Last server-confirmed scoring snapshot. */
  serverSnapshot: ScoringStateResponse;
  match: MatchDto;
  /** Optimistic display overlay while pending commands exist. */
  localPresentationHint: {
    totalRuns: number;
    wickets: number;
    legalBalls: number;
    oversDisplay: string;
    pendingCount: number;
    confidence: 'SERVER_CONFIRMED' | 'LOCAL_PENDING';
  } | null;
};

export type DeviceMeta = {
  id: 'device';
  deviceId: string;
  createdAt: string;
};
