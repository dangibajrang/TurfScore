import mongoose from 'mongoose';
import type { AuthContext } from '../middleware/auth.js';
import { Delivery } from '../models/Delivery.js';
import { Match } from '../models/Match.js';
import { assertOwnerOrAdmin, parseObjectId } from '../utils/authorization.js';
import { AppError } from '../utils/errors.js';
import {
  applyDelivery,
  buildLivePresentation,
  buildMatchScorecard,
  createInitialMatchState,
  CricketEngineError,
  setCurrentBowler,
  setOpeningBatters,
  setReplacementBatter,
  startSecondInnings,
  validateMatchSnapshot,
  type DeliveryCommand,
  type MatchState,
} from './cricket/index.js';
import type { ErrorCode } from '../utils/errors.js';
import type { DeliveryCommandBody } from '../validators/scoring.validators.js';
import { emitAfterScoringMutation } from './liveSharingService.js';
import { SocketEvents } from '../sockets/socket.events.js';

type SetupEvent = {
  kind: 'openings' | 'bowler' | 'replacement' | 'startSecond';
  strikerId?: string;
  nonStrikerId?: string;
  bowlerId?: string;
  nextBatterId?: string;
  atSequence: number;
};

function mapEngineError(err: unknown): never {
  if (err instanceof CricketEngineError) {
    const code = err.code as ErrorCode;
    throw new AppError(err.message, {
      statusCode:
        err.code === 'BOWLER_LIMIT_REACHED' ||
        err.code === 'CONSECUTIVE_OVERS' ||
        err.code === 'MATCH_VERSION_CONFLICT'
          ? 409
          : 400,
      code,
    });
  }
  throw err;
}

async function getOwnedLiveMatch(matchId: string, auth: AuthContext) {
  const match = await Match.findById(parseObjectId(matchId, 'Match'));
  if (!match) throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  assertOwnerOrAdmin(match.createdBy, auth);
  return match;
}

function xiSet(match: InstanceType<typeof Match>, side: 'teamA' | 'teamB'): Set<string> {
  return new Set((match[side].playingXi ?? []).map((p) => String(p.playerId)));
}

function battingBowlingXi(match: InstanceType<typeof Match>, state: MatchState) {
  const inn = state.innings[state.currentInningsIndex];
  const a = String(match.teamA.teamId);
  const battingIsA = inn.battingTeamId === a;
  return {
    battingXi: battingIsA ? xiSet(match, 'teamA') : xiSet(match, 'teamB'),
    bowlingXi: battingIsA ? xiSet(match, 'teamB') : xiSet(match, 'teamA'),
  };
}

function loadState(match: InstanceType<typeof Match>): MatchState {
  const scoring = (match.snapshot as { scoring?: MatchState } | undefined)?.scoring;
  if (scoring) {
    const state = structuredClone(scoring) as MatchState;
    for (const inn of state.innings ?? []) {
      inn.batters = inn.batters ?? {};
      inn.bowlers = inn.bowlers ?? {};
      inn.fallOfWickets = inn.fallOfWickets ?? [];
      inn.partnerships = inn.partnerships ?? [];
      inn.extras = inn.extras ?? { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 };
      inn.lastOverBowlerId = inn.lastOverBowlerId ?? null;
    }
    return state;
  }

  // Bootstrap from Phase 4 start shape
  const inn0 = (match.innings?.[0] ?? {}) as {
    battingTeamId?: string;
    bowlingTeamId?: string;
  };
  return createInitialMatchState({
    matchId: String(match._id),
    rules: {
      overs: match.rules.overs,
      ballsPerOver: match.rules.ballsPerOver,
      playersPerSide: match.rules.playersPerSide,
      maxOversPerBowler: match.rules.maxOversPerBowler ?? undefined,
      powerplayEnabled: match.rules.powerplayEnabled,
      powerplayOvers: match.rules.powerplayOvers ?? undefined,
      superOverEnabled: match.rules.superOverEnabled,
      customRules: match.rules.customRules as Record<string, unknown> | undefined,
    },
    teamAId: String(match.teamA.teamId),
    teamBId: String(match.teamB.teamId),
    battingTeamId: String(inn0.battingTeamId ?? match.teamA.teamId),
    bowlingTeamId: String(inn0.bowlingTeamId ?? match.teamB.teamId),
    version: match.version,
  });
}

function persistState(match: InstanceType<typeof Match>, state: MatchState) {
  state.version = match.version;
  match.innings = state.innings as unknown as typeof match.innings;
  match.status = state.status === 'COMPLETED' ? 'COMPLETED' : match.status;
  if (state.status === 'COMPLETED') {
    match.completedAt = match.completedAt ?? new Date();
    match.resultText = state.result?.resultText ?? match.resultText;
    if (state.result?.winnerTeamId) {
      match.winnerTeamId = parseObjectId(state.result.winnerTeamId, 'Team');
    }
  }
  const prev = (match.snapshot as Record<string, unknown>) ?? {};
  match.snapshot = {
    ...prev,
    currentInningsIndex: state.currentInningsIndex,
    scoring: state,
    scoreSummary: {
      runs: state.innings[state.currentInningsIndex]?.totalRuns ?? 0,
      wickets: state.innings[state.currentInningsIndex]?.wickets ?? 0,
      legalBalls: state.innings[state.currentInningsIndex]?.legalBalls ?? 0,
      target: state.target,
      result: state.result,
    },
  } as typeof match.snapshot;
  match.markModified('snapshot');
  match.markModified('innings');
  const setup = ((match.correctionMeta as { setupEvents?: SetupEvent[] } | undefined)?.setupEvents ??
    []) as SetupEvent[];
  match.correctionMeta = {
    ...(match.correctionMeta as object),
    setupEvents: setup,
  };
  match.markModified('correctionMeta');
}

function pushSetup(match: InstanceType<typeof Match>, event: SetupEvent) {
  const meta = (match.correctionMeta as { setupEvents?: SetupEvent[] } | null) ?? {};
  const list = meta.setupEvents ?? [];
  list.push(event);
  match.correctionMeta = { ...meta, setupEvents: list };
}

function assertVersion(match: InstanceType<typeof Match>, expectedVersion: number) {
  if (match.version !== expectedVersion) {
    throw new AppError('Match version conflict', {
      statusCode: 409,
      code: 'MATCH_VERSION_CONFLICT',
      details: { currentVersion: match.version, expectedVersion },
    });
  }
}

function toCommand(body: DeliveryCommandBody): DeliveryCommand {
  return {
    eventId: body.eventId,
    batterId: body.batterId,
    nonStrikerId: body.nonStrikerId,
    bowlerId: body.bowlerId,
    batterRuns: body.batterRuns,
    extras: body.extras,
    wicket: body.wicket ?? null,
    nextBatterId: body.nextBatterId,
  };
}

export async function getScoringState(auth: AuthContext, matchId: string) {
  const match = await getOwnedLiveMatch(matchId, auth);
  const state = loadState(match);
  const recent = await Delivery.find({
    matchId: match._id,
    isUndone: { $ne: true },
  })
    .sort({ sequence: -1 })
    .limit(24)
    .lean();

  return {
    matchVersion: match.version,
    status: match.status,
    state,
    scorecard: buildMatchScorecard(state),
    presentation: buildLivePresentation(state),
    recentDeliveries: recent.map((d) => ({
      id: String(d._id),
      eventId: d.eventId,
      inningsNumber: d.inningsNumber,
      overNumber: d.overNumber,
      ballNumber: d.ballNumber,
      sequence: d.sequence,
      batterId: String(d.batterId),
      nonStrikerId: String(d.nonStrikerId),
      bowlerId: String(d.bowlerId),
      runs: d.runs,
      extras: d.extras,
      wicket: d.wicket,
      isLegalDelivery: d.isLegalDelivery,
      isCorrection: Boolean(d.isCorrection),
    })),
  };
}

export async function listRecentDeliveries(
  auth: AuthContext,
  matchId: string,
  limit = 12,
) {
  const match = await getOwnedLiveMatch(matchId, auth);
  const items = await Delivery.find({
    matchId: match._id,
    isUndone: { $ne: true },
  })
    .sort({ sequence: -1 })
    .limit(Math.min(50, Math.max(1, limit)))
    .lean();

  return {
    items: items.map((d) => ({
      id: String(d._id),
      eventId: d.eventId,
      inningsNumber: d.inningsNumber,
      overNumber: d.overNumber,
      ballNumber: d.ballNumber,
      sequence: d.sequence,
      batterId: String(d.batterId),
      nonStrikerId: String(d.nonStrikerId),
      bowlerId: String(d.bowlerId),
      runs: d.runs,
      extras: d.extras,
      wicket: d.wicket,
      isLegalDelivery: d.isLegalDelivery,
      isCorrection: Boolean(d.isCorrection),
    })),
  };
}

export async function setOpenings(
  auth: AuthContext,
  matchId: string,
  input: { expectedVersion: number; strikerId: string; nonStrikerId: string },
) {
  const match = await getOwnedLiveMatch(matchId, auth);
  if (match.status !== 'LIVE') {
    throw new AppError('Match is not live', { statusCode: 400, code: 'MATCH_NOT_LIVE' });
  }
  assertVersion(match, input.expectedVersion);
  let state = loadState(match);
  const { battingXi } = battingBowlingXi(match, state);
  try {
    state = setOpeningBatters(state, input.strikerId, input.nonStrikerId, battingXi);
  } catch (e) {
    mapEngineError(e);
  }
  match.version += 1;
  pushSetup(match, {
    kind: 'openings',
    strikerId: input.strikerId,
    nonStrikerId: input.nonStrikerId,
    atSequence: 0,
  });
  persistState(match, state);
  await match.save();
  await emitAfterScoringMutation({
    match,
    state,
    event: SocketEvents.MATCH_STATE_UPDATED,
  });
  return { matchVersion: match.version, state };
}

export async function selectBowler(
  auth: AuthContext,
  matchId: string,
  input: { expectedVersion: number; bowlerId: string },
) {
  const match = await getOwnedLiveMatch(matchId, auth);
  if (match.status !== 'LIVE') {
    throw new AppError('Match is not live', { statusCode: 400, code: 'MATCH_NOT_LIVE' });
  }
  assertVersion(match, input.expectedVersion);
  let state = loadState(match);
  const { bowlingXi } = battingBowlingXi(match, state);
  try {
    state = setCurrentBowler(state, input.bowlerId, bowlingXi);
  } catch (e) {
    mapEngineError(e);
  }
  match.version += 1;
  pushSetup(match, { kind: 'bowler', bowlerId: input.bowlerId, atSequence: 0 });
  persistState(match, state);
  await match.save();
  await emitAfterScoringMutation({
    match,
    state,
    event: SocketEvents.MATCH_STATE_UPDATED,
  });
  return { matchVersion: match.version, state };
}

export async function selectReplacementBatter(
  auth: AuthContext,
  matchId: string,
  input: { expectedVersion: number; nextBatterId: string },
) {
  const match = await getOwnedLiveMatch(matchId, auth);
  if (match.status !== 'LIVE') {
    throw new AppError('Match is not live', { statusCode: 400, code: 'MATCH_NOT_LIVE' });
  }
  assertVersion(match, input.expectedVersion);
  let state = loadState(match);
  const { battingXi } = battingBowlingXi(match, state);
  try {
    state = setReplacementBatter(state, input.nextBatterId, battingXi);
  } catch (e) {
    mapEngineError(e);
  }
  match.version += 1;
  pushSetup(match, {
    kind: 'replacement',
    nextBatterId: input.nextBatterId,
    atSequence: 0,
  });
  persistState(match, state);
  await match.save();
  await emitAfterScoringMutation({
    match,
    state,
    event: SocketEvents.MATCH_STATE_UPDATED,
  });
  return { matchVersion: match.version, state };
}

export async function startNextInnings(
  auth: AuthContext,
  matchId: string,
  input: {
    expectedVersion: number;
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
  },
) {
  const match = await getOwnedLiveMatch(matchId, auth);
  if (match.status !== 'LIVE') {
    throw new AppError('Match is not live', { statusCode: 400, code: 'MATCH_NOT_LIVE' });
  }
  assertVersion(match, input.expectedVersion);
  let state = loadState(match);
  const first = state.innings[0];
  if (!first?.isComplete) {
    throw new AppError('First innings not complete', { statusCode: 400, code: 'INVALID_INNINGS' });
  }
  const battingIsA = first.bowlingTeamId === String(match.teamA.teamId);
  const battingXi = battingIsA ? xiSet(match, 'teamA') : xiSet(match, 'teamB');
  const bowlingXi = battingIsA ? xiSet(match, 'teamB') : xiSet(match, 'teamA');
  try {
    state = startSecondInnings(state, {
      strikerId: input.strikerId,
      nonStrikerId: input.nonStrikerId,
      bowlerId: input.bowlerId,
      battingXi,
      bowlingXi,
    });
  } catch (e) {
    mapEngineError(e);
  }
  match.version += 1;
  pushSetup(match, {
    kind: 'startSecond',
    strikerId: input.strikerId,
    nonStrikerId: input.nonStrikerId,
    bowlerId: input.bowlerId,
    atSequence: 0,
  });
  persistState(match, state);
  await match.save();
  await emitAfterScoringMutation({
    match,
    state,
    event: SocketEvents.INNINGS_STARTED,
  });
  return { matchVersion: match.version, state };
}

export async function recordDelivery(
  auth: AuthContext,
  matchId: string,
  body: DeliveryCommandBody,
) {
  const match = await getOwnedLiveMatch(matchId, auth);
  if (match.status !== 'LIVE') {
    throw new AppError('Match is not live', { statusCode: 400, code: 'MATCH_NOT_LIVE' });
  }

  // Idempotency: return existing
  const existing = await Delivery.findOne({ matchId: match._id, eventId: body.eventId });
  if (existing && !existing.isUndone) {
    const state = loadState(match);
    return {
      duplicate: true,
      matchVersion: match.version,
      delivery: existing,
      state,
      result: null,
      scorecard: buildMatchScorecard(state),
    };
  }

  assertVersion(match, body.expectedVersion);

  let state = loadState(match);
  const { battingXi, bowlingXi } = battingBowlingXi(match, state);
  const last = await Delivery.findOne({ matchId: match._id, isUndone: { $ne: true } })
    .sort({ sequence: -1 })
    .lean();
  const sequence = (last?.sequence ?? 0) + 1;

  let applied;
  try {
    applied = applyDelivery(state, toCommand(body), {
      battingXi,
      bowlingXi,
      sequence,
    });
  } catch (e) {
    mapEngineError(e);
  }

  const d = applied!.result.delivery;
  const payload = {
    eventId: body.eventId,
    matchId: match._id,
    inningsIndex: applied!.state.currentInningsIndex,
    inningsNumber: d.inningsNumber,
    overNumber: d.overNumber,
    ballNumber: d.ballNumber,
    sequence: d.sequence,
    batterId: d.batterId,
    nonStrikerId: d.nonStrikerId,
    bowlerId: d.bowlerId,
    runs: {
      batterRuns: d.batterRuns,
      extrasRuns: d.extrasRuns,
      totalRuns: d.totalRuns,
    },
    extras: d.extras,
    wicket: {
      isWicket: d.wicket.isWicket,
      wicketType: d.wicket.wicketType,
      playerOutId: d.wicket.playerOutId,
      fielderId: d.wicket.fielderId,
      runsCompleted: d.wicket.runsCompleted,
    },
    isLegalDelivery: d.isLegalBall,
    commentary: body.commentary,
    createdBy: auth.id,
  };

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await Delivery.create([payload], { session });
    match.version += 1;
    persistState(match, applied!.state);
    (match.snapshot as { lastEventId?: string }).lastEventId = body.eventId;
    await match.save({ session });
    await session.commitTransaction();
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      /* ignore abort errors when transactions unsupported */
    }

    if ((err as { code?: number }).code === 11000) {
      const dup = await Delivery.findOne({ matchId: match._id, eventId: body.eventId });
      const fresh = await Match.findById(match._id);
      const st = loadState(fresh!);
      return {
        duplicate: true,
        matchVersion: fresh!.version,
        delivery: dup,
        state: st,
        result: null,
        scorecard: buildMatchScorecard(st),
      };
    }

    const msg = String((err as Error)?.message ?? err);
    const transactionsUnsupported =
      msg.includes('Transaction numbers are only allowed') ||
      msg.includes('retryable writes') ||
      msg.includes('does not support retryable writes');

    if (!transactionsUnsupported) throw err;

    // Fallback for standalone Mongo / memory server
    try {
      await Delivery.create(payload);
    } catch (createErr) {
      if ((createErr as { code?: number }).code === 11000) {
        const dup = await Delivery.findOne({ matchId: match._id, eventId: body.eventId });
        const fresh = await Match.findById(match._id);
        return {
          duplicate: true,
          matchVersion: fresh!.version,
          delivery: dup,
          state: loadState(fresh!),
          result: null,
          scorecard: buildMatchScorecard(loadState(fresh!)),
        };
      }
      throw createErr;
    }
    match.version += 1;
    persistState(match, applied!.state);
    (match.snapshot as { lastEventId?: string }).lastEventId = body.eventId;
    await match.save();
  } finally {
    session.endSession();
  }

  const savedDelivery = await Delivery.findOne({ matchId: match._id, eventId: body.eventId });

  await emitAfterScoringMutation({
    match,
    state: applied!.state,
    event: SocketEvents.DELIVERY_RECORDED,
    eventId: body.eventId,
    delivery: savedDelivery
      ? {
          id: String(savedDelivery._id),
          eventId: savedDelivery.eventId,
          overNumber: savedDelivery.overNumber,
          ballNumber: savedDelivery.ballNumber,
          runs: savedDelivery.runs,
          extras: savedDelivery.extras,
          wicket: savedDelivery.wicket,
          isLegalDelivery: savedDelivery.isLegalDelivery,
        }
      : undefined,
    result: applied!.result
      ? {
          isLegalBall: applied!.result.isLegalBall,
          overCompleted: applied!.result.overCompleted,
          inningsCompleted: applied!.result.inningsCompleted,
          matchCompleted: applied!.result.matchCompleted,
          wicket: applied!.result.wicket,
          needsNewBatter: applied!.result.needsNewBatter,
          needsNewBowler: applied!.result.needsNewBowler,
        }
      : undefined,
  });

  return {
    duplicate: false,
    matchVersion: match.version,
    delivery: savedDelivery,
    state: applied!.state,
    result: applied!.result,
    scorecard: buildMatchScorecard(applied!.state),
    presentation: buildLivePresentation(applied!.state),
  };
}

export async function undoLastDelivery(
  auth: AuthContext,
  matchId: string,
  input: { expectedVersion: number },
) {
  const match = await getOwnedLiveMatch(matchId, auth);
  if (match.status !== 'LIVE' && match.status !== 'COMPLETED') {
    throw new AppError('Cannot undo in this match status', { statusCode: 400, code: 'BAD_REQUEST' });
  }
  assertVersion(match, input.expectedVersion);

  const last = await Delivery.findOne({ matchId: match._id, isUndone: { $ne: true } }).sort({
    sequence: -1,
  });
  if (!last) {
    throw new AppError('No delivery to undo', { statusCode: 400, code: 'NO_DELIVERY_TO_UNDO' });
  }

  last.isUndone = true;
  last.audit = {
    ...(last.audit as object),
    undoneBy: auth.id,
    undoneAt: new Date().toISOString(),
  };
  await last.save();

  const rebuilt = await rebuildMatchStateInternal(match);
  match.version += 1;
  if (match.status === 'COMPLETED' && rebuilt.status === 'LIVE') {
    match.status = 'LIVE';
    match.completedAt = undefined;
    match.resultText = undefined;
    match.winnerTeamId = undefined;
  }
  persistState(match, rebuilt);
  await match.save();

  await emitAfterScoringMutation({
    match,
    state: rebuilt,
    event: SocketEvents.DELIVERY_UNDONE,
    eventId: last.eventId,
  });

  const scored = await getScoringState(auth, matchId);
  return {
    ...scored,
    undoneEventId: last.eventId,
  };
}

export async function editDelivery(
  auth: AuthContext,
  matchId: string,
  deliveryId: string,
  body: Omit<DeliveryCommandBody, 'eventId'> & { reason?: string },
) {
  const match = await getOwnedLiveMatch(matchId, auth);
  if (match.status === 'COMPLETED') {
    assertOwnerOrAdmin(match.createdBy, auth);
    // allow admin/owner corrections
  }
  assertVersion(match, body.expectedVersion);

  const delivery = await Delivery.findOne({
    _id: parseObjectId(deliveryId, 'Delivery'),
    matchId: match._id,
  });
  if (!delivery || delivery.isUndone) {
    throw new AppError('Delivery not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const oldSnapshot = {
    runs: delivery.runs,
    extras: delivery.extras,
    wicket: delivery.wicket,
    batterId: delivery.batterId,
    nonStrikerId: delivery.nonStrikerId,
    bowlerId: delivery.bowlerId,
  };

  delivery.batterId = parseObjectId(body.batterId, 'Player');
  delivery.nonStrikerId = parseObjectId(body.nonStrikerId, 'Player');
  delivery.bowlerId = parseObjectId(body.bowlerId, 'Player');
  delivery.runs = {
    batterRuns: body.batterRuns,
    extrasRuns: 0,
    totalRuns: 0,
  };
  delivery.extras = {
    wide: body.extras?.wide ?? 0,
    noBall: body.extras?.noBall ?? 0,
    bye: body.extras?.bye ?? 0,
    legBye: body.extras?.legBye ?? 0,
    penalty: body.extras?.penalty ?? 0,
  };
  delivery.wicket = body.wicket
    ? {
        isWicket: true,
        wicketType: body.wicket.wicketType,
        playerOutId: parseObjectId(body.wicket.playerOutId, 'Player'),
        fielderId: body.wicket.fielderId
          ? parseObjectId(body.wicket.fielderId, 'Player')
          : undefined,
        runsCompleted: body.wicket.runsCompleted,
      }
    : { isWicket: false };
  delivery.isCorrection = true;
  delivery.audit = {
    ...(delivery.audit as object),
    editedBy: auth.id,
    editedAt: new Date().toISOString(),
    reason: body.reason,
    previous: oldSnapshot,
  };
  await delivery.save();

  const rebuilt = await rebuildMatchStateInternal(match);
  match.version += 1;
  persistState(match, rebuilt);
  await match.save();

  await emitAfterScoringMutation({
    match,
    state: rebuilt,
    event: SocketEvents.DELIVERY_UPDATED,
    eventId: delivery.eventId,
    delivery: {
      id: String(delivery._id),
      eventId: delivery.eventId,
      overNumber: delivery.overNumber,
      ballNumber: delivery.ballNumber,
      runs: delivery.runs,
      extras: delivery.extras,
      wicket: delivery.wicket,
      isLegalDelivery: delivery.isLegalDelivery,
    },
  });

  return {
    matchVersion: match.version,
    delivery,
    state: rebuilt,
    scorecard: buildMatchScorecard(rebuilt),
  };
}

async function rebuildMatchStateInternal(
  match: InstanceType<typeof Match>,
): Promise<MatchState> {
  const inn0 = (match.innings?.[0] ?? {}) as {
    battingTeamId?: string;
    bowlingTeamId?: string;
  };
  const base = createInitialMatchState({
    matchId: String(match._id),
    rules: {
      overs: match.rules.overs,
      ballsPerOver: match.rules.ballsPerOver,
      playersPerSide: match.rules.playersPerSide,
      maxOversPerBowler: match.rules.maxOversPerBowler ?? undefined,
      powerplayEnabled: match.rules.powerplayEnabled,
      powerplayOvers: match.rules.powerplayOvers ?? undefined,
      superOverEnabled: match.rules.superOverEnabled,
    },
    teamAId: String(match.teamA.teamId),
    teamBId: String(match.teamB.teamId),
    battingTeamId: String(inn0.battingTeamId ?? match.teamA.teamId),
    bowlingTeamId: String(inn0.bowlingTeamId ?? match.teamB.teamId),
    version: match.version,
  });

  const setupEvents =
    ((match.correctionMeta as { setupEvents?: SetupEvent[] } | undefined)?.setupEvents ?? []).slice();

  const deliveries = await Delivery.find({
    matchId: match._id,
    isUndone: { $ne: true },
  })
    .sort({ sequence: 1 })
    .lean();

  const xiA = xiSet(match, 'teamA');
  const xiB = xiSet(match, 'teamB');
  return rebuildByWalking(match, base, deliveries, setupEvents, xiA, xiB);
}

function rebuildByWalking(
  match: InstanceType<typeof Match>,
  base: MatchState,
  deliveries: Array<Record<string, unknown>>,
  setupEvents: SetupEvent[],
  xiA: Set<string>,
  xiB: Set<string>,
): MatchState {
  let state = structuredClone(base);
  const setups = [...setupEvents];
  const take = (kind: SetupEvent['kind']) => {
    const idx = setups.findIndex((s) => s.kind === kind);
    if (idx < 0) return null;
    return setups.splice(idx, 1)[0];
  };

  // Initial openings + bowler
  const open = take('openings');
  if (open) {
    state = setOpeningBatters(state, open.strikerId!, open.nonStrikerId!, xiA);
  }
  const bowl = take('bowler');
  if (bowl) {
    state = setCurrentBowler(state, bowl.bowlerId!, xiB);
  }

  let seq = 0;
  for (const d of deliveries) {
    const inningsNumber = d.inningsNumber as number;
    if (inningsNumber === 2 && state.currentInningsIndex === 0) {
      const ss = take('startSecond');
      if (ss) {
        state = startSecondInnings(state, {
          strikerId: ss.strikerId!,
          nonStrikerId: ss.nonStrikerId!,
          bowlerId: ss.bowlerId!,
          battingXi: xiB,
          bowlingXi: xiA,
        });
      }
    }

    const inn = state.innings[state.currentInningsIndex];
    if (inn.pendingNewBowler || !inn.bowlerSelected) {
      const b = take('bowler');
      if (b) {
        const bowlingXi = inn.bowlingTeamId === String(match.teamA.teamId) ? xiA : xiB;
        state = setCurrentBowler(state, b.bowlerId!, bowlingXi);
      }
    }
    if (inn.pendingNewBatter) {
      const r = take('replacement');
      if (r) {
        const battingXi = inn.battingTeamId === String(match.teamA.teamId) ? xiA : xiB;
        state = setReplacementBatter(state, r.nextBatterId!, battingXi);
      }
    }

    const battingXi = inningsNumber === 1 ? xiA : xiB;
    const bowlingXi = inningsNumber === 1 ? xiB : xiA;
    const extras = d.extras as {
      wide?: number;
      noBall?: number;
      bye?: number;
      legBye?: number;
      penalty?: number;
    };
    const wicketDoc = d.wicket as {
      isWicket?: boolean;
      wicketType?: string;
      playerOutId?: { toString(): string };
      fielderId?: { toString(): string };
      runsCompleted?: number;
      runsBeforeWicket?: number;
    };
    const runs = d.runs as { batterRuns: number };

    seq += 1;
    const out = applyDelivery(
      state,
      {
        eventId: String(d.eventId),
        batterId: String(d.batterId),
        nonStrikerId: String(d.nonStrikerId),
        bowlerId: String(d.bowlerId),
        batterRuns: runs.batterRuns,
        extras: {
          wide: Number(extras?.wide ?? 0),
          noBall: Number(extras?.noBall ?? 0),
          bye: Number(extras?.bye ?? 0),
          legBye: Number(extras?.legBye ?? 0),
          penalty: Number(extras?.penalty ?? 0),
        },
        wicket: wicketDoc?.isWicket
          ? {
              wicketType: wicketDoc.wicketType as NonNullable<DeliveryCommand['wicket']>['wicketType'],
              playerOutId: String(wicketDoc.playerOutId),
              fielderId: wicketDoc.fielderId ? String(wicketDoc.fielderId) : undefined,
              runsCompleted: wicketDoc.runsCompleted ?? wicketDoc.runsBeforeWicket,
            }
          : null,
      },
      { battingXi, bowlingXi, sequence: seq },
    );
    state = out.state;

    if (out.result.needsNewBatter) {
      const r = take('replacement');
      if (r) {
        state = setReplacementBatter(state, r.nextBatterId!, battingXi);
      }
    }
    if (out.result.needsNewBowler) {
      const b = take('bowler');
      if (b) {
        state = setCurrentBowler(state, b.bowlerId!, bowlingXi);
      }
    }
  }

  return state;
}

export async function rebuildMatchState(auth: AuthContext, matchId: string) {
  const match = await getOwnedLiveMatch(matchId, auth);
  const rebuilt = await rebuildMatchStateInternal(match);
  const stored = loadState(match);
  const comparison = validateMatchSnapshot(stored, rebuilt);
  persistState(match, rebuilt);
  await match.save();
  return { state: rebuilt, comparison, scorecard: buildMatchScorecard(rebuilt) };
}

export async function getScorecard(auth: AuthContext, matchId: string) {
  const match = await getOwnedLiveMatch(matchId, auth);
  const state = loadState(match);
  return buildMatchScorecard(state);
}
