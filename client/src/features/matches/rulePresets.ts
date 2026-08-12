/** Sensible default: ~1/5 of total overs (10→2, 20→4). */
export function defaultMaxOversPerBowler(overs: number): number {
  if (!Number.isFinite(overs) || overs < 1) return 1;
  return Math.max(1, Math.ceil(overs / 5));
}

export type RulePresetId = '5' | '6' | '8' | '10' | '12' | '15' | '20';

export function buildRulePreset(id: RulePresetId) {
  const overs = Number(id);
  return {
    overs,
    ballsPerOver: 6,
    playersPerSide: 11,
    maxOversPerBowler: defaultMaxOversPerBowler(overs),
    powerplayEnabled: overs >= 10,
    powerplayOvers: overs >= 20 ? 6 : overs >= 10 ? 2 : 0,
    superOverEnabled: false,
  };
}

export const OVER_PRESETS: RulePresetId[] = ['5', '6', '8', '10', '12', '15', '20'];
export const PLAYERS_PER_SIDE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
