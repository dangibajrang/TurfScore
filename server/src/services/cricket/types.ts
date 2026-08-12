/**
 * Pure cricket domain types — no Mongoose / Express / React.
 */

export type WicketType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'STUMPED'
  | 'RUN_OUT'
  | 'HIT_WICKET'
  | 'RETIRED_HURT'
  | 'OTHER';

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
  /** Runs conceded in the current unfinished over (for maiden detection) */
  currentOverRuns: number;
  /** Legal balls in the current unfinished over */
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
  /** Legal balls bowled in the current over (0 .. ballsPerOver-1 until complete) */
  ballsInCurrentOver: number;
  batters: Record<string, BatterState>;
  bowlers: Record<string, BowlerState>;
  fallOfWickets: FallOfWicket[];
  partnerships: PartnershipState[];
  isComplete: boolean;
  /** Declared / all out / overs / target */
  endReason?: 'OVERS' | 'ALL_OUT' | 'TARGET' | 'DECLARED';
  /** Opening pair selected */
  openingsSelected: boolean;
  /** Current bowler assigned for this over */
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
  rules: MatchRules;
  teamAId: string;
  teamBId: string;
  currentInningsIndex: number;
  innings: InningsState[];
  target: number | null;
  result: MatchResult | null;
  version: number;
};

export type DeliveryExtrasInput = {
  wide?: number;
  noBall?: number;
  bye?: number;
  legBye?: number;
  penalty?: number;
};

export type WicketEventInput = {
  wicketType: WicketType;
  playerOutId: string;
  fielderId?: string;
  /** Runs completed before dismissal (e.g. run-out after 1) */
  runsCompleted?: number;
};

export type DeliveryCommand = {
  eventId: string;
  batterId: string;
  nonStrikerId: string;
  bowlerId: string;
  /** Off the bat (boundaries, etc.) */
  batterRuns: number;
  extras?: DeliveryExtrasInput;
  wicket?: WicketEventInput | null;
  /** Required after a dismissal that needs a replacement */
  nextBatterId?: string;
};

export type DeliveryApplied = {
  eventId: string;
  inningsNumber: number;
  sequence: number;
  overNumber: number;
  ballNumber: number;
  batterId: string;
  nonStrikerId: string;
  bowlerId: string;
  batterRuns: number;
  extrasRuns: number;
  totalRuns: number;
  extras: ExtrasBreakdown;
  isLegalBall: boolean;
  wicket: {
    isWicket: boolean;
    wicketType?: WicketType;
    playerOutId?: string;
    fielderId?: string;
    runsCompleted?: number;
  };
};

export type DeliveryResult = {
  delivery: DeliveryApplied;
  isLegalBall: boolean;
  overCompleted: boolean;
  inningsCompleted: boolean;
  matchCompleted: boolean;
  wicket: boolean;
  needsNewBatter: boolean;
  needsNewBowler: boolean;
  strikerId: string | null;
  nonStrikerId: string | null;
  currentBowlerId: string | null;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversDisplay: string;
  target: number | null;
  requiredRuns: number | null;
  requiredRunRate: number | null;
  currentRunRate: number | null;
};

export type ApplyDeliveryOutput = {
  state: MatchState;
  result: DeliveryResult;
};

export class CricketEngineError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'CricketEngineError';
    this.code = code;
  }
}
