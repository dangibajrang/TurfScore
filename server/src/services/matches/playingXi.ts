import { Types } from 'mongoose';
import { AppError } from '../../utils/errors.js';
import type { MATCH_PLAYER_ROLES } from '../../models/Match.js';

export type PlayingXiEntryInput = {
  playerId: string;
  role?: (typeof MATCH_PLAYER_ROLES)[number];
  battingOrder: number;
  isWicketKeeper?: boolean;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
};

export type PlayingXiValidationContext = {
  teamId: string;
  playersPerSide: number;
  /** Active roster player ids for this team */
  rosterPlayerIds: Set<string>;
  /** Active player ids among candidates */
  activePlayerIds: Set<string>;
  teamLabel: string;
};

export function validatePlayingXI(
  entries: PlayingXiEntryInput[] | undefined,
  ctx: PlayingXiValidationContext,
  options: { required: boolean },
): PlayingXiEntryInput[] {
  const list = entries ?? [];
  if (!options.required && list.length === 0) return [];

  if (options.required && list.length !== ctx.playersPerSide) {
    throw new AppError(
      `${ctx.teamLabel} must select exactly ${ctx.playersPerSide} players (got ${list.length})`,
      { statusCode: 400, code: 'VALIDATION_ERROR' },
    );
  }

  if (!options.required && list.length > ctx.playersPerSide) {
    throw new AppError(
      `${ctx.teamLabel} cannot select more than ${ctx.playersPerSide} players`,
      { statusCode: 400, code: 'VALIDATION_ERROR' },
    );
  }

  const seen = new Set<string>();
  const orders = new Set<number>();
  let wkCount = 0;
  let captainCount = 0;
  let viceCount = 0;

  for (const entry of list) {
    if (!Types.ObjectId.isValid(entry.playerId)) {
      throw new AppError(`Invalid player id in ${ctx.teamLabel} XI`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    if (seen.has(entry.playerId)) {
      throw new AppError(`Duplicate player in ${ctx.teamLabel} playing XI`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    seen.add(entry.playerId);

    if (!ctx.rosterPlayerIds.has(entry.playerId)) {
      throw new AppError(`Player does not belong to ${ctx.teamLabel}`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    if (!ctx.activePlayerIds.has(entry.playerId)) {
      throw new AppError(`Inactive player cannot be selected for ${ctx.teamLabel}`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    if (
      !Number.isInteger(entry.battingOrder) ||
      entry.battingOrder < 1 ||
      entry.battingOrder > ctx.playersPerSide
    ) {
      throw new AppError(`Invalid batting order for ${ctx.teamLabel}`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    if (orders.has(entry.battingOrder)) {
      throw new AppError(`Duplicate batting order in ${ctx.teamLabel}`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    orders.add(entry.battingOrder);

    if (entry.isWicketKeeper) wkCount += 1;
    if (entry.isCaptain) captainCount += 1;
    if (entry.isViceCaptain) viceCount += 1;
  }

  if (options.required && orders.size !== ctx.playersPerSide) {
    throw new AppError(`Batting order must include every ${ctx.teamLabel} player exactly once`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (wkCount > 1) {
    throw new AppError(`${ctx.teamLabel} can have at most one wicketkeeper`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (captainCount > 1 || viceCount > 1) {
    throw new AppError(`${ctx.teamLabel} captain/vice captain designation is invalid`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const captain = list.find((e) => e.isCaptain);
  const vice = list.find((e) => e.isViceCaptain);
  if (captain && vice && captain.playerId === vice.playerId) {
    throw new AppError(`${ctx.teamLabel} captain and vice captain must differ`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return [...list].sort((a, b) => a.battingOrder - b.battingOrder);
}

export type TossInput = {
  wonByTeamId: string;
  decision: 'BAT' | 'BOWL';
};

export function validateToss(
  toss: TossInput | undefined,
  teamAId: string,
  teamBId: string,
  options: { required: boolean },
): TossInput | undefined {
  if (!toss) {
    if (options.required) {
      throw new AppError('Toss is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    return undefined;
  }
  if (!toss.wonByTeamId || !toss.decision) {
    throw new AppError('Toss requires a winner and decision', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (toss.decision !== 'BAT' && toss.decision !== 'BOWL') {
    throw new AppError('Toss decision must be BAT or BOWL', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (toss.wonByTeamId !== teamAId && toss.wonByTeamId !== teamBId) {
    throw new AppError('Toss winner must be one of the match teams', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  return toss;
}

export function deriveInningsTeams(
  teamAId: string,
  teamBId: string,
  toss: TossInput,
): { battingTeamId: string; bowlingTeamId: string } {
  const winnerBats = toss.decision === 'BAT';
  const battingTeamId = winnerBats
    ? toss.wonByTeamId
    : toss.wonByTeamId === teamAId
      ? teamBId
      : teamAId;
  const bowlingTeamId = battingTeamId === teamAId ? teamBId : teamAId;
  return { battingTeamId, bowlingTeamId };
}
