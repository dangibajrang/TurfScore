import { apiRequest } from '@/lib/apiClient';
import type { LivePresentation, MatchScorecard } from '@/features/scoring/types';
import type { MatchTeamSide } from '@/features/matches/types';

export type LiveSharingInfo = {
  publicMatchId: string | null;
  publicLiveEnabled: boolean;
  publicUrl: string | null;
  publicPath: string | null;
};

export type PublicMatchSnapshot = {
  live: boolean;
  publicMatchId: string;
  matchId: string;
  name: string;
  status: string;
  venue: string | null;
  version: number;
  lastUpdatedAt: string;
  resultText: string | null;
  rules: { overs: number; ballsPerOver: number; playersPerSide: number };
  teamA: MatchTeamSide;
  teamB: MatchTeamSide;
  state: import('@/features/scoring/types').MatchState;
  presentation: LivePresentation;
  scorecard: MatchScorecard;
  recentDeliveries: import('@/features/scoring/types').DeliveryDto[];
};

export const liveSharingApi = {
  get(matchId: string) {
    return apiRequest<LiveSharingInfo>(`/api/matches/${matchId}/live-sharing`, {
      method: 'GET',
      auth: true,
    });
  },
  enable(matchId: string) {
    return apiRequest<LiveSharingInfo>(`/api/matches/${matchId}/live-sharing/enable`, {
      method: 'POST',
      body: {},
      auth: true,
    });
  },
  disable(matchId: string) {
    return apiRequest<LiveSharingInfo>(`/api/matches/${matchId}/live-sharing/disable`, {
      method: 'POST',
      body: {},
      auth: true,
    });
  },
};

export const publicMatchApi = {
  get(publicMatchId: string) {
    return apiRequest<PublicMatchSnapshot>(`/api/public/matches/${publicMatchId}`, {
      method: 'GET',
    });
  },
  scorecard(publicMatchId: string) {
    return apiRequest<{
      publicMatchId: string;
      matchId: string;
      name: string;
      status: string;
      resultText: string | null;
      teamA: MatchTeamSide;
      teamB: MatchTeamSide;
      scorecard: MatchScorecard;
      version: number;
      lastUpdatedAt: string;
    }>(`/api/public/matches/${publicMatchId}/scorecard`, { method: 'GET' });
  },
};
