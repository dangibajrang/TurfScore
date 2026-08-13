import type {
  BatterState,
  BowlerState,
  InningsState,
  MatchRules,
  MatchState,
} from './types.js';
import { emptyExtras } from './utils.js';

export function createBatter(playerId: string): BatterState {
  return {
    playerId,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    isRetiredHurt: false,
  };
}

export function createBowler(playerId: string): BowlerState {
  return {
    playerId,
    legalBalls: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    currentOverRuns: 0,
    currentOverLegalBalls: 0,
  };
}

export function createInnings(input: {
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
}): InningsState {
  return {
    inningsNumber: input.inningsNumber,
    battingTeamId: input.battingTeamId,
    bowlingTeamId: input.bowlingTeamId,
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0,
    extras: emptyExtras(),
    strikerId: null,
    nonStrikerId: null,
    currentBowlerId: null,
    lastOverBowlerId: null,
    ballsInCurrentOver: 0,
    batters: {},
    bowlers: {},
    fallOfWickets: [],
    partnerships: [],
    isComplete: false,
    openingsSelected: false,
    bowlerSelected: false,
    pendingNewBatter: false,
    pendingNewBowler: false,
  };
}

export function createInitialMatchState(input: {
  matchId: string;
  rules: MatchRules;
  teamAId: string;
  teamBId: string;
  battingTeamId: string;
  bowlingTeamId: string;
  version?: number;
}): MatchState {
  return {
    matchId: input.matchId,
    status: 'LIVE',
    rules: { ...input.rules },
    teamAId: input.teamAId,
    teamBId: input.teamBId,
    currentInningsIndex: 0,
    innings: [
      createInnings({
        inningsNumber: 1,
        battingTeamId: input.battingTeamId,
        bowlingTeamId: input.bowlingTeamId,
      }),
    ],
    target: null,
    result: null,
    version: input.version ?? 1,
  };
}

export function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

export function ensureBatter(innings: InningsState, playerId: string): BatterState {
  if (!innings.batters) innings.batters = {};
  if (!innings.batters[playerId]) {
    innings.batters[playerId] = createBatter(playerId);
  }
  return innings.batters[playerId];
}

export function ensureBowler(innings: InningsState, playerId: string): BowlerState {
  if (!innings.bowlers) innings.bowlers = {};
  if (!innings.bowlers[playerId]) {
    innings.bowlers[playerId] = createBowler(playerId);
  }
  return innings.bowlers[playerId];
}
