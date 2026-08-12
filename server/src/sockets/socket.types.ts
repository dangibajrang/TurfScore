import type { LivePresentation, MatchScorecard } from '../services/cricket/scorecard.js';
import type { MatchState } from '../services/cricket/types.js';

export type SocketRole = 'scorer' | 'viewer';

export type MatchJoinPayload = {
  matchId?: string;
  publicMatchId?: string;
};

export type PublicLiveStateSlice = {
  score: number;
  wickets: number;
  overs: string;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  currentOverNumber: number;
  ballsInCurrentOver: number;
  target: number | null;
  requiredRuns: number | null;
  remainingBalls: number | null;
  currentRunRate: number | null;
  requiredRunRate: number | null;
  inningsNumber: number;
  inningsComplete: boolean;
  matchComplete: boolean;
  status: MatchState['status'];
};

export type MatchRealtimePayload = {
  matchId: string;
  publicMatchId: string | null;
  eventId?: string;
  version: number;
  event: string;
  state: PublicLiveStateSlice;
  presentation: LivePresentation;
  scorecard?: MatchScorecard;
  delivery?: unknown;
  result?: {
    isLegalBall?: boolean;
    overCompleted?: boolean;
    inningsCompleted?: boolean;
    matchCompleted?: boolean;
    wicket?: boolean;
    needsNewBatter?: boolean;
    needsNewBowler?: boolean;
  };
  resultText?: string | null;
  timestamp: string;
  viewerCount?: number;
};

export function toPublicLiveState(
  state: MatchState,
  presentation: LivePresentation,
): PublicLiveStateSlice {
  return {
    score: presentation.totalRuns,
    wickets: presentation.wickets,
    overs: presentation.oversDisplay,
    strikerId: presentation.strikerId,
    nonStrikerId: presentation.nonStrikerId,
    bowlerId: presentation.currentBowlerId,
    currentOverNumber: presentation.currentOverNumber,
    ballsInCurrentOver: presentation.ballsInCurrentOver,
    target: presentation.target,
    requiredRuns: presentation.requiredRuns,
    remainingBalls: presentation.remainingBalls,
    currentRunRate: presentation.currentRunRate,
    requiredRunRate: presentation.requiredRunRate,
    inningsNumber: presentation.inningsNumber,
    inningsComplete: presentation.inningsComplete,
    matchComplete: presentation.matchComplete,
    status: state.status,
  };
}
