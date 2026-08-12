/** Client mirrors of Phase 5 authoritative types — display only, no cricket math. */

export type WicketType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'STUMPED'
  | 'RUN_OUT'
  | 'HIT_WICKET'
  | 'RETIRED_HURT'
  | 'OTHER';

export type ExtrasBreakdown = {
  wide: number;
  noBall: number;
  bye: number;
  legBye: number;
  penalty: number;
};

export type BatterState = {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  isRetiredHurt: boolean;
  wicketType?: WicketType;
  dismissalBowlerId?: string;
  dismissalFielderId?: string;
};

export type BowlerState = {
  playerId: string;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  currentOverRuns: number;
  currentOverLegalBalls: number;
};

export type PartnershipState = {
  batterAId: string;
  batterBId: string;
  runs: number;
  balls: number;
  isActive: boolean;
};

export type FallOfWicket = {
  wicketNumber: number;
  scoreAtWicket: number;
  legalBallsAtWicket: number;
  playerOutId: string;
  overDisplay: string;
};

export type InningsState = {
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  extras: ExtrasBreakdown;
  strikerId: string | null;
  nonStrikerId: string | null;
  currentBowlerId: string | null;
  ballsInCurrentOver: number;
  batters: Record<string, BatterState>;
  bowlers: Record<string, BowlerState>;
  fallOfWickets: FallOfWicket[];
  partnerships: PartnershipState[];
  isComplete: boolean;
  endReason?: 'OVERS' | 'ALL_OUT' | 'TARGET' | 'DECLARED';
  openingsSelected: boolean;
  bowlerSelected: boolean;
  pendingNewBatter: boolean;
  pendingNewBowler: boolean;
};

export type MatchResult = {
  winnerTeamId: string | null;
  resultType: 'WIN_BY_RUNS' | 'WIN_BY_WICKETS' | 'TIE' | 'NO_RESULT' | null;
  margin?: number;
  resultText: string | null;
};

export type MatchState = {
  matchId: string;
  status: 'LIVE' | 'COMPLETED' | 'ABANDONED' | 'CANCELLED';
  rules: {
    overs: number;
    ballsPerOver: number;
    playersPerSide: number;
    maxOversPerBowler?: number;
  };
  teamAId: string;
  teamBId: string;
  currentInningsIndex: number;
  innings: InningsState[];
  target: number | null;
  result: MatchResult | null;
  version: number;
};

export type LivePresentation = {
  battingTeamId: string;
  bowlingTeamId: string;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversDisplay: string;
  currentRunRate: number | null;
  target: number | null;
  requiredRuns: number | null;
  remainingBalls: number | null;
  requiredRunRate: number | null;
  openingsSelected: boolean;
  bowlerSelected: boolean;
  pendingNewBatter: boolean;
  pendingNewBowler: boolean;
  inningsComplete: boolean;
  matchComplete: boolean;
  strikerId: string | null;
  nonStrikerId: string | null;
  currentBowlerId: string | null;
  currentOverNumber: number;
  ballsInCurrentOver: number;
  inningsNumber: number;
};

export type ScorecardBatter = BatterState & {
  strikeRate: number;
  isStriker: boolean;
  isNonStriker: boolean;
};

export type ScorecardBowler = BowlerState & {
  oversDisplay: string;
  economy: number;
};

export type InningsScorecard = {
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversDisplay: string;
  extras: ExtrasBreakdown;
  extrasTotal: number;
  batting: ScorecardBatter[];
  bowling: ScorecardBowler[];
  fallOfWickets: FallOfWicket[];
  partnerships: PartnershipState[];
  isComplete: boolean;
  endReason?: InningsState['endReason'];
};

export type MatchScorecard = {
  matchId: string;
  status: MatchState['status'];
  target: number | null;
  result: MatchResult | null;
  currentInningsIndex: number;
  innings: InningsScorecard[];
};

export type DeliveryDto = {
  id: string;
  eventId: string;
  inningsNumber: number;
  overNumber: number;
  ballNumber: number;
  sequence: number;
  batterId: string;
  nonStrikerId: string;
  bowlerId: string;
  runs: { batterRuns: number; extrasRuns: number; totalRuns: number };
  extras: ExtrasBreakdown;
  wicket: {
    isWicket: boolean;
    wicketType?: WicketType;
    playerOutId?: string;
    fielderId?: string;
    runsCompleted?: number;
  };
  isLegalDelivery: boolean;
  isCorrection?: boolean;
};

export type DeliveryResult = {
  isLegalBall: boolean;
  overCompleted: boolean;
  inningsCompleted: boolean;
  matchCompleted: boolean;
  wicket: boolean;
  needsNewBatter: boolean;
  needsNewBowler: boolean;
  totalRuns: number;
  wickets: number;
  oversDisplay: string;
  target: number | null;
  requiredRuns: number | null;
  requiredRunRate: number | null;
  currentRunRate: number | null;
};

export type ScoringStateResponse = {
  matchVersion: number;
  status: string;
  state: MatchState;
  scorecard: MatchScorecard;
  presentation: LivePresentation;
  recentDeliveries: DeliveryDto[];
};

export type DeliveryCommandPayload = {
  eventId: string;
  expectedVersion: number;
  batterId: string;
  nonStrikerId: string;
  bowlerId: string;
  batterRuns?: number;
  extras?: Partial<ExtrasBreakdown>;
  wicket?: {
    wicketType: WicketType;
    playerOutId: string;
    fielderId?: string;
    runsCompleted?: number;
  } | null;
  nextBatterId?: string;
  commentary?: string;
};
