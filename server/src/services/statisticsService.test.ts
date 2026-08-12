import { describe, expect, it } from 'vitest';
import {
  aggregateFromMatches,
  scoreSummaryFromMatch,
} from './statisticsService.js';
import type { MatchState } from './cricket/types.js';

function fakeMatch(opts: {
  teamA: string;
  teamB: string;
  winner?: string;
  batters: Array<{ id: string; runs: number; balls: number; isOut?: boolean }>;
}) {
  const scoring: MatchState = {
    matchId: 'm1',
    status: 'COMPLETED',
    rules: { overs: 10, ballsPerOver: 6, playersPerSide: 3 },
    teamAId: opts.teamA,
    teamBId: opts.teamB,
    currentInningsIndex: 0,
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: opts.teamA,
        bowlingTeamId: opts.teamB,
        totalRuns: opts.batters.reduce((s, b) => s + b.runs, 0),
        wickets: opts.batters.filter((b) => b.isOut).length,
        legalBalls: opts.batters.reduce((s, b) => s + b.balls, 0),
        extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 },
        strikerId: null,
        nonStrikerId: null,
        currentBowlerId: null,
        ballsInCurrentOver: 0,
        batters: Object.fromEntries(
          opts.batters.map((b) => [
            b.id,
            {
              playerId: b.id,
              runs: b.runs,
              balls: b.balls,
              fours: 0,
              sixes: 0,
              isOut: Boolean(b.isOut),
              isRetiredHurt: false,
            },
          ]),
        ),
        bowlers: {
          bowl1: {
            playerId: 'bowl1',
            legalBalls: 12,
            runsConceded: 20,
            wickets: 2,
            maidens: 0,
            currentOverRuns: 0,
            currentOverLegalBalls: 0,
          },
        },
        fallOfWickets: [],
        partnerships: [],
        isComplete: true,
        openingsSelected: true,
        bowlerSelected: true,
        pendingNewBatter: false,
        pendingNewBowler: false,
      },
    ],
    target: null,
    result: null,
    version: 1,
  };

  return {
    teamA: { teamId: opts.teamA, playingXi: [] },
    teamB: { teamId: opts.teamB, playingXi: [] },
    winnerTeamId: opts.winner,
    resultText: opts.winner ? 'Won' : null,
    snapshot: { scoring },
    rules: { ballsPerOver: 6 },
  } as unknown as Awaited<ReturnType<typeof import('../statisticsService.js').loadCompletedMatches>>[number];
}

describe('statistics aggregation', () => {
  it('sums batting runs across matches', () => {
    const matches = [
      fakeMatch({
        teamA: 't1',
        teamB: 't2',
        winner: 't1',
        batters: [
          { id: 'p1', runs: 45, balls: 23, isOut: true },
          { id: 'p2', runs: 12, balls: 8, isOut: true },
        ],
      }),
      fakeMatch({
        teamA: 't1',
        teamB: 't2',
        winner: 't1',
        batters: [{ id: 'p1', runs: 67, balls: 31, isOut: false }],
      }),
    ];

    const { batterMap } = aggregateFromMatches(matches);
    expect(batterMap.get('p1')?.runs).toBe(112);
    expect(batterMap.get('p1')?.fifties).toBe(1);
    expect(batterMap.get('p1')?.hundreds).toBe(0);
    expect(batterMap.get('p1')?.highest).toBe(67);
    expect(batterMap.get('p1')?.highestNotOut).toBe(true);
    expect(batterMap.get('p2')?.runs).toBe(12);
  });

  it('builds score summary from innings', () => {
    const m = fakeMatch({
      teamA: 't1',
      teamB: 't2',
      batters: [{ id: 'p1', runs: 50, balls: 30 }],
    });
    const summary = scoreSummaryFromMatch(m);
    expect(summary?.teamA?.runs).toBe(50);
    expect(summary?.teamA?.wickets).toBe(0);
  });

  it('tracks team wins', () => {
    const matches = [
      fakeMatch({
        teamA: 't1',
        teamB: 't2',
        winner: 't1',
        batters: [{ id: 'p1', runs: 10, balls: 5 }],
      }),
      fakeMatch({
        teamA: 't1',
        teamB: 't2',
        winner: 't2',
        batters: [{ id: 'p1', runs: 5, balls: 4 }],
      }),
    ];
    const { teamMapAgg } = aggregateFromMatches(matches);
    expect(teamMapAgg.get('t1')?.won).toBe(1);
    expect(teamMapAgg.get('t1')?.lost).toBe(1);
    expect(teamMapAgg.get('t2')?.won).toBe(1);
  });
});
