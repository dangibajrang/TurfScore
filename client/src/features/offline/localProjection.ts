/**
 * Minimal LOCAL DISPLAY projection — NOT a second cricket engine.
 *
 * Applies coarse scoreboard deltas so the scorer can keep tapping while offline.
 * Authoritative totals always come from the server after sync.
 *
 * Known limitations (see docs/OFFLINE_ARCHITECTURE.md):
 * - Strike rotation is a best-effort heuristic (odd batter runs / end of over).
 * - Does not fully recompute partnerships, FOW, extras legality.
 * - Over display is approximate (legal balls / ballsPerOver).
 * - Pending new batter/bowler flags are heuristic.
 * - Undo reverses the latest recent delivery for display only.
 */

import type {
  BatterState,
  BowlerState,
  DeliveryDto,
  InningsState,
  LivePresentation,
  MatchScorecard,
  MatchState,
  ScoringStateResponse,
  WicketType,
} from '@/features/scoring/types';
import type { DeliveryCommandBody, OfflineCommandPayload } from './types';

function oversDisplay(legalBalls: number, ballsPerOver: number): string {
  const overs = Math.floor(legalBalls / ballsPerOver);
  const balls = legalBalls % ballsPerOver;
  return `${overs}.${balls}`;
}

function extrasRuns(extras?: DeliveryCommandBody['extras'] | DeliveryDto['extras']): number {
  if (!extras) return 0;
  return (
    (extras.wide ?? 0) +
    (extras.noBall ?? 0) +
    (extras.bye ?? 0) +
    (extras.legBye ?? 0) +
    (extras.penalty ?? 0)
  );
}

function isLegalDelivery(body: DeliveryCommandBody): boolean {
  const w = body.extras?.wide ?? 0;
  const nb = body.extras?.noBall ?? 0;
  return w === 0 && nb === 0;
}

function commandBodyFromDelivery(d: DeliveryDto): DeliveryCommandBody {
  return {
    batterId: d.batterId,
    nonStrikerId: d.nonStrikerId,
    bowlerId: d.bowlerId,
    batterRuns: d.runs.batterRuns,
    extras: d.extras,
    wicket: d.wicket?.isWicket
      ? {
          wicketType: d.wicket.wicketType!,
          playerOutId: d.wicket.playerOutId ?? d.batterId,
          fielderId: d.wicket.fielderId,
          runsCompleted: d.wicket.runsCompleted,
        }
      : undefined,
  };
}

function emptyExtras(): DeliveryDto['extras'] {
  return { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 };
}

/** Runs that change ends for the purposes of offline queue identity (heuristic). */
function shouldRotateStrike(body: DeliveryCommandBody, legal: boolean, overCompleted: boolean): boolean {
  const batterRuns = body.batterRuns ?? 0;
  const bye = body.extras?.bye ?? 0;
  const legBye = body.extras?.legBye ?? 0;
  const oddBat = batterRuns % 2 === 1;
  const oddBye = (bye + legBye) % 2 === 1;
  let rotate = oddBat || oddBye;
  if (legal && overCompleted) rotate = !rotate;
  return rotate;
}

function swapEnds<T extends { strikerId: string | null; nonStrikerId: string | null }>(row: T): T {
  if (!row.strikerId || !row.nonStrikerId) return row;
  return { ...row, strikerId: row.nonStrikerId, nonStrikerId: row.strikerId };
}

function currentRunRate(runs: number, legalBalls: number, ballsPerOver: number): number | null {
  if (legalBalls <= 0) return null;
  return (runs * ballsPerOver) / legalBalls;
}

function isBowlerWicket(type?: WicketType): boolean {
  return type === 'BOWLED' || type === 'CAUGHT' || type === 'LBW' || type === 'STUMPED' || type === 'HIT_WICKET';
}

function emptyBatter(playerId: string): BatterState {
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

function emptyBowler(playerId: string): BowlerState {
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

function cloneInnings(inn: InningsState): InningsState {
  return {
    ...inn,
    extras: { ...(inn.extras ?? { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 }) },
    batters: Object.fromEntries(
      Object.entries(inn.batters ?? {}).map(([k, v]) => [k, { ...v }]),
    ),
    bowlers: Object.fromEntries(
      Object.entries(inn.bowlers ?? {}).map(([k, v]) => [k, { ...v }]),
    ),
    partnerships: (inn.partnerships ?? []).map((p) => ({ ...p })),
    fallOfWickets: [...(inn.fallOfWickets ?? [])],
  };
}

function batterBallsFaced(d: DeliveryDto): number {
  if (d.isLegalDelivery) return 1;
  if ((d.extras.noBall ?? 0) > 0 && (d.runs.batterRuns ?? 0) > 0) return 1;
  return 0;
}

function bowlerConceded(d: DeliveryDto): number {
  return (d.runs.batterRuns ?? 0) + (d.extras.wide ?? 0) + (d.extras.noBall ?? 0) + (d.extras.penalty ?? 0);
}

/** Best-effort batter / bowler / partnership deltas so live cards update without a refresh. */
function applyDeliveryFigures(inn: InningsState, d: DeliveryDto, sign: 1 | -1): InningsState {
  const next = cloneInnings(inn);
  const extra = extrasRuns(d.extras);
  const batterRuns = d.runs.batterRuns ?? 0;
  const legal = d.isLegalDelivery ? 1 : 0;
  const wicket = d.wicket?.isWicket && d.wicket.wicketType !== 'RETIRED_HURT' ? 1 : 0;
  const faced = batterBallsFaced(d);
  const conceded = bowlerConceded(d);
  const totalRuns = batterRuns + extra;

  next.totalRuns = Math.max(0, next.totalRuns + sign * totalRuns);
  next.legalBalls = Math.max(0, next.legalBalls + sign * legal);
  next.wickets = Math.max(0, next.wickets + sign * wicket);
  next.extras = {
    wide: Math.max(0, (next.extras.wide ?? 0) + sign * (d.extras.wide ?? 0)),
    noBall: Math.max(0, (next.extras.noBall ?? 0) + sign * (d.extras.noBall ?? 0)),
    bye: Math.max(0, (next.extras.bye ?? 0) + sign * (d.extras.bye ?? 0)),
    legBye: Math.max(0, (next.extras.legBye ?? 0) + sign * (d.extras.legBye ?? 0)),
    penalty: Math.max(0, (next.extras.penalty ?? 0) + sign * (d.extras.penalty ?? 0)),
  };

  const batter = { ...(next.batters[d.batterId] ?? emptyBatter(d.batterId)) };
  batter.runs = Math.max(0, batter.runs + sign * batterRuns);
  batter.balls = Math.max(0, batter.balls + sign * faced);
  if (batterRuns === 4) batter.fours = Math.max(0, batter.fours + sign);
  if (batterRuns === 6) batter.sixes = Math.max(0, batter.sixes + sign);
  if (d.wicket?.isWicket) {
    if (sign === 1) {
      if (d.wicket.wicketType === 'RETIRED_HURT') batter.isRetiredHurt = true;
      else batter.isOut = true;
      batter.wicketType = d.wicket.wicketType;
    } else {
      batter.isOut = false;
      batter.isRetiredHurt = false;
      batter.wicketType = undefined;
      batter.dismissalBowlerId = undefined;
      batter.dismissalFielderId = undefined;
    }
  }
  next.batters = { ...next.batters, [d.batterId]: batter };

  const bowler = { ...(next.bowlers[d.bowlerId] ?? emptyBowler(d.bowlerId)) };
  bowler.runsConceded = Math.max(0, bowler.runsConceded + sign * conceded);
  bowler.legalBalls = Math.max(0, bowler.legalBalls + sign * legal);
  if (isBowlerWicket(d.wicket?.wicketType)) {
    bowler.wickets = Math.max(0, bowler.wickets + sign);
  }
  bowler.currentOverLegalBalls = Math.max(0, bowler.currentOverLegalBalls + sign * legal);
  bowler.currentOverRuns = Math.max(0, bowler.currentOverRuns + sign * conceded);
  next.bowlers = { ...next.bowlers, [d.bowlerId]: bowler };

  const pIdx = next.partnerships.findIndex((p) => p.isActive);
  if (pIdx >= 0) {
    const p = next.partnerships[pIdx]!;
    next.partnerships[pIdx] = {
      ...p,
      runs: Math.max(0, p.runs + sign * totalRuns),
      balls: Math.max(0, p.balls + sign * faced),
      isActive: sign === -1 && wicket ? true : p.isActive,
    };
  }

  if (wicket) {
    if (sign === 1) {
      next.fallOfWickets = [
        ...next.fallOfWickets,
        {
          wicketNumber: next.wickets,
          scoreAtWicket: next.totalRuns,
          legalBallsAtWicket: next.legalBalls,
          playerOutId: d.wicket?.playerOutId ?? d.batterId,
          overDisplay: oversDisplay(next.legalBalls, 6),
        },
      ];
    } else {
      next.fallOfWickets = next.fallOfWickets.slice(0, -1);
      next.pendingNewBatter = false;
    }
  }

  return next;
}

export function projectScorecardFromState(
  scorecard: MatchScorecard | undefined,
  state: MatchState,
): MatchScorecard {
  const ballsPerOver = state.rules.ballsPerOver ?? 6;
  return {
    matchId: state.matchId,
    status: state.status,
    target: state.target,
    result: state.result,
    currentInningsIndex: state.currentInningsIndex,
    innings: state.innings.map((inn, idx) => {
      const prev = scorecard?.innings[idx];
      return {
        inningsNumber: inn.inningsNumber,
        battingTeamId: inn.battingTeamId,
        bowlingTeamId: inn.bowlingTeamId,
        totalRuns: inn.totalRuns,
        wickets: inn.wickets,
        legalBalls: inn.legalBalls,
        oversDisplay: oversDisplay(inn.legalBalls, ballsPerOver),
        extras: inn.extras,
        extrasTotal: extrasRuns(inn.extras),
        batting: Object.values(inn.batters).map((b) => ({
          ...b,
          strikeRate: b.balls > 0 ? (b.runs / b.balls) * 100 : 0,
          isStriker: b.playerId === inn.strikerId,
          isNonStriker: b.playerId === inn.nonStrikerId,
        })),
        bowling: Object.values(inn.bowlers).map((b) => ({
          ...b,
          oversDisplay: oversDisplay(b.legalBalls, ballsPerOver),
          economy: b.legalBalls > 0 ? (b.runsConceded * ballsPerOver) / b.legalBalls : 0,
        })),
        fallOfWickets: inn.fallOfWickets,
        partnerships: inn.partnerships,
        isComplete: inn.isComplete,
        endReason: inn.endReason ?? prev?.endReason,
      };
    }),
  };
}

export function syntheticDeliveryFromCommand(
  eventId: string,
  presentationBefore: LivePresentation,
  body: DeliveryCommandBody,
): DeliveryDto {
  const legal = isLegalDelivery(body);
  const extra = extrasRuns(body.extras);
  const batterRuns = body.batterRuns ?? 0;
  const extras = { ...emptyExtras(), ...body.extras };
  return {
    id: eventId,
    eventId,
    inningsNumber: presentationBefore.inningsNumber,
    overNumber: presentationBefore.currentOverNumber,
    ballNumber: legal ? presentationBefore.ballsInCurrentOver + 1 : presentationBefore.ballsInCurrentOver,
    sequence: Date.now(),
    batterId: body.batterId,
    nonStrikerId: body.nonStrikerId,
    bowlerId: body.bowlerId,
    runs: {
      batterRuns,
      extrasRuns: extra,
      totalRuns: batterRuns + extra,
    },
    extras,
    wicket: body.wicket
      ? {
          isWicket: true,
          wicketType: body.wicket.wicketType,
          playerOutId: body.wicket.playerOutId,
          fielderId: body.wicket.fielderId,
          runsCompleted: body.wicket.runsCompleted,
        }
      : { isWicket: false },
    isLegalDelivery: legal,
    isCorrection: false,
  };
}

export function projectRecentDeliveriesAfterCommand(
  recent: DeliveryDto[],
  payload: OfflineCommandPayload,
  presentationBefore: LivePresentation,
  eventId: string,
): DeliveryDto[] {
  if (payload.type === 'DELIVERY') {
    return [syntheticDeliveryFromCommand(eventId, presentationBefore, payload.body), ...recent];
  }
  if (payload.type === 'UNDO') {
    return recent.slice(1);
  }
  return recent;
}

function undoPresentation(
  presentation: LivePresentation,
  ballsPerOver: number,
  last: DeliveryDto,
): LivePresentation {
  const body = commandBodyFromDelivery(last);
  const legal = last.isLegalDelivery;
  const extra = extrasRuns(last.extras);
  const totalAdd = (last.runs.batterRuns ?? 0) + extra;
  const nextLegal = Math.max(0, presentation.legalBalls - (legal ? 1 : 0));
  const undoingOverComplete =
    legal &&
    presentation.ballsInCurrentOver === 0 &&
    presentation.legalBalls > 0 &&
    presentation.legalBalls % ballsPerOver === 0;
  const rotate = shouldRotateStrike(body, legal, undoingOverComplete);

  let next: LivePresentation = {
    ...presentation,
    totalRuns: Math.max(0, presentation.totalRuns - totalAdd),
    wickets: Math.max(0, presentation.wickets - (last.wicket?.isWicket ? 1 : 0)),
    legalBalls: nextLegal,
    oversDisplay: oversDisplay(nextLegal, ballsPerOver),
    pendingNewBatter: false,
    inningsComplete: false,
    matchComplete: false,
    currentRunRate: currentRunRate(
      Math.max(0, presentation.totalRuns - totalAdd),
      nextLegal,
      ballsPerOver,
    ),
  };

  if (legal) {
    if (undoingOverComplete) {
      next = {
        ...next,
        ballsInCurrentOver: ballsPerOver - 1,
        currentOverNumber: Math.max(0, presentation.currentOverNumber - 1),
        pendingNewBowler: false,
        bowlerSelected: true,
        currentBowlerId: last.bowlerId,
      };
    } else {
      next = {
        ...next,
        ballsInCurrentOver: Math.max(0, presentation.ballsInCurrentOver - 1),
      };
    }
  }

  if (rotate) next = swapEnds(next);
  return next;
}

export function projectPresentationAfterCommand(
  presentation: LivePresentation,
  ballsPerOver: number,
  payload: OfflineCommandPayload,
  lastDelivery?: DeliveryDto | null,
): LivePresentation {
  if (payload.type === 'DELIVERY') {
    const body = payload.body;
    const batterRuns = body.batterRuns ?? 0;
    const extra = extrasRuns(body.extras);
    const totalAdd = batterRuns + extra;
    const legal = isLegalDelivery(body);
    const nextLegal = presentation.legalBalls + (legal ? 1 : 0);
    const nextWickets = presentation.wickets + (body.wicket ? 1 : 0);
    const nextRuns = presentation.totalRuns + totalAdd;
    const overCompleted = legal && nextLegal > 0 && nextLegal % ballsPerOver === 0;
    const rotate = shouldRotateStrike(body, legal, overCompleted);

    let strikerId = presentation.strikerId ?? body.batterId;
    let nonStrikerId = presentation.nonStrikerId ?? body.nonStrikerId;
    if (rotate && strikerId && nonStrikerId) {
      const tmp = strikerId;
      strikerId = nonStrikerId;
      nonStrikerId = tmp;
    }

    return {
      ...presentation,
      totalRuns: nextRuns,
      wickets: nextWickets,
      legalBalls: nextLegal,
      oversDisplay: oversDisplay(nextLegal, ballsPerOver),
      currentRunRate: currentRunRate(nextRuns, nextLegal, ballsPerOver),
      pendingNewBatter: Boolean(body.wicket),
      pendingNewBowler: overCompleted ? true : presentation.pendingNewBowler,
      ballsInCurrentOver: legal
        ? (presentation.ballsInCurrentOver + 1) % ballsPerOver
        : presentation.ballsInCurrentOver,
      currentOverNumber: Math.floor(nextLegal / ballsPerOver),
      strikerId,
      nonStrikerId,
    };
  }

  if (payload.type === 'UNDO') {
    if (!lastDelivery) return presentation;
    return undoPresentation(presentation, ballsPerOver, lastDelivery);
  }

  if (payload.type === 'SET_OPENINGS') {
    return {
      ...presentation,
      openingsSelected: true,
      strikerId: payload.body.strikerId,
      nonStrikerId: payload.body.nonStrikerId,
    };
  }

  if (payload.type === 'SELECT_BOWLER') {
    return {
      ...presentation,
      bowlerSelected: true,
      pendingNewBowler: false,
      currentBowlerId: payload.body.bowlerId,
    };
  }

  if (payload.type === 'SELECT_BATTER') {
    return {
      ...presentation,
      pendingNewBatter: false,
      strikerId: payload.body.nextBatterId,
    };
  }

  if (payload.type === 'START_INNINGS') {
    return {
      ...presentation,
      openingsSelected: true,
      bowlerSelected: true,
      pendingNewBatter: false,
      pendingNewBowler: false,
      inningsComplete: false,
      strikerId: payload.body.strikerId,
      nonStrikerId: payload.body.nonStrikerId,
      currentBowlerId: payload.body.bowlerId,
      totalRuns: 0,
      wickets: 0,
      legalBalls: 0,
      oversDisplay: '0.0',
      inningsNumber: presentation.inningsNumber + 1,
    };
  }

  return presentation;
}

/**
 * Best-effort update of crease identities so the next offline tap queues the correct batterId.
 * Not a full engine — only what is required for ordered sync to remain valid.
 */
export function projectStateAfterCommand(
  state: MatchState,
  ballsPerOver: number,
  payload: OfflineCommandPayload,
  presentationBefore: LivePresentation,
  lastDelivery?: DeliveryDto | null,
): MatchState {
  if (payload.type === 'UNDO') {
    if (!lastDelivery) return state;
    const undone = undoPresentation(presentationBefore, ballsPerOver, lastDelivery);
    const innings = state.innings.map((inn, idx) => {
      if (idx !== state.currentInningsIndex) return inn;
      const figured = applyDeliveryFigures(inn, lastDelivery, -1);
      return {
        ...figured,
        strikerId: undone.strikerId,
        nonStrikerId: undone.nonStrikerId,
        currentBowlerId: undone.currentBowlerId,
        bowlerSelected: undone.bowlerSelected,
        pendingNewBowler: undone.pendingNewBowler,
        pendingNewBatter: undone.pendingNewBatter,
        ballsInCurrentOver: undone.ballsInCurrentOver,
        isComplete: false,
      };
    });
    return { ...state, status: state.status === 'COMPLETED' ? 'LIVE' : state.status, innings };
  }

  if (payload.type !== 'DELIVERY') {
    if (payload.type === 'SELECT_BOWLER') {
      const innings = state.innings.map((inn, idx) =>
        idx === state.currentInningsIndex
          ? { ...inn, currentBowlerId: payload.body.bowlerId }
          : inn,
      );
      return { ...state, innings };
    }
    if (payload.type === 'SET_OPENINGS') {
      const innings = state.innings.map((inn, idx) =>
        idx === state.currentInningsIndex
          ? {
              ...inn,
              strikerId: payload.body.strikerId,
              nonStrikerId: payload.body.nonStrikerId,
            }
          : inn,
      );
      return { ...state, innings };
    }
    if (payload.type === 'SELECT_BATTER') {
      const innings = state.innings.map((inn, idx) =>
        idx === state.currentInningsIndex ? { ...inn, strikerId: payload.body.nextBatterId } : inn,
      );
      return { ...state, innings };
    }
    return state;
  }

  const body = payload.body;
  const legal = isLegalDelivery(body);
  const nextLegal = presentationBefore.legalBalls + (legal ? 1 : 0);
  const overCompleted = legal && nextLegal > 0 && nextLegal % ballsPerOver === 0;
  const rotate = shouldRotateStrike(body, legal, overCompleted);

  const delivery = syntheticDeliveryFromCommand('local', presentationBefore, body);
  const innings = state.innings.map((inn, idx) => {
    if (idx !== state.currentInningsIndex) return inn;
    const figured = applyDeliveryFigures(inn, delivery, 1);
    let strikerId = figured.strikerId;
    let nonStrikerId = figured.nonStrikerId;
    if (rotate && strikerId && nonStrikerId) {
      const tmp = strikerId;
      strikerId = nonStrikerId;
      nonStrikerId = tmp;
    }
    return {
      ...figured,
      strikerId,
      nonStrikerId,
      pendingNewBatter: Boolean(body.wicket),
      pendingNewBowler: overCompleted ? true : figured.pendingNewBowler,
      currentBowlerId: overCompleted ? null : figured.currentBowlerId,
      bowlerSelected: overCompleted ? false : figured.bowlerSelected,
      lastOverBowlerId: overCompleted ? body.bowlerId : figured.lastOverBowlerId,
      ballsInCurrentOver: legal
        ? (presentationBefore.ballsInCurrentOver + 1) % ballsPerOver
        : figured.ballsInCurrentOver,
    };
  });

  return { ...state, innings };
}

export function buildLocalHint(
  snapshot: ScoringStateResponse,
  pendingCount: number,
  projected: LivePresentation,
): {
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversDisplay: string;
  pendingCount: number;
  confidence: 'SERVER_CONFIRMED' | 'LOCAL_PENDING';
} {
  if (pendingCount <= 0) {
    return {
      totalRuns: snapshot.presentation.totalRuns,
      wickets: snapshot.presentation.wickets,
      legalBalls: snapshot.presentation.legalBalls,
      oversDisplay: snapshot.presentation.oversDisplay,
      pendingCount: 0,
      confidence: 'SERVER_CONFIRMED',
    };
  }
  return {
    totalRuns: projected.totalRuns,
    wickets: projected.wickets,
    legalBalls: projected.legalBalls,
    oversDisplay: projected.oversDisplay,
    pendingCount,
    confidence: 'LOCAL_PENDING',
  };
}
