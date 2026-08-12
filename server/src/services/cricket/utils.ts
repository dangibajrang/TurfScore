import type { ExtrasBreakdown, MatchRules } from './types.js';

export function emptyExtras(): ExtrasBreakdown {
  return { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 };
}

export function sumExtras(e: ExtrasBreakdown): number {
  return e.wide + e.noBall + e.bye + e.legBye + e.penalty;
}

/** completedOvers.remainingBalls display, e.g. 50 legal balls @ 6 → "8.2" */
export function formatOvers(legalBalls: number, ballsPerOver: number): string {
  if (ballsPerOver < 1) return '0.0';
  const completed = Math.floor(legalBalls / ballsPerOver);
  const rem = legalBalls % ballsPerOver;
  return `${completed}.${rem}`;
}

export function calculateStrikeRate(runs: number, balls: number): number {
  if (balls <= 0) return 0;
  return Math.round((runs / balls) * 10000) / 100;
}

/** Economy as runs per over, using legal-ball fractional overs. */
export function calculateEconomy(runsConceded: number, legalBalls: number, ballsPerOver: number): number {
  if (legalBalls <= 0 || ballsPerOver < 1) return 0;
  const overs = legalBalls / ballsPerOver;
  return Math.round((runsConceded / overs) * 100) / 100;
}

export function calculateCurrentRunRate(
  totalRuns: number,
  legalBalls: number,
  ballsPerOver: number,
): number | null {
  if (legalBalls <= 0 || ballsPerOver < 1) return null;
  const overs = legalBalls / ballsPerOver;
  return Math.round((totalRuns / overs) * 100) / 100;
}

export function calculateRequiredRunRate(
  requiredRuns: number,
  remainingBalls: number,
  ballsPerOver: number,
): number | null {
  if (remainingBalls <= 0 || ballsPerOver < 1) return null;
  const overs = remainingBalls / ballsPerOver;
  return Math.round((requiredRuns / overs) * 100) / 100;
}

export function calculateTarget(firstInningsRuns: number): number {
  return firstInningsRuns + 1;
}

export function maxWickets(rules: MatchRules): number {
  return Math.max(1, rules.playersPerSide - 1);
}

export function maxLegalBalls(rules: MatchRules): number {
  return rules.overs * rules.ballsPerOver;
}

export function defaultMaxOversPerBowler(overs: number): number {
  return Math.max(1, Math.ceil(overs / 5));
}

export function resolveMaxOversPerBowler(rules: MatchRules): number {
  return rules.maxOversPerBowler ?? defaultMaxOversPerBowler(rules.overs);
}

export function cloneExtras(e: ExtrasBreakdown): ExtrasBreakdown {
  return { ...e };
}
