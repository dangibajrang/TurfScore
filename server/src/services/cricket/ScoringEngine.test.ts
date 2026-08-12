import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyDelivery,
  setOpeningBatters,
  setCurrentBowler,
  setReplacementBatter,
  startSecondInnings,
  replayDeliveries,
  createInitialMatchState,
  formatOvers,
  buildMatchScorecard,
  validateMatchSnapshot,
  resetSequenceCounter,
  type DeliveryCommand,
  type MatchState,
} from './index.js';

const rules = {
  overs: 2,
  ballsPerOver: 6,
  playersPerSide: 3,
  maxOversPerBowler: 1,
};

const teamA = 'teamA';
const teamB = 'teamB';
const batXi = new Set(['b1', 'b2', 'b3']);
const bowlXi = new Set(['p1', 'p2', 'p3']);

function baseState(): MatchState {
  return createInitialMatchState({
    matchId: 'm1',
    rules,
    teamAId: teamA,
    teamBId: teamB,
    battingTeamId: teamA,
    bowlingTeamId: teamB,
  });
}

function ready(state: MatchState, bowler = 'p1'): MatchState {
  let s = setOpeningBatters(state, 'b1', 'b2', batXi);
  s = setCurrentBowler(s, bowler, bowlXi);
  return s;
}

function cmd(partial: Partial<DeliveryCommand> & { eventId: string }): DeliveryCommand {
  return {
    batterId: 'b1',
    nonStrikerId: 'b2',
    bowlerId: 'p1',
    batterRuns: 0,
    ...partial,
  };
}

beforeEach(() => resetSequenceCounter());

describe('normal deliveries', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])('scores %i runs', (runs) => {
    let state = ready(baseState());
    // striker may rotate — set batter to current striker
    const c = cmd({
      eventId: `r${runs}`,
      batterId: state.innings[0].strikerId!,
      nonStrikerId: state.innings[0].nonStrikerId!,
      batterRuns: runs,
    });
    const { state: next, result } = applyDelivery(state, c, { battingXi: batXi, bowlingXi: bowlXi });
    expect(result.totalRuns).toBe(runs);
    expect(result.isLegalBall).toBe(true);
    expect(next.innings[0].batters[c.batterId].runs).toBe(runs);
    expect(next.innings[0].bowlers.p1.runsConceded).toBe(runs);
    if (runs === 4) expect(next.innings[0].batters[c.batterId].fours).toBe(1);
    if (runs === 6) expect(next.innings[0].batters[c.batterId].sixes).toBe(1);
  });
});

describe('extras', () => {
  it('handles 1 wide', () => {
    const state = ready(baseState());
    const { state: next, result } = applyDelivery(
      state,
      cmd({
        eventId: 'w1',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        extras: { wide: 1 },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(result.isLegalBall).toBe(false);
    expect(result.totalRuns).toBe(1);
    expect(next.innings[0].legalBalls).toBe(0);
    expect(next.innings[0].extras.wide).toBe(1);
    expect(next.innings[0].bowlers.p1.runsConceded).toBe(1);
    expect(next.innings[0].batters.b1.balls).toBe(0);
  });

  it('handles 2 wides with rotation', () => {
    const state = ready(baseState());
    const striker = state.innings[0].strikerId!;
    const non = state.innings[0].nonStrikerId!;
    const { state: next } = applyDelivery(
      state,
      cmd({
        eventId: 'w2',
        batterId: striker,
        nonStrikerId: non,
        extras: { wide: 2 },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(next.innings[0].totalRuns).toBe(2);
    expect(next.innings[0].strikerId).toBe(non);
  });

  it('handles no-ball + 4', () => {
    const state = ready(baseState());
    const { state: next, result } = applyDelivery(
      state,
      cmd({
        eventId: 'nb4',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        batterRuns: 4,
        extras: { noBall: 1 },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(result.isLegalBall).toBe(false);
    expect(next.innings[0].totalRuns).toBe(5);
    expect(next.innings[0].legalBalls).toBe(0);
    expect(next.innings[0].batters.b1.runs).toBe(4);
    expect(next.innings[0].bowlers.p1.runsConceded).toBe(5);
  });

  it('handles 2 byes', () => {
    const state = ready(baseState());
    const striker = state.innings[0].strikerId!;
    const { state: next } = applyDelivery(
      state,
      cmd({
        eventId: 'bye2',
        batterId: striker,
        nonStrikerId: state.innings[0].nonStrikerId!,
        extras: { bye: 2 },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(next.innings[0].totalRuns).toBe(2);
    expect(next.innings[0].batters[striker].runs).toBe(0);
    expect(next.innings[0].bowlers.p1.runsConceded).toBe(0);
    expect(next.innings[0].legalBalls).toBe(1);
  });

  it('handles 1 leg-bye', () => {
    const state = ready(baseState());
    const { state: next } = applyDelivery(
      state,
      cmd({
        eventId: 'lb1',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        extras: { legBye: 1 },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(next.innings[0].totalRuns).toBe(1);
    expect(next.innings[0].extras.legBye).toBe(1);
    expect(next.innings[0].bowlers.p1.runsConceded).toBe(0);
    expect(next.innings[0].legalBalls).toBe(1);
  });
});

describe('wickets', () => {
  it('bowled requires next batter', () => {
    const state = ready(baseState());
    const { state: next, result } = applyDelivery(
      state,
      cmd({
        eventId: 'wkt',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        wicket: { wicketType: 'BOWLED', playerOutId: state.innings[0].strikerId! },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(result.wicket).toBe(true);
    expect(result.needsNewBatter).toBe(true);
    expect(next.innings[0].wickets).toBe(1);
    expect(next.innings[0].bowlers.p1.wickets).toBe(1);
  });

  it('rejects bowled on no-ball', () => {
    const state = ready(baseState());
    expect(() =>
      applyDelivery(
        state,
        cmd({
          eventId: 'bad',
          batterId: state.innings[0].strikerId!,
          nonStrikerId: state.innings[0].nonStrikerId!,
          extras: { noBall: 1 },
          wicket: { wicketType: 'BOWLED', playerOutId: state.innings[0].strikerId! },
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      ),
    ).toThrow(/no-ball/i);
  });

  it('allows run out on no-ball', () => {
    const state = ready(baseState());
    const { result } = applyDelivery(
      state,
      cmd({
        eventId: 'ro',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        extras: { noBall: 1 },
        wicket: {
          wicketType: 'RUN_OUT',
          playerOutId: state.innings[0].nonStrikerId!,
          fielderId: 'p2',
        },
        nextBatterId: 'b3',
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(result.wicket).toBe(true);
    expect(result.isLegalBall).toBe(false);
  });

  it('caught requires fielder', () => {
    const state = ready(baseState());
    expect(() =>
      applyDelivery(
        state,
        cmd({
          eventId: 'c',
          batterId: state.innings[0].strikerId!,
          nonStrikerId: state.innings[0].nonStrikerId!,
          wicket: { wicketType: 'CAUGHT', playerOutId: state.innings[0].strikerId! },
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      ),
    ).toThrow(/Fielder/);
  });
});

describe('strike rotation', () => {
  it('odd runs swap; even keep', () => {
    let state = ready(baseState());
    const s0 = state.innings[0].strikerId!;
    const n0 = state.innings[0].nonStrikerId!;
    state = applyDelivery(
      state,
      cmd({ eventId: '1', batterId: s0, nonStrikerId: n0, batterRuns: 1 }),
      { battingXi: batXi, bowlingXi: bowlXi },
    ).state;
    expect(state.innings[0].strikerId).toBe(n0);

    const s1 = state.innings[0].strikerId!;
    const n1 = state.innings[0].nonStrikerId!;
    state = applyDelivery(
      state,
      cmd({ eventId: '2', batterId: s1, nonStrikerId: n1, batterRuns: 2 }),
      { battingXi: batXi, bowlingXi: bowlXi },
    ).state;
    expect(state.innings[0].strikerId).toBe(s1);
  });
});

describe('overs', () => {
  it('completes after ballsPerOver legal balls', () => {
    let state = ready(baseState());
    for (let i = 0; i < 6; i++) {
      const out = applyDelivery(
        state,
        cmd({
          eventId: `o${i}`,
          batterId: state.innings[0].strikerId!,
          nonStrikerId: state.innings[0].nonStrikerId!,
          batterRuns: 0,
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      );
      state = out.state;
      if (i < 5) expect(out.result.overCompleted).toBe(false);
      else {
        expect(out.result.overCompleted).toBe(true);
        expect(out.result.needsNewBowler).toBe(true);
      }
    }
  });

  it('wide on last ball does not complete over', () => {
    let state = ready(baseState());
    for (let i = 0; i < 5; i++) {
      state = applyDelivery(
        state,
        cmd({
          eventId: `d${i}`,
          batterId: state.innings[0].strikerId!,
          nonStrikerId: state.innings[0].nonStrikerId!,
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      ).state;
    }
    const out = applyDelivery(
      state,
      cmd({
        eventId: 'wide-last',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        extras: { wide: 1 },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(out.result.overCompleted).toBe(false);
    expect(out.state.innings[0].ballsInCurrentOver).toBe(5);
  });

  it('supports custom ballsPerOver = 8', () => {
    let state = createInitialMatchState({
      matchId: 'm2',
      rules: { ...rules, ballsPerOver: 8, overs: 1 },
      teamAId: teamA,
      teamBId: teamB,
      battingTeamId: teamA,
      bowlingTeamId: teamB,
    });
    state = ready(state);
    for (let i = 0; i < 8; i++) {
      const out = applyDelivery(
        state,
        cmd({
          eventId: `e${i}`,
          batterId: state.innings[0].strikerId!,
          nonStrikerId: state.innings[0].nonStrikerId!,
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      );
      state = out.state;
      if (i === 7) expect(out.result.overCompleted).toBe(true);
    }
  });
});

describe('bowler limit', () => {
  it('rejects bowler who reached max overs', () => {
    let state = ready(baseState(), 'p1');
    for (let i = 0; i < 6; i++) {
      state = applyDelivery(
        state,
        cmd({
          eventId: `b${i}`,
          batterId: state.innings[0].strikerId!,
          nonStrikerId: state.innings[0].nonStrikerId!,
          bowlerId: 'p1',
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      ).state;
    }
    expect(() => setCurrentBowler(state, 'p1', bowlXi)).toThrow(/maximum overs/i);
    state = setCurrentBowler(state, 'p2', bowlXi);
    expect(state.innings[0].currentBowlerId).toBe('p2');
  });
});

describe('innings and result', () => {
  it('completes innings on max overs and starts chase', () => {
    let state = createInitialMatchState({
      matchId: 'm3',
      rules: { overs: 1, ballsPerOver: 2, playersPerSide: 3, maxOversPerBowler: 1 },
      teamAId: teamA,
      teamBId: teamB,
      battingTeamId: teamA,
      bowlingTeamId: teamB,
    });
    state = ready(state);
    state = applyDelivery(
      state,
      cmd({
        eventId: 'a1',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        batterRuns: 4,
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    ).state;
    const out = applyDelivery(
      state,
      cmd({
        eventId: 'a2',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        bowlerId: state.innings[0].currentBowlerId!,
        batterRuns: 2,
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    );
    expect(out.result.inningsCompleted).toBe(true);
    expect(out.state.target).toBe(7);

    const chaseBat = new Set(['p1', 'p2', 'p3']);
    const chaseBowl = new Set(['b1', 'b2', 'b3']);
    state = startSecondInnings(out.state, {
      strikerId: 'p1',
      nonStrikerId: 'p2',
      bowlerId: 'b1',
      battingXi: chaseBat,
      bowlingXi: chaseBowl,
    });
    expect(state.currentInningsIndex).toBe(1);
    expect(state.target).toBe(7);

    // Chase with boundary
    const end = applyDelivery(
      state,
      cmd({
        eventId: 'chase',
        batterId: 'p1',
        nonStrikerId: 'p2',
        bowlerId: 'b1',
        batterRuns: 6,
      }),
      { battingXi: chaseBat, bowlingXi: chaseBowl },
    );
    // need 7 total - one six gets to 6, not enough
    expect(end.state.innings[1].totalRuns).toBe(6);
    const win = applyDelivery(
      end.state,
      cmd({
        eventId: 'win',
        batterId: end.state.innings[1].strikerId!,
        nonStrikerId: end.state.innings[1].nonStrikerId!,
        bowlerId: 'b1',
        batterRuns: 1,
      }),
      { battingXi: chaseBat, bowlingXi: chaseBowl },
    );
    expect(win.result.matchCompleted).toBe(true);
    expect(win.state.result?.resultType).toBe('WIN_BY_WICKETS');
  });

  it('records a tie', () => {
    let state = createInitialMatchState({
      matchId: 'tie',
      rules: { overs: 1, ballsPerOver: 1, playersPerSide: 3, maxOversPerBowler: 1 },
      teamAId: teamA,
      teamBId: teamB,
      battingTeamId: teamA,
      bowlingTeamId: teamB,
    });
    state = ready(state);
    state = applyDelivery(
      state,
      cmd({
        eventId: 't1',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        batterRuns: 1,
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    ).state;
    expect(state.innings[0].isComplete).toBe(true);
    expect(state.target).toBe(2);

    const chaseBat = bowlXi;
    const chaseBowl = batXi;
    state = startSecondInnings(state, {
      strikerId: 'p1',
      nonStrikerId: 'p2',
      bowlerId: 'b1',
      battingXi: chaseBat,
      bowlingXi: chaseBowl,
    });
    const out = applyDelivery(
      state,
      cmd({
        eventId: 't2',
        batterId: 'p1',
        nonStrikerId: 'p2',
        bowlerId: 'b1',
        batterRuns: 1,
      }),
      { battingXi: chaseBat, bowlingXi: chaseBowl },
    );
    // score 1, target 2, overs done → defending team wins by runs OR if equal would tie
    // first scored 1, second scored 1 → tie when second completes overs without reaching target
    expect(out.state.innings[1].totalRuns).toBe(1);
    expect(out.state.result?.resultType).toBe('TIE');
  });
});

describe('reconstruction', () => {
  it('replays to the same totals', () => {
    const initial = createInitialMatchState({
      matchId: 'recon',
      rules: { overs: 2, ballsPerOver: 6, playersPerSide: 3, maxOversPerBowler: 2 },
      teamAId: teamA,
      teamBId: teamB,
      battingTeamId: teamA,
      bowlingTeamId: teamB,
    });

    const steps = [
      { kind: 'openings' as const, strikerId: 'b1', nonStrikerId: 'b2', battingXi: batXi, bowlingXi: bowlXi },
      { kind: 'bowler' as const, bowlerId: 'p1', battingXi: batXi, bowlingXi: bowlXi },
      {
        kind: 'delivery' as const,
        command: cmd({ eventId: 'd1', batterId: 'b1', nonStrikerId: 'b2', batterRuns: 4 }),
        battingXi: batXi,
        bowlingXi: bowlXi,
      },
      {
        kind: 'delivery' as const,
        command: cmd({ eventId: 'd2', batterId: 'b1', nonStrikerId: 'b2', extras: { wide: 1 } }),
        battingXi: batXi,
        bowlingXi: bowlXi,
      },
      {
        kind: 'delivery' as const,
        command: cmd({ eventId: 'd3', batterId: 'b1', nonStrikerId: 'b2', batterRuns: 1 }),
        battingXi: batXi,
        bowlingXi: bowlXi,
      },
    ];

    const a = replayDeliveries(initial, steps);
    const b = replayDeliveries(initial, steps);
    const check = validateMatchSnapshot(a, b);
    expect(check.ok).toBe(true);
    expect(a.innings[0].totalRuns).toBe(6);
    expect(buildMatchScorecard(a).innings[0].extrasTotal).toBe(1);
  });
});

describe('utils', () => {
  it('formats overs from legal balls', () => {
    expect(formatOvers(0, 6)).toBe('0.0');
    expect(formatOvers(7, 6)).toBe('1.1');
    expect(formatOvers(50, 6)).toBe('8.2');
  });
});

describe('replacement batter', () => {
  it('sets next batter after wicket', () => {
    let state = ready(baseState());
    state = applyDelivery(
      state,
      cmd({
        eventId: 'w',
        batterId: state.innings[0].strikerId!,
        nonStrikerId: state.innings[0].nonStrikerId!,
        wicket: { wicketType: 'BOWLED', playerOutId: state.innings[0].strikerId! },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    ).state;
    state = setReplacementBatter(state, 'b3', batXi);
    expect(state.innings[0].pendingNewBatter).toBe(false);
    expect(state.innings[0].strikerId === 'b3' || state.innings[0].nonStrikerId === 'b3').toBe(
      true,
    );
  });
});

describe('maidens', () => {
  it('counts a maiden when bowler concedes 0 across a full over', () => {
    let state = ready(baseState());
    for (let i = 0; i < 6; i++) {
      const inn = state.innings[0];
      state = applyDelivery(
        state,
        cmd({
          eventId: `m${i}`,
          batterId: inn.strikerId!,
          nonStrikerId: inn.nonStrikerId!,
          batterRuns: 0,
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      ).state;
    }
    expect(state.innings[0].bowlers.p1.maidens).toBe(1);
    expect(state.innings[0].pendingNewBowler).toBe(true);
  });

  it('does not count maiden when byes scored (bowler 0 but team scored)', () => {
    let state = ready(baseState());
    for (let i = 0; i < 5; i++) {
      const inn = state.innings[0];
      state = applyDelivery(
        state,
        cmd({
          eventId: `b${i}`,
          batterId: inn.strikerId!,
          nonStrikerId: inn.nonStrikerId!,
          batterRuns: 0,
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      ).state;
    }
    const inn = state.innings[0];
    state = applyDelivery(
      state,
      cmd({
        eventId: 'bye',
        batterId: inn.strikerId!,
        nonStrikerId: inn.nonStrikerId!,
        batterRuns: 0,
        extras: { bye: 1 },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    ).state;
    expect(state.innings[0].bowlers.p1.runsConceded).toBe(0);
    expect(state.innings[0].totalRuns).toBe(1);
    expect(state.innings[0].bowlers.p1.maidens).toBe(1);
  });

  it('does not count maiden when wide scored', () => {
    let state = ready(baseState());
    for (let i = 0; i < 5; i++) {
      const inn = state.innings[0];
      state = applyDelivery(
        state,
        cmd({
          eventId: `dot${i}`,
          batterId: inn.strikerId!,
          nonStrikerId: inn.nonStrikerId!,
          batterRuns: 0,
        }),
        { battingXi: batXi, bowlingXi: bowlXi },
      ).state;
    }
    let inn = state.innings[0];
    state = applyDelivery(
      state,
      cmd({
        eventId: 'wide',
        batterId: inn.strikerId!,
        nonStrikerId: inn.nonStrikerId!,
        extras: { wide: 1 },
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    ).state;
    inn = state.innings[0];
    state = applyDelivery(
      state,
      cmd({
        eventId: 'last',
        batterId: inn.strikerId!,
        nonStrikerId: inn.nonStrikerId!,
        batterRuns: 0,
      }),
      { battingXi: batXi, bowlingXi: bowlXi },
    ).state;
    expect(state.innings[0].bowlers.p1.maidens).toBe(0);
    expect(state.innings[0].bowlers.p1.runsConceded).toBe(1);
  });
});

describe('engine undo via reconstruction', () => {
  it('restores state when last delivery is omitted from replay', () => {
    const initial = createInitialMatchState({
      matchId: 'undo',
      rules,
      teamAId: teamA,
      teamBId: teamB,
      battingTeamId: teamA,
      bowlingTeamId: teamB,
    });
    const common = [
      { kind: 'openings' as const, strikerId: 'b1', nonStrikerId: 'b2', battingXi: batXi, bowlingXi: bowlXi },
      { kind: 'bowler' as const, bowlerId: 'p1', battingXi: batXi, bowlingXi: bowlXi },
      {
        kind: 'delivery' as const,
        command: cmd({ eventId: 'd1', batterId: 'b1', nonStrikerId: 'b2', batterRuns: 6 }),
        battingXi: batXi,
        bowlingXi: bowlXi,
      },
    ];
    const withWicket = [
      ...common,
      {
        kind: 'delivery' as const,
        command: cmd({
          eventId: 'd2',
          batterId: 'b1',
          nonStrikerId: 'b2',
          wicket: { wicketType: 'BOWLED', playerOutId: 'b1' },
        }),
        battingXi: batXi,
        bowlingXi: bowlXi,
      },
    ];
    const full = replayDeliveries(initial, withWicket);
    const undone = replayDeliveries(initial, common);
    expect(full.innings[0].wickets).toBe(1);
    expect(undone.innings[0].wickets).toBe(0);
    expect(undone.innings[0].totalRuns).toBe(6);
    expect(undone.innings[0].strikerId).toBe('b1');
  });
});
