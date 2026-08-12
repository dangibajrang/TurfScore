import { apiRequest } from '@/lib/apiClient';

export type ScoreSide = { runs: number; wickets: number; overs: string } | null;

export type DashboardMatch = {
  id: string;
  name: string;
  status: string;
  venue: string | null;
  scheduledAt: string | null;
  completedAt?: string | null;
  teamA: { id: string; name: string; shortName: string | null };
  teamB: { id: string; name: string; shortName: string | null };
  resultText: string | null;
  scoreSummary?: { teamA: ScoreSide; teamB: ScoreSide } | null;
  isDevelopmentFixture?: boolean;
  displayNote?: string | null;
};

export type DashboardSummary = {
  metrics: {
    liveMatches: number;
    upcomingMatches: number;
    completedMatches: number;
    wins: number;
    teams: number;
    players: number;
  };
  liveMatches: DashboardMatch[];
  upcomingMatches: DashboardMatch[];
  recentMatches: DashboardMatch[];
  recentForm: Array<{ matchId: string; outcome: string; label: string }>;
  topPerformers: {
    topRunScorer: { playerId: string; name: string; value: number; label: string } | null;
    topWicketTaker: { playerId: string; name: string; value: number; label: string } | null;
    bestStrikeRate: { playerId: string; name: string; value: number; label: string } | null;
    bestEconomy: { playerId: string; name: string; value: number; label: string } | null;
  };
  featuredPlayers: Array<{
    id: string;
    name: string;
    role: string;
    battingStyle: string | null;
    bowlingStyle: string | null;
    profileImageUrl: string | null;
  }>;
  recentTeams: Array<{
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    playerCount: number;
  }>;
  calendarHighlights: Array<{
    date: string;
    matchId: string;
    label: string;
    status?: string;
  }>;
};

export const dashboardApi = {
  summary() {
    return apiRequest<DashboardSummary>('/api/dashboard/summary', {
      method: 'GET',
      auth: true,
    });
  },
};
