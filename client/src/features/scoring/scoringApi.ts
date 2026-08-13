import { apiRequest } from '@/lib/apiClient';
import type {
  DeliveryCommandPayload,
  DeliveryDto,
  MatchScorecard,
  MatchState,
  ScoringStateResponse,
} from './types';

export const scoringApi = {
  getState(matchId: string) {
    return apiRequest<ScoringStateResponse>(`/api/matches/${matchId}/scoring`, {
      method: 'GET',
      auth: true,
    });
  },

  getScorecard(matchId: string) {
    return apiRequest<MatchScorecard>(`/api/matches/${matchId}/scorecard`, {
      method: 'GET',
      auth: true,
    });
  },

  listDeliveries(matchId: string, limit = 12) {
    return apiRequest<{ items: DeliveryDto[] }>(
      `/api/matches/${matchId}/deliveries?limit=${limit}`,
      { method: 'GET', auth: true },
    );
  },

  recordDelivery(matchId: string, body: DeliveryCommandPayload) {
    return apiRequest<{
      duplicate: boolean;
      matchVersion: number;
      delivery: DeliveryDto | null;
      state: MatchState;
      result: import('./types').DeliveryResult | null;
      scorecard: MatchScorecard;
      presentation?: import('./types').LivePresentation;
    }>(`/api/matches/${matchId}/deliveries`, {
      method: 'POST',
      body,
      auth: true,
    });
  },

  undo(matchId: string, expectedVersion: number) {
    return apiRequest<{
      matchVersion: number;
      undoneEventId: string;
      state: MatchState;
      scorecard: MatchScorecard;
      presentation: import('./types').LivePresentation;
      recentDeliveries: DeliveryDto[];
    }>(`/api/matches/${matchId}/undo`, {
      method: 'POST',
      body: { expectedVersion },
      auth: true,
    });
  },

  editDelivery(
    matchId: string,
    deliveryId: string,
    body: Omit<DeliveryCommandPayload, 'eventId'> & { reason?: string },
  ) {
    return apiRequest<{
      matchVersion: number;
      delivery: DeliveryDto;
      state: MatchState;
      scorecard: MatchScorecard;
    }>(`/api/matches/${matchId}/deliveries/${deliveryId}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  },

  setOpenings(
    matchId: string,
    body: { expectedVersion: number; strikerId: string; nonStrikerId: string },
  ) {
    return apiRequest<{ matchVersion: number; state: MatchState }>(
      `/api/matches/${matchId}/openings`,
      { method: 'POST', body, auth: true },
    );
  },

  selectBowler(matchId: string, body: { expectedVersion: number; bowlerId: string }) {
    return apiRequest<{ matchVersion: number; state: MatchState }>(
      `/api/matches/${matchId}/bowler`,
      { method: 'POST', body, auth: true },
    );
  },

  selectBatter(matchId: string, body: { expectedVersion: number; nextBatterId: string }) {
    return apiRequest<{ matchVersion: number; state: MatchState }>(
      `/api/matches/${matchId}/batter`,
      { method: 'POST', body, auth: true },
    );
  },

  startInnings(
    matchId: string,
    body: {
      expectedVersion: number;
      strikerId: string;
      nonStrikerId: string;
      bowlerId: string;
    },
  ) {
    return apiRequest<{ matchVersion: number; state: MatchState }>(
      `/api/matches/${matchId}/innings/start`,
      { method: 'POST', body, auth: true },
    );
  },
};
