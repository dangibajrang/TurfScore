export type MatchStatus =
  | 'DRAFT'
  | 'UPCOMING'
  | 'LIVE'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'CANCELLED';

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

export type PlayingXiEntry = {
  playerId: string;
  role?: 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
  battingOrder: number;
  isWicketKeeper?: boolean;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
};

export type MatchTeamSide = {
  teamId: string;
  teamName: string | null;
  teamShortName: string | null;
  playingXi: Array<{
    playerId: string;
    playerName: string | null;
    role: string | null;
    battingOrder: number;
    isWicketKeeper: boolean;
    isCaptain: boolean;
    isViceCaptain: boolean;
  }>;
};

export type MatchDto = {
  id: string;
  name: string;
  description: string | null;
  status: MatchStatus;
  venue: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  teamA: MatchTeamSide;
  teamB: MatchTeamSide;
  rules: MatchRules;
  toss: { wonByTeamId: string; decision: 'BAT' | 'BOWL' } | null;
  firstInnings: { battingTeamId: string; bowlingTeamId: string } | null;
  innings: unknown[];
  version: number;
  publicMatchId?: string | null;
  publicLiveEnabled?: boolean;
  resultText: string | null;
  scoreSummary?: {
    teamA: { runs: number; wickets: number; overs: string } | null;
    teamB: { runs: number; wickets: number; overs: string } | null;
  } | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
};

export type CreateMatchPayload = {
  name: string;
  description?: string;
  venue: string;
  scheduledAt?: string;
  teamA: { teamId: string; playingXi?: PlayingXiEntry[] };
  teamB: { teamId: string; playingXi?: PlayingXiEntry[] };
  rules: MatchRules;
  toss?: { wonByTeamId: string; decision: 'BAT' | 'BOWL' };
  status?: 'DRAFT' | 'UPCOMING';
  startNow?: boolean;
};

export type WizardState = {
  name: string;
  description: string;
  venue: string;
  date: string;
  time: string;
  teamAId: string;
  teamBId: string;
  rules: MatchRules;
  teamAXi: PlayingXiEntry[];
  teamBXi: PlayingXiEntry[];
  tossWinnerId: string;
  tossDecision: 'BAT' | 'BOWL' | '';
};
