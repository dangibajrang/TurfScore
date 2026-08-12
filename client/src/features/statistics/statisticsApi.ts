import { apiRequest } from '@/lib/apiClient';

export type ScoreSide = { runs: number; wickets: number; overs: string } | null;

export type StatsRange = 'ALL_TIME' | 'THIS_MONTH' | 'THIS_YEAR';

export type BatterLeader = {
  playerId: string;
  name: string;
  profileImageUrl: string | null;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  innings: number;
  notOuts?: number;
  fifties?: number;
  hundreds?: number;
  highestScore?: number;
  highestScoreDisplay?: string;
  average: number | null;
  strikeRate: number;
};

export type BowlerLeader = {
  playerId: string;
  name: string;
  profileImageUrl: string | null;
  wickets: number;
  runsConceded: number;
  overs: string;
  maidens: number;
  innings: number;
  fourWickets?: number;
  fiveWickets?: number;
  bestBowling?: string | null;
  average?: number | null;
  strikeRate?: number | null;
  economy: number;
};

export type StatisticsSummary = {
  source: 'match_snapshots';
  range?: StatsRange;
  note: string;
  metrics: {
    completedMatches: number;
    liveMatches: number;
    teams: number;
    players: number;
    wins?: number;
    matchesSampled: number;
  };
  topBatters: BatterLeader[];
  topBowlers: BowlerLeader[];
  bestStrikeRate?: BatterLeader[];
  bestEconomy?: BowlerLeader[];
  teamRecords: Array<{
    teamId: string;
    name: string;
    shortName: string | null;
    played: number;
    won: number;
    lost: number;
    ties?: number;
    winPct: number;
  }>;
  recentResults: Array<{
    id: string;
    name: string;
    resultText: string | null;
    completedAt: string | null;
    scoreSummary?: { teamA: ScoreSide; teamB: ScoreSide } | null;
    teamA: { id: string; name: string; shortName: string | null };
    teamB: { id: string; name: string; shortName: string | null };
  }>;
};

export type PlayerStatistics = {
  source: 'match_snapshots';
  range?: StatsRange;
  playerId: string;
  name: string;
  profileImageUrl: string | null;
  role?: string;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  matchesPlayed: number;
  batting: BatterLeader | null;
  bowling: BowlerLeader | null;
  recentForm?: Array<{
    matchId: string;
    matchName: string;
    completedAt: string | null;
    resultText: string | null;
    runs: number;
    balls: number;
    wickets: number;
    battingDisplay: string | null;
  }>;
};

export type PlayerMatchHistory = {
  items: Array<{
    matchId: string;
    matchName: string;
    date: string | null;
    venue: string | null;
    teamId: string | null;
    teamName: string | null;
    runs: number;
    balls: number;
    wickets: number;
    resultText: string | null;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TeamStatistics = {
  source: 'match_snapshots';
  teamId: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  statistics: {
    matches: number;
    wins: number;
    losses: number;
    ties: number;
    noResults: number;
    winPct: number;
    totalRuns: number;
    averageScore: number;
    highestScore: number;
    wickets: number;
    averageRunsConceded: number;
  };
  recentMatches: Array<{
    id: string;
    name: string;
    resultText: string | null;
    completedAt: string | null;
    opponent: { id: string; name: string };
  }>;
};

export const statisticsApi = {
  summary(range: StatsRange = 'ALL_TIME') {
    const q = new URLSearchParams({ range });
    return apiRequest<StatisticsSummary>(`/api/statistics/summary?${q}`, {
      method: 'GET',
      auth: true,
    });
  },
  player(playerId: string, range: StatsRange = 'ALL_TIME') {
    const q = new URLSearchParams({ range });
    return apiRequest<PlayerStatistics>(`/api/statistics/players/${playerId}?${q}`, {
      method: 'GET',
      auth: true,
    });
  },
  playerMatches(playerId: string, params?: { page?: number; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiRequest<PlayerMatchHistory>(
      `/api/statistics/players/${playerId}/matches${qs ? `?${qs}` : ''}`,
      { method: 'GET', auth: true },
    );
  },
  team(teamId: string, range: StatsRange = 'ALL_TIME') {
    const q = new URLSearchParams({ range });
    return apiRequest<TeamStatistics>(`/api/statistics/teams/${teamId}?${q}`, {
      method: 'GET',
      auth: true,
    });
  },
};
