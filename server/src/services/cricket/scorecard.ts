import type { BatterState, BowlerState, InningsState, MatchState } from './types.js';
import {
  calculateCurrentRunRate,
  calculateEconomy,
  calculateRequiredRunRate,
  calculateStrikeRate,
  formatOvers,
  maxLegalBalls,
  sumExtras,
} from './utils.js';

/** Server-computed display metrics so the UI never invents cricket math. */
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

export function buildLivePresentation(state: MatchState): LivePresentation {
  const inn = state.innings[state.currentInningsIndex] ?? state.innings[0];
  const ballsPerOver = state.rules.ballsPerOver;
  const maxBalls = maxLegalBalls(state.rules);
  const remainingBalls = Math.max(0, maxBalls - inn.legalBalls);
  const isChase = state.target != null && inn.inningsNumber >= 2;
  const requiredRuns = isChase ? Math.max(0, state.target! - inn.totalRuns) : null;

  return {
    battingTeamId: inn.battingTeamId,
    bowlingTeamId: inn.bowlingTeamId,
    totalRuns: inn.totalRuns,
    wickets: inn.wickets,
    legalBalls: inn.legalBalls,
    oversDisplay: formatOvers(inn.legalBalls, ballsPerOver),
    currentRunRate: calculateCurrentRunRate(inn.totalRuns, inn.legalBalls, ballsPerOver),
    target: state.target,
    requiredRuns,
    remainingBalls: isChase ? remainingBalls : null,
    requiredRunRate:
      isChase && requiredRuns != null
        ? calculateRequiredRunRate(requiredRuns, remainingBalls, ballsPerOver)
        : null,
    openingsSelected: inn.openingsSelected,
    bowlerSelected: inn.bowlerSelected,
    pendingNewBatter: inn.pendingNewBatter,
    pendingNewBowler: inn.pendingNewBowler,
    inningsComplete: inn.isComplete,
    matchComplete: state.status === 'COMPLETED',
    strikerId: inn.strikerId,
    nonStrikerId: inn.nonStrikerId,
    currentBowlerId: inn.currentBowlerId,
    currentOverNumber: Math.floor(inn.legalBalls / ballsPerOver),
    ballsInCurrentOver: inn.ballsInCurrentOver,
    inningsNumber: inn.inningsNumber,
  };
}

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
  extras: InningsState['extras'];
  extrasTotal: number;
  batting: ScorecardBatter[];
  bowling: ScorecardBowler[];
  fallOfWickets: InningsState['fallOfWickets'];
  partnerships: InningsState['partnerships'];
  isComplete: boolean;
  endReason?: InningsState['endReason'];
};

export type MatchScorecard = {
  matchId: string;
  status: MatchState['status'];
  target: number | null;
  result: MatchState['result'];
  currentInningsIndex: number;
  innings: InningsScorecard[];
};

export function buildInningsScorecard(
  inn: InningsState,
  ballsPerOver: number,
): InningsScorecard {
  const batting: ScorecardBatter[] = Object.values(inn.batters).map((b) => ({
    ...b,
    strikeRate: calculateStrikeRate(b.runs, b.balls),
    isStriker: b.playerId === inn.strikerId,
    isNonStriker: b.playerId === inn.nonStrikerId,
  }));

  const bowling: ScorecardBowler[] = Object.values(inn.bowlers).map((b) => ({
    ...b,
    oversDisplay: formatOvers(b.legalBalls, ballsPerOver),
    economy: calculateEconomy(b.runsConceded, b.legalBalls, ballsPerOver),
  }));

  return {
    inningsNumber: inn.inningsNumber,
    battingTeamId: inn.battingTeamId,
    bowlingTeamId: inn.bowlingTeamId,
    totalRuns: inn.totalRuns,
    wickets: inn.wickets,
    legalBalls: inn.legalBalls,
    oversDisplay: formatOvers(inn.legalBalls, ballsPerOver),
    extras: inn.extras,
    extrasTotal: sumExtras(inn.extras),
    batting,
    bowling,
    fallOfWickets: inn.fallOfWickets,
    partnerships: inn.partnerships,
    isComplete: inn.isComplete,
    endReason: inn.endReason,
  };
}

export function buildMatchScorecard(state: MatchState): MatchScorecard {
  return {
    matchId: state.matchId,
    status: state.status,
    target: state.target,
    result: state.result,
    currentInningsIndex: state.currentInningsIndex,
    innings: state.innings.map((inn) =>
      buildInningsScorecard(inn, state.rules.ballsPerOver),
    ),
  };
}

export function validateMatchSnapshot(
  stored: MatchState,
  reconstructed: MatchState,
): { ok: boolean; differences: string[] } {
  const differences: string[] = [];
  if (stored.status !== reconstructed.status) {
    differences.push(`status: ${stored.status} vs ${reconstructed.status}`);
  }
  if (stored.innings.length !== reconstructed.innings.length) {
    differences.push(
      `innings count: ${stored.innings.length} vs ${reconstructed.innings.length}`,
    );
  }
  const n = Math.min(stored.innings.length, reconstructed.innings.length);
  for (let i = 0; i < n; i++) {
    const a = stored.innings[i];
    const b = reconstructed.innings[i];
    if (a.totalRuns !== b.totalRuns) differences.push(`inn${i} runs: ${a.totalRuns} vs ${b.totalRuns}`);
    if (a.wickets !== b.wickets) differences.push(`inn${i} wickets: ${a.wickets} vs ${b.wickets}`);
    if (a.legalBalls !== b.legalBalls) {
      differences.push(`inn${i} legalBalls: ${a.legalBalls} vs ${b.legalBalls}`);
    }
  }
  return { ok: differences.length === 0, differences };
}
