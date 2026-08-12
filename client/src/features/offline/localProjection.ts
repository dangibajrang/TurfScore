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
 */

import type { LivePresentation, MatchState, ScoringStateResponse } from '@/features/scoring/types';
import type { DeliveryCommandBody, OfflineCommandPayload } from './types';

function oversDisplay(legalBalls: number, ballsPerOver: number): string {
  const overs = Math.floor(legalBalls / ballsPerOver);
  const balls = legalBalls % ballsPerOver;
  return `${overs}.${balls}`;
}

function extrasRuns(extras?: DeliveryCommandBody['extras']): number {
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

/** Runs that change ends for the purposes of offline queue identity (heuristic). */
function shouldRotateStrike(body: DeliveryCommandBody, legal: boolean, overCompleted: boolean): boolean {
  const batterRuns = body.batterRuns ?? 0;
  const bye = body.extras?.bye ?? 0;
  const legBye = body.extras?.legBye ?? 0;
  const oddBat = batterRuns % 2 === 1;
  const oddBye = (bye + legBye) % 2 === 1;
  let rotate = oddBat || oddBye;
  // End of over also swaps ends in standard cricket.
  if (legal && overCompleted) rotate = !rotate;
  return rotate;
}

export function projectPresentationAfterCommand(
  presentation: LivePresentation,
  ballsPerOver: number,
  payload: OfflineCommandPayload,
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
      pendingNewBatter: Boolean(body.wicket),
      pendingNewBowler: overCompleted ? true : presentation.pendingNewBowler,
      ballsInCurrentOver: legal
        ? (presentation.ballsInCurrentOver + 1) % ballsPerOver
        : presentation.ballsInCurrentOver,
      strikerId,
      nonStrikerId,
    };
  }

  if (payload.type === 'UNDO') {
    // Cannot safely reverse without history; keep presentation and rely on queue length badge.
    return presentation;
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
): MatchState {
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

  const innings = state.innings.map((inn, idx) => {
    if (idx !== state.currentInningsIndex) return inn;
    let strikerId = inn.strikerId;
    let nonStrikerId = inn.nonStrikerId;
    if (rotate && strikerId && nonStrikerId) {
      const tmp = strikerId;
      strikerId = nonStrikerId;
      nonStrikerId = tmp;
    }
    return {
      ...inn,
      strikerId,
      nonStrikerId,
      legalBalls: (inn.legalBalls ?? 0) + (legal ? 1 : 0),
      totalRuns: (inn.totalRuns ?? 0) + (body.batterRuns ?? 0) + extrasRuns(body.extras),
      wickets: (inn.wickets ?? 0) + (body.wicket ? 1 : 0),
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
