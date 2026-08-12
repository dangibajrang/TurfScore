export const SocketEvents = {
  MATCH_JOIN: 'MATCH_JOIN',
  MATCH_LEAVE: 'MATCH_LEAVE',
  MATCH_JOINED: 'MATCH_JOINED',
  MATCH_STARTED: 'MATCH_STARTED',
  DELIVERY_RECORDED: 'DELIVERY_RECORDED',
  DELIVERY_UPDATED: 'DELIVERY_UPDATED',
  DELIVERY_UNDONE: 'DELIVERY_UNDONE',
  WICKET_RECORDED: 'WICKET_RECORDED',
  OVER_COMPLETED: 'OVER_COMPLETED',
  INNINGS_COMPLETED: 'INNINGS_COMPLETED',
  INNINGS_STARTED: 'INNINGS_STARTED',
  MATCH_COMPLETED: 'MATCH_COMPLETED',
  MATCH_STATE_UPDATED: 'MATCH_STATE_UPDATED',
  LIVE_SHARING_DISABLED: 'LIVE_SHARING_DISABLED',
  VIEWER_COUNT: 'VIEWER_COUNT',
  ERROR: 'SOCKET_ERROR',
} as const;

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type MatchRealtimePayload = {
  matchId: string;
  publicMatchId: string | null;
  eventId?: string;
  version: number;
  event: string;
  state: {
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
    status: string;
  };
  presentation: import('@/features/scoring/types').LivePresentation;
  scorecard?: import('@/features/scoring/types').MatchScorecard;
  delivery?: unknown;
  result?: {
    isLegalBall?: boolean;
    overCompleted?: boolean;
    inningsCompleted?: boolean;
    matchCompleted?: boolean;
    wicket?: boolean;
  };
  resultText?: string | null;
  timestamp: string;
  viewerCount?: number;
};
