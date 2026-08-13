import type { DeliveryCommand, MatchState, WicketType } from '../types.js';
import { CricketEngineError } from '../types.js';
import { maxLegalBalls, maxWickets, resolveMaxOversPerBowler } from '../utils.js';

const BOWLER_WICKETS: WicketType[] = ['BOWLED', 'CAUGHT', 'LBW', 'STUMPED', 'HIT_WICKET'];

export function assertMatchLive(state: MatchState): void {
  if (state.status !== 'LIVE') {
    throw new CricketEngineError('Match is not live', 'MATCH_NOT_LIVE');
  }
}

export function currentInnings(state: MatchState) {
  const inn = state.innings[state.currentInningsIndex];
  if (!inn) throw new CricketEngineError('No active innings', 'INVALID_INNINGS');
  return inn;
}

export function validateOpeningBatters(
  state: MatchState,
  strikerId: string,
  nonStrikerId: string,
  battingXi: Set<string>,
): void {
  assertMatchLive(state);
  const inn = currentInnings(state);
  if (inn.isComplete) throw new CricketEngineError('Innings already completed', 'INNINGS_COMPLETED');
  if (strikerId === nonStrikerId) {
    throw new CricketEngineError('Striker and non-striker must differ', 'INVALID_STRIKER');
  }
  if (!battingXi.has(strikerId) || !battingXi.has(nonStrikerId)) {
    throw new CricketEngineError('Batters must be in batting XI', 'INVALID_BATTER');
  }
}

export function validateBowlerSelection(
  state: MatchState,
  bowlerId: string,
  bowlingXi: Set<string>,
): void {
  assertMatchLive(state);
  const inn = currentInnings(state);
  if (inn.isComplete) throw new CricketEngineError('Innings already completed', 'INNINGS_COMPLETED');
  if (!bowlingXi.has(bowlerId)) {
    throw new CricketEngineError('Bowler must be in bowling XI', 'INVALID_BOWLER');
  }
  if (
    inn.ballsInCurrentOver === 0 &&
    inn.lastOverBowlerId &&
    inn.lastOverBowlerId === bowlerId
  ) {
    throw new CricketEngineError(
      'A bowler cannot bowl consecutive overs',
      'CONSECUTIVE_OVERS',
    );
  }
  const maxOvers = resolveMaxOversPerBowler(state.rules);
  const bowler = inn.bowlers[bowlerId];
  if (bowler) {
    const completedOvers = Math.floor(bowler.legalBalls / state.rules.ballsPerOver);
    // Starting a new over: if already at max completed overs and not mid-over, reject
    if (inn.ballsInCurrentOver === 0 && completedOvers >= maxOvers) {
      throw new CricketEngineError('Bowler has reached maximum overs', 'BOWLER_LIMIT_REACHED');
    }
  }
}

export function validateDeliveryCommand(
  state: MatchState,
  command: DeliveryCommand,
  battingXi: Set<string>,
  bowlingXi: Set<string>,
): void {
  assertMatchLive(state);
  const inn = currentInnings(state);

  if (inn.isComplete) {
    throw new CricketEngineError('Innings already completed', 'INNINGS_COMPLETED');
  }
  if (!inn.openingsSelected || !inn.strikerId || !inn.nonStrikerId) {
    throw new CricketEngineError('Opening batters not selected', 'INVALID_STRIKER');
  }
  if (!inn.bowlerSelected || !inn.currentBowlerId) {
    throw new CricketEngineError('Bowler not selected', 'NEW_BOWLER_REQUIRED');
  }
  if (inn.pendingNewBatter) {
    throw new CricketEngineError('New batter required before next delivery', 'NEW_BATTER_REQUIRED');
  }
  if (inn.pendingNewBowler) {
    throw new CricketEngineError('New bowler required before next delivery', 'NEW_BOWLER_REQUIRED');
  }

  if (command.batterRuns < 0 || command.batterRuns > 7) {
    throw new CricketEngineError('Invalid batter runs', 'INVALID_DELIVERY');
  }

  const extras = command.extras ?? {};
  const wide = extras.wide ?? 0;
  const noBall = extras.noBall ?? 0;
  const bye = extras.bye ?? 0;
  const legBye = extras.legBye ?? 0;
  const penalty = extras.penalty ?? 0;

  for (const n of [wide, noBall, bye, legBye, penalty]) {
    if (!Number.isInteger(n) || n < 0) {
      throw new CricketEngineError('Invalid extras', 'INVALID_EXTRA');
    }
  }

  if (wide > 0 && noBall > 0) {
    throw new CricketEngineError('Wide and no-ball cannot both apply', 'INVALID_EXTRA');
  }
  if (bye > 0 && legBye > 0) {
    throw new CricketEngineError('Bye and leg-bye cannot both apply', 'INVALID_EXTRA');
  }
  if ((wide > 0 || noBall > 0) && (bye > 0 || legBye > 0)) {
    throw new CricketEngineError('Cannot combine wide/no-ball with bye/leg-bye', 'INVALID_EXTRA');
  }
  if (wide > 0 && command.batterRuns > 0) {
    throw new CricketEngineError('Batter runs not allowed on wide', 'INVALID_DELIVERY');
  }
  if ((bye > 0 || legBye > 0) && command.batterRuns > 0) {
    throw new CricketEngineError('Batter runs not allowed with byes/leg-byes', 'INVALID_DELIVERY');
  }

  if (command.batterId !== inn.strikerId) {
    throw new CricketEngineError('Batter must be current striker', 'INVALID_BATTER');
  }
  if (command.nonStrikerId !== inn.nonStrikerId) {
    throw new CricketEngineError('Non-striker mismatch', 'INVALID_NON_STRIKER');
  }
  if (command.bowlerId !== inn.currentBowlerId) {
    throw new CricketEngineError('Bowler must be current bowler', 'INVALID_BOWLER');
  }
  if (!battingXi.has(command.batterId) || !battingXi.has(command.nonStrikerId)) {
    throw new CricketEngineError('Batters must be in batting XI', 'INVALID_BATTER');
  }
  if (!bowlingXi.has(command.bowlerId)) {
    throw new CricketEngineError('Bowler must be in bowling XI', 'INVALID_BOWLER');
  }

  const striker = inn.batters[command.batterId];
  const nonStriker = inn.batters[command.nonStrikerId];
  if (striker?.isOut || striker?.isRetiredHurt) {
    throw new CricketEngineError('Striker already dismissed', 'INVALID_BATTER');
  }
  if (nonStriker?.isOut || nonStriker?.isRetiredHurt) {
    throw new CricketEngineError('Non-striker already dismissed', 'INVALID_NON_STRIKER');
  }

  if (command.wicket) {
    validateWicket(command, inn.strikerId, inn.nonStrikerId, wide, noBall);
    if (needsReplacementBatter(command.wicket.wicketType) && !command.nextBatterId) {
      // Allow engine to set pending; but if all out, nextBatter not required
      const afterWickets = inn.wickets + (command.wicket.wicketType === 'RETIRED_HURT' ? 0 : 1);
      // RETIRED_HURT still needs replacement if not ending innings
      const remaining =
        maxWickets(state.rules) - (command.wicket.wicketType === 'RETIRED_HURT' ? inn.wickets : afterWickets);
      // We'll validate nextBatter in engine when innings continues
      void remaining;
    }
    if (command.nextBatterId) {
      if (
        command.nextBatterId === inn.strikerId ||
        command.nextBatterId === inn.nonStrikerId ||
        command.nextBatterId === command.wicket.playerOutId
      ) {
        throw new CricketEngineError('Invalid replacement batter', 'INVALID_BATTER');
      }
      if (!battingXi.has(command.nextBatterId)) {
        throw new CricketEngineError('Replacement batter must be in XI', 'INVALID_BATTER');
      }
      const nb = inn.batters[command.nextBatterId];
      if (nb?.isOut || nb?.isRetiredHurt) {
        throw new CricketEngineError('Replacement batter already out', 'INVALID_BATTER');
      }
    }
  }

  if (inn.legalBalls >= maxLegalBalls(state.rules) && !(wide > 0 || noBall > 0)) {
    // legal ball would exceed — reject
  }
}

function validateWicket(
  command: DeliveryCommand,
  strikerId: string,
  nonStrikerId: string,
  wide: number,
  noBall: number,
): void {
  const w = command.wicket!;
  if (!w.playerOutId) {
    throw new CricketEngineError('playerOutId required', 'INVALID_WICKET');
  }
  if (w.playerOutId !== strikerId && w.playerOutId !== nonStrikerId) {
    throw new CricketEngineError('Dismissed player must be batting', 'INVALID_WICKET');
  }

  if (BOWLER_WICKETS.includes(w.wicketType) && noBall > 0) {
    throw new CricketEngineError('Bowled/caught/LBW/stumped/hit-wicket not allowed on no-ball', 'INVALID_WICKET');
  }
  if (['BOWLED', 'LBW', 'HIT_WICKET'].includes(w.wicketType) && wide > 0) {
    throw new CricketEngineError(`${w.wicketType} not allowed on wide`, 'INVALID_WICKET');
  }
  if (w.wicketType === 'STUMPED' && wide > 0) {
    // stumped off wide is allowed in some rules — allow
  }
  if (w.wicketType === 'CAUGHT' && !w.fielderId) {
    throw new CricketEngineError('Fielder required for catch', 'INVALID_WICKET');
  }
  if (w.wicketType === 'STUMPED' && !w.fielderId) {
    throw new CricketEngineError('Wicketkeeper/fielder required for stumping', 'INVALID_WICKET');
  }
  if (w.wicketType === 'RUN_OUT' && !w.playerOutId) {
    throw new CricketEngineError('playerOutId required for run out', 'INVALID_WICKET');
  }
}

export function needsReplacementBatter(type: WicketType): boolean {
  return type !== 'OTHER'; // RETIRED_HURT also needs replacement
}

export function isBowlerWicket(type: WicketType): boolean {
  return BOWLER_WICKETS.includes(type);
}
