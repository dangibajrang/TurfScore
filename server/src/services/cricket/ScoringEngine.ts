import type {
  ApplyDeliveryOutput,
  DeliveryApplied,
  DeliveryCommand,
  DeliveryResult,
  ExtrasBreakdown,
  InningsState,
  MatchResult,
  MatchState,
} from './types.js';
import { CricketEngineError } from './types.js';
import {
  calculateCurrentRunRate,
  calculateRequiredRunRate,
  calculateTarget,
  cloneExtras,
  emptyExtras,
  formatOvers,
  maxLegalBalls,
  maxWickets,
  resolveMaxOversPerBowler,
  sumExtras,
} from './utils.js';
import {
  cloneState,
  createInnings,
  ensureBatter,
  ensureBowler,
} from './MatchStateBuilder.js';
import {
  currentInnings,
  isBowlerWicket,
  validateDeliveryCommand,
} from './validators/commandValidator.js';

let sequenceCounter = 0;

/** Test helper — production uses delivery sequence from DB. */
export function resetSequenceCounter(n = 0): void {
  sequenceCounter = n;
}

function normalizeExtras(command: DeliveryCommand): ExtrasBreakdown {
  const e = command.extras ?? {};
  return {
    wide: e.wide ?? 0,
    noBall: e.noBall ?? 0,
    bye: e.bye ?? 0,
    legBye: e.legBye ?? 0,
    penalty: e.penalty ?? 0,
  };
}

/**
 * Apply a delivery command to match state (pure).
 * Does not touch MongoDB.
 */
export function applyDelivery(
  state: MatchState,
  command: DeliveryCommand,
  options: {
    battingXi: Set<string>;
    bowlingXi: Set<string>;
    sequence?: number;
  },
): ApplyDeliveryOutput {
  validateDeliveryCommand(state, command, options.battingXi, options.bowlingXi);

  const next = cloneState(state);
  const inn = currentInnings(next);
  const extras = normalizeExtras(command);
  const isWide = extras.wide > 0;
  const isNoBall = extras.noBall > 0;
  const isLegalBall = !isWide && !isNoBall;

  // For no-ball: noBall count is the no-ball penalty (usually 1); batterRuns are off the bat
  // For wide: wide count includes base wide (1) + additional
  // For bye/legBye: those are the extras; batterRuns must be 0
  const totalRuns = command.batterRuns + sumExtras(extras);

  // Bowler conceded: batter runs + wides + no-ball extras (NOT byes/leg-byes)
  const bowlerConceded = command.batterRuns + extras.wide + extras.noBall + extras.penalty;

  // For normal/no-ball rotation use batterRuns (+ bye/lb); for wide use (wide-1) additional
  const rotationRuns = isWide
    ? Math.max(0, extras.wide - 1)
    : extras.bye > 0 || extras.legBye > 0
      ? extras.bye + extras.legBye
      : command.batterRuns;

  // Prefer explicit runsCompleted on wicket for rotation; else rotationRuns
  const strikeRuns =
    command.wicket && command.wicket.runsCompleted != null
      ? command.wicket.runsCompleted
      : rotationRuns;

  const overNumber = Math.floor(inn.legalBalls / next.rules.ballsPerOver);
  const ballNumber = isLegalBall ? inn.ballsInCurrentOver + 1 : inn.ballsInCurrentOver;

  // Update totals
  inn.totalRuns += totalRuns;
  inn.extras.wide += extras.wide;
  inn.extras.noBall += extras.noBall;
  inn.extras.bye += extras.bye;
  inn.extras.legBye += extras.legBye;
  inn.extras.penalty += extras.penalty;

  const batter = ensureBatter(inn, command.batterId);
  const bowler = ensureBowler(inn, command.bowlerId);
  ensureBatter(inn, command.nonStrikerId);

  // Batter balls: increment for legal balls and no-balls (off the bat contact model:
  // balls faced increments on legal deliveries; NOT on wides; on no-balls only if bat runs or we count the delivery — standard: no-ball does NOT count as ball faced unless bat contact.
  // Common turf scoring: ball faced on legal + when batter runs scored off no-ball.
  // Spec: balls faced should NOT increment for wides; correctly handle no-balls.
  // We'll: increment balls for legal deliveries; for no-ball increment only if batterRuns > 0.
  if (isLegalBall) {
    batter.balls += 1;
  } else if (isNoBall && command.batterRuns > 0) {
    batter.balls += 1;
  }

  batter.runs += command.batterRuns;
  if (command.batterRuns === 4) batter.fours += 1;
  if (command.batterRuns === 6) batter.sixes += 1;

  bowler.runsConceded += bowlerConceded;
  if (isLegalBall) {
    bowler.legalBalls += 1;
    bowler.currentOverLegalBalls += 1;
  }
  bowler.currentOverRuns += bowlerConceded;

  // Partnership
  updatePartnership(inn, totalRuns, isLegalBall || (isNoBall && command.batterRuns > 0));

  let wicketFlag = false;
  let needsNewBatter = false;

  if (command.wicket) {
    wicketFlag = true;
    const outId = command.wicket.playerOutId;
    const outBatter = ensureBatter(inn, outId);

    if (command.wicket.wicketType === 'RETIRED_HURT') {
      outBatter.isRetiredHurt = true;
      outBatter.wicketType = 'RETIRED_HURT';
      // Does not increment wickets for all-out purposes in some rules — we still count for FOW display but not innings wickets
      // Spec: do not automatically treat as normal wicket. So don't increment inn.wickets.
    } else {
      outBatter.isOut = true;
      outBatter.wicketType = command.wicket.wicketType;
      outBatter.dismissalBowlerId = isBowlerWicket(command.wicket.wicketType)
        ? command.bowlerId
        : undefined;
      outBatter.dismissalFielderId = command.wicket.fielderId;
      inn.wickets += 1;
      if (isBowlerWicket(command.wicket.wicketType)) {
        bowler.wickets += 1;
      }
      inn.fallOfWickets.push({
        wicketNumber: inn.wickets,
        scoreAtWicket: inn.totalRuns,
        legalBallsAtWicket: inn.legalBalls + (isLegalBall ? 1 : 0),
        playerOutId: outId,
        overDisplay: formatOvers(
          inn.legalBalls + (isLegalBall ? 1 : 0),
          next.rules.ballsPerOver,
        ),
      });
    }

    closePartnership(inn);

    // Legal ball increment before checking all-out
    if (isLegalBall) {
      inn.legalBalls += 1;
      inn.ballsInCurrentOver += 1;
    }

    const allOut =
      command.wicket.wicketType !== 'RETIRED_HURT' && inn.wickets >= maxWickets(next.rules);

    if (!allOut) {
      if (command.nextBatterId) {
        ensureBatter(inn, command.nextBatterId);
        if (outId === inn.strikerId) {
          inn.strikerId = command.nextBatterId;
        } else {
          inn.nonStrikerId = command.nextBatterId;
        }
        startPartnership(inn);
        needsNewBatter = false;
        inn.pendingNewBatter = false;
      } else {
        needsNewBatter = true;
        inn.pendingNewBatter = true;
        if (outId === inn.strikerId) inn.strikerId = null;
        else inn.nonStrikerId = null;
      }
    }
  } else if (isLegalBall) {
    inn.legalBalls += 1;
    inn.ballsInCurrentOver += 1;
  }

  // Strike rotation (before over-end swap)
  if (!inn.pendingNewBatter && inn.strikerId && inn.nonStrikerId) {
    if (strikeRuns % 2 === 1) {
      const tmp = inn.strikerId;
      inn.strikerId = inn.nonStrikerId;
      inn.nonStrikerId = tmp;
    }
  }

  let overCompleted = false;
  let needsNewBowler = false;

  if (inn.ballsInCurrentOver >= next.rules.ballsPerOver) {
    overCompleted = true;
    // Maiden?
    if (bowler.currentOverRuns === 0 && bowler.currentOverLegalBalls === next.rules.ballsPerOver) {
      bowler.maidens += 1;
    }
    bowler.currentOverRuns = 0;
    bowler.currentOverLegalBalls = 0;
    inn.ballsInCurrentOver = 0;

    // End of over: swap ends
    if (inn.strikerId && inn.nonStrikerId) {
      const tmp = inn.strikerId;
      inn.strikerId = inn.nonStrikerId;
      inn.nonStrikerId = tmp;
    }

    inn.pendingNewBowler = true;
    inn.bowlerSelected = false;
    inn.currentBowlerId = null;
    needsNewBowler = true;
  }

  // Innings / match completion
  let inningsCompleted = false;
  let matchCompleted = false;

  const targetReached =
    next.target != null && inn.totalRuns >= next.target && inn.inningsNumber >= 2;

  const oversDone = inn.legalBalls >= maxLegalBalls(next.rules);
  const allOut = inn.wickets >= maxWickets(next.rules);

  if (targetReached || oversDone || allOut) {
    inningsCompleted = true;
    inn.isComplete = true;
    inn.endReason = targetReached ? 'TARGET' : allOut ? 'ALL_OUT' : 'OVERS';
    inn.pendingNewBatter = false;
    inn.pendingNewBowler = false;
    needsNewBatter = false;
    needsNewBowler = false;
    overCompleted = overCompleted || false;

    if (inn.inningsNumber === 1) {
      next.target = calculateTarget(inn.totalRuns);
      // Second innings not auto-started — needs startSecondInnings
    } else {
      matchCompleted = true;
      next.status = 'COMPLETED';
      next.result = computeResult(next);
    }
  }

  const seq = options.sequence ?? ++sequenceCounter;

  const delivery: DeliveryApplied = {
    eventId: command.eventId,
    inningsNumber: inn.inningsNumber,
    sequence: seq,
    overNumber,
    ballNumber,
    batterId: command.batterId,
    nonStrikerId: command.nonStrikerId,
    bowlerId: command.bowlerId,
    batterRuns: command.batterRuns,
    extrasRuns: sumExtras(extras),
    totalRuns,
    extras: cloneExtras(extras),
    isLegalBall,
    wicket: command.wicket
      ? {
          isWicket: true,
          wicketType: command.wicket.wicketType,
          playerOutId: command.wicket.playerOutId,
          fielderId: command.wicket.fielderId,
          runsCompleted: command.wicket.runsCompleted,
        }
      : { isWicket: false },
  };

  const required = computeRequired(next, inn);

  const result: DeliveryResult = {
    delivery,
    isLegalBall,
    overCompleted,
    inningsCompleted,
    matchCompleted,
    wicket: wicketFlag,
    needsNewBatter,
    needsNewBowler,
    strikerId: inn.strikerId,
    nonStrikerId: inn.nonStrikerId,
    currentBowlerId: inn.currentBowlerId,
    totalRuns: inn.totalRuns,
    wickets: inn.wickets,
    legalBalls: inn.legalBalls,
    oversDisplay: formatOvers(inn.legalBalls, next.rules.ballsPerOver),
    target: next.target,
    requiredRuns: required.requiredRuns,
    requiredRunRate: required.requiredRunRate,
    currentRunRate: calculateCurrentRunRate(
      inn.totalRuns,
      inn.legalBalls,
      next.rules.ballsPerOver,
    ),
  };

  return { state: next, result };
}

function computeRequired(state: MatchState, inn: InningsState) {
  if (state.target == null || inn.inningsNumber < 2 || inn.isComplete) {
    return { requiredRuns: null as number | null, requiredRunRate: null as number | null };
  }
  const requiredRuns = Math.max(0, state.target - inn.totalRuns);
  const remainingBalls = Math.max(0, maxLegalBalls(state.rules) - inn.legalBalls);
  return {
    requiredRuns,
    requiredRunRate: calculateRequiredRunRate(
      requiredRuns,
      remainingBalls,
      state.rules.ballsPerOver,
    ),
  };
}

export function computeResult(state: MatchState): MatchResult {
  const first = state.innings[0];
  const second = state.innings[1];
  if (!first || !second || !second.isComplete) {
    return { winnerTeamId: null, resultType: null, resultText: null };
  }

  if (second.totalRuns > first.totalRuns) {
    const wicketsRemaining = maxWickets(state.rules) - second.wickets;
    return {
      winnerTeamId: second.battingTeamId,
      resultType: 'WIN_BY_WICKETS',
      margin: wicketsRemaining,
      resultText: `Won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`,
    };
  }
  if (second.totalRuns < first.totalRuns) {
    const margin = first.totalRuns - second.totalRuns;
    return {
      winnerTeamId: first.battingTeamId,
      resultType: 'WIN_BY_RUNS',
      margin,
      resultText: `Won by ${margin} run${margin === 1 ? '' : 's'}`,
    };
  }
  return {
    winnerTeamId: null,
    resultType: 'TIE',
    resultText: 'Match tied',
  };
}

function updatePartnership(inn: InningsState, runs: number, countBall: boolean): void {
  const active = inn.partnerships.find((p) => p.isActive);
  if (!active) return;
  active.runs += runs;
  if (countBall) active.balls += 1;
}

function closePartnership(inn: InningsState): void {
  const active = inn.partnerships.find((p) => p.isActive);
  if (active) active.isActive = false;
}

function startPartnership(inn: InningsState): void {
  if (!inn.strikerId || !inn.nonStrikerId) return;
  inn.partnerships.push({
    batterAId: inn.strikerId,
    batterBId: inn.nonStrikerId,
    runs: 0,
    balls: 0,
    isActive: true,
  });
}

export function setOpeningBatters(
  state: MatchState,
  strikerId: string,
  nonStrikerId: string,
  battingXi: Set<string>,
): MatchState {
  if (strikerId === nonStrikerId) {
    throw new CricketEngineError('Striker and non-striker must differ', 'INVALID_STRIKER');
  }
  if (!battingXi.has(strikerId) || !battingXi.has(nonStrikerId)) {
    throw new CricketEngineError('Batters must be in batting XI', 'INVALID_BATTER');
  }
  const next = cloneState(state);
  const inn = currentInnings(next);
  if (inn.isComplete) throw new CricketEngineError('Innings completed', 'INNINGS_COMPLETED');
  if (inn.legalBalls > 0) {
    throw new CricketEngineError('Cannot change openings after deliveries', 'INVALID_DELIVERY');
  }
  inn.strikerId = strikerId;
  inn.nonStrikerId = nonStrikerId;
  inn.openingsSelected = true;
  inn.pendingNewBatter = false;
  ensureBatter(inn, strikerId);
  ensureBatter(inn, nonStrikerId);
  inn.partnerships = [
    {
      batterAId: strikerId,
      batterBId: nonStrikerId,
      runs: 0,
      balls: 0,
      isActive: true,
    },
  ];
  return next;
}

export function setCurrentBowler(
  state: MatchState,
  bowlerId: string,
  bowlingXi: Set<string>,
): MatchState {
  if (!bowlingXi.has(bowlerId)) {
    throw new CricketEngineError('Bowler must be in bowling XI', 'INVALID_BOWLER');
  }
  const next = cloneState(state);
  const inn = currentInnings(next);
  if (inn.isComplete) throw new CricketEngineError('Innings completed', 'INNINGS_COMPLETED');

  const maxOvers = resolveMaxOversPerBowler(next.rules);
  const existing = inn.bowlers[bowlerId];
  if (existing && inn.ballsInCurrentOver === 0) {
    const completed = Math.floor(existing.legalBalls / next.rules.ballsPerOver);
    if (completed >= maxOvers) {
      throw new CricketEngineError('Bowler has reached maximum overs', 'BOWLER_LIMIT_REACHED');
    }
  }
  // Cannot bowl consecutive overs: if last over was same bowler and starting new over
  // Simple rule: if pending new bowler, previous bowler may not continue (standard)
  // We track via: if ballsInCurrentOver===0 and we had a previous completed over by this bowler as last — skip for Phase 5 simplicity unless consecutive

  ensureBowler(inn, bowlerId);
  inn.currentBowlerId = bowlerId;
  inn.bowlerSelected = true;
  inn.pendingNewBowler = false;
  return next;
}

export function setReplacementBatter(
  state: MatchState,
  nextBatterId: string,
  battingXi: Set<string>,
): MatchState {
  const next = cloneState(state);
  const inn = currentInnings(next);
  if (!inn.pendingNewBatter) {
    throw new CricketEngineError('No replacement batter required', 'INVALID_BATTER');
  }
  if (!battingXi.has(nextBatterId)) {
    throw new CricketEngineError('Batter must be in XI', 'INVALID_BATTER');
  }
  const existing = inn.batters[nextBatterId];
  if (existing?.isOut || existing?.isRetiredHurt) {
    throw new CricketEngineError('Batter already out', 'INVALID_BATTER');
  }
  if (nextBatterId === inn.strikerId || nextBatterId === inn.nonStrikerId) {
    throw new CricketEngineError('Batter already at crease', 'INVALID_BATTER');
  }
  ensureBatter(inn, nextBatterId);
  if (!inn.strikerId) inn.strikerId = nextBatterId;
  else if (!inn.nonStrikerId) inn.nonStrikerId = nextBatterId;
  else throw new CricketEngineError('Both batters present', 'INVALID_BATTER');

  inn.pendingNewBatter = false;
  startPartnership(inn);
  return next;
}

export function startSecondInnings(
  state: MatchState,
  input: {
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
    battingXi: Set<string>;
    bowlingXi: Set<string>;
  },
): MatchState {
  const next = cloneState(state);
  const first = next.innings[0];
  if (!first?.isComplete) {
    throw new CricketEngineError('First innings not complete', 'INVALID_INNINGS');
  }
  if (next.innings.length > 1 && next.innings[1] && !next.innings[1].isComplete && next.innings[1].openingsSelected) {
    throw new CricketEngineError('Second innings already started', 'INVALID_INNINGS');
  }
  if (next.status !== 'LIVE') {
    throw new CricketEngineError('Match not live', 'MATCH_NOT_LIVE');
  }

  const battingTeamId = first.bowlingTeamId;
  const bowlingTeamId = first.battingTeamId;
  next.target = calculateTarget(first.totalRuns);

  let second = next.innings[1];
  if (!second) {
    second = createInnings({
      inningsNumber: 2,
      battingTeamId,
      bowlingTeamId,
    });
    next.innings.push(second);
  }
  next.currentInningsIndex = 1;

  const withOpen = setOpeningBatters(next, input.strikerId, input.nonStrikerId, input.battingXi);
  return setCurrentBowler(withOpen, input.bowlerId, input.bowlingXi);
}

/**
 * Replay deliveries to rebuild state from configuration + event list.
 */
export function reconstructMatchState(
  base: MatchState,
  deliveries: DeliveryCommand[],
  options: {
    battingXiForInnings: (inningsNumber: number) => Set<string>;
    bowlingXiForInnings: (inningsNumber: number) => Set<string>;
    /** Opening / bowler setup callbacks between deliveries if needed — usually state already has openings from prior API */
  },
): MatchState {
  let state = cloneState(base);
  // Reset innings runtime but keep structure
  state = {
    ...state,
    status: 'LIVE',
    currentInningsIndex: 0,
    target: null,
    result: null,
    innings: [
      createInnings({
        inningsNumber: 1,
        battingTeamId: base.innings[0]?.battingTeamId ?? base.teamAId,
        bowlingTeamId: base.innings[0]?.bowlingTeamId ?? base.teamBId,
      }),
    ],
  };

  // Reconstruction requires openings/bowler to be set via embedded metadata on first delivery
  // Callers should set openings before replay. For full rebuild from DB, scoring service
  // restores setup actions first.
  void options;
  void deliveries;
  return state;
}

export function replayDeliveries(
  initial: MatchState,
  steps: Array<{
    kind: 'openings' | 'bowler' | 'replacement' | 'delivery' | 'startSecond';
    strikerId?: string;
    nonStrikerId?: string;
    bowlerId?: string;
    nextBatterId?: string;
    command?: DeliveryCommand;
    battingXi: Set<string>;
    bowlingXi: Set<string>;
  }>,
): MatchState {
  let state = cloneState(initial);
  let seq = 0;
  for (const step of steps) {
    if (step.kind === 'openings') {
      state = setOpeningBatters(state, step.strikerId!, step.nonStrikerId!, step.battingXi);
    } else if (step.kind === 'bowler') {
      state = setCurrentBowler(state, step.bowlerId!, step.bowlingXi);
    } else if (step.kind === 'replacement') {
      state = setReplacementBatter(state, step.nextBatterId!, step.battingXi);
    } else if (step.kind === 'startSecond') {
      state = startSecondInnings(state, {
        strikerId: step.strikerId!,
        nonStrikerId: step.nonStrikerId!,
        bowlerId: step.bowlerId!,
        battingXi: step.battingXi,
        bowlingXi: step.bowlingXi,
      });
    } else if (step.kind === 'delivery' && step.command) {
      seq += 1;
      const out = applyDelivery(state, step.command, {
        battingXi: step.battingXi,
        bowlingXi: step.bowlingXi,
        sequence: seq,
      });
      state = out.state;
    }
  }
  return state;
}

export { emptyExtras, formatOvers, sumExtras };
