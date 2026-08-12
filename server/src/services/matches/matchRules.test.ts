import { describe, expect, it } from 'vitest';
import {
  buildRulePreset,
  defaultMaxOversPerBowler,
  validateMatchRules,
} from './matchRules.js';
import {
  deriveInningsTeams,
  validatePlayingXI,
  validateToss,
} from './playingXi.js';
import { AppError } from '../../utils/errors.js';

describe('matchRules helpers', () => {
  it('defaults max overs per bowler from format', () => {
    expect(defaultMaxOversPerBowler(10)).toBe(2);
    expect(defaultMaxOversPerBowler(20)).toBe(4);
    expect(defaultMaxOversPerBowler(5)).toBe(1);
  });

  it('builds presets', () => {
    const ten = buildRulePreset('10');
    expect(ten.overs).toBe(10);
    expect(ten.maxOversPerBowler).toBe(2);
    expect(ten.ballsPerOver).toBe(6);
  });

  it('rejects powerplay greater than overs', () => {
    expect(() =>
      validateMatchRules({
        overs: 10,
        ballsPerOver: 6,
        playersPerSide: 11,
        powerplayEnabled: true,
        powerplayOvers: 12,
      }),
    ).toThrow(AppError);
  });

  it('normalizes valid rules', () => {
    const rules = validateMatchRules({
      overs: 10,
      ballsPerOver: 6,
      playersPerSide: 8,
    });
    expect(rules.maxOversPerBowler).toBe(2);
    expect(rules.powerplayEnabled).toBe(false);
  });
});

describe('playing XI + toss', () => {
  const roster = new Set(['a', 'b']);
  const active = new Set(['a', 'b']);

  it('requires exact count', () => {
    expect(() =>
      validatePlayingXI([{ playerId: 'aaaaaaaaaaaaaaaaaaaaaaaa', battingOrder: 1 }], {
        teamId: 't',
        playersPerSide: 2,
        rosterPlayerIds: new Set(['aaaaaaaaaaaaaaaaaaaaaaaa']),
        activePlayerIds: new Set(['aaaaaaaaaaaaaaaaaaaaaaaa']),
        teamLabel: 'Team A',
      }, { required: true }),
    ).toThrow(/exactly 2/);
  });

  it('validates toss winner belongs to match', () => {
    expect(() =>
      validateToss(
        { wonByTeamId: 'c', decision: 'BAT' },
        'a',
        'b',
        { required: true },
      ),
    ).toThrow(/Toss winner/);
  });

  it('derives batting team from toss', () => {
    expect(deriveInningsTeams('a', 'b', { wonByTeamId: 'a', decision: 'BAT' })).toEqual({
      battingTeamId: 'a',
      bowlingTeamId: 'b',
    });
    expect(deriveInningsTeams('a', 'b', { wonByTeamId: 'a', decision: 'BOWL' })).toEqual({
      battingTeamId: 'b',
      bowlingTeamId: 'a',
    });
  });

  it('accepts valid XI', () => {
    const id1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const result = validatePlayingXI(
      [
        { playerId: id1, battingOrder: 2, isWicketKeeper: true },
        { playerId: id2, battingOrder: 1, isCaptain: true },
      ],
      {
        teamId: 't',
        playersPerSide: 2,
        rosterPlayerIds: new Set([id1, id2]),
        activePlayerIds: new Set([id1, id2]),
        teamLabel: 'Team A',
      },
      { required: true },
    );
    expect(result[0].battingOrder).toBe(1);
    expect(result[1].isWicketKeeper).toBe(true);
  });
});
