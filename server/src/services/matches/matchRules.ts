import { AppError } from '../../utils/errors.js';

export type MatchRulesInput = {
  overs: number;
  ballsPerOver: number;
  playersPerSide: number;
  maxOversPerBowler?: number;
  powerplayEnabled?: boolean;
  powerplayOvers?: number;
  superOverEnabled?: boolean;
  customRules?: Record<string, unknown>;
};

/** Sensible default: ~1/5 of total overs (10→2, 20→4). */
export function defaultMaxOversPerBowler(overs: number): number {
  if (!Number.isFinite(overs) || overs < 1) return 1;
  return Math.max(1, Math.ceil(overs / 5));
}

export type RulePresetId = '5' | '6' | '8' | '10' | '12' | '15' | '20';

export function buildRulePreset(id: RulePresetId): MatchRulesInput {
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

export function validateMatchRules(rules: MatchRulesInput): MatchRulesInput {
  if (!Number.isInteger(rules.overs) || rules.overs < 1 || rules.overs > 50) {
    throw new AppError('Overs must be an integer between 1 and 50', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (
    !Number.isInteger(rules.ballsPerOver) ||
    rules.ballsPerOver < 1 ||
    rules.ballsPerOver > 12
  ) {
    throw new AppError('Balls per over must be an integer between 1 and 12', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (
    !Number.isInteger(rules.playersPerSide) ||
    rules.playersPerSide < 2 ||
    rules.playersPerSide > 15
  ) {
    throw new AppError('Players per side must be an integer between 2 and 15', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const maxOversPerBowler =
    rules.maxOversPerBowler ?? defaultMaxOversPerBowler(rules.overs);
  if (
    !Number.isInteger(maxOversPerBowler) ||
    maxOversPerBowler < 1 ||
    maxOversPerBowler > rules.overs
  ) {
    throw new AppError('Max overs per bowler must be between 1 and total overs', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const powerplayEnabled = Boolean(rules.powerplayEnabled);
  let powerplayOvers = rules.powerplayOvers ?? 0;
  if (powerplayEnabled) {
    if (!Number.isInteger(powerplayOvers) || powerplayOvers < 1) {
      throw new AppError('Powerplay overs must be at least 1 when enabled', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    if (powerplayOvers > rules.overs) {
      throw new AppError('Powerplay overs cannot exceed match overs', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
  } else {
    powerplayOvers = 0;
  }

  return {
    overs: rules.overs,
    ballsPerOver: rules.ballsPerOver,
    playersPerSide: rules.playersPerSide,
    maxOversPerBowler,
    powerplayEnabled,
    powerplayOvers,
    superOverEnabled: Boolean(rules.superOverEnabled),
    customRules: rules.customRules,
  };
}
