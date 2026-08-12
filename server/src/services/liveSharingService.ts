import type { AuthContext } from '../middleware/auth.js';
import { Match } from '../models/Match.js';
import { assertOwnerOrAdmin, parseObjectId } from '../utils/authorization.js';
import { AppError } from '../utils/errors.js';
import { generatePublicMatchId } from '../utils/publicMatchId.js';
import { loadEnv } from '../config/env.js';
import {
  broadcastLiveSharingDisabled,
  broadcastMatchEvent,
} from '../sockets/matchBroadcast.js';
import { SocketEvents } from '../sockets/socket.events.js';
import {
  buildLivePresentation,
  buildMatchScorecard,
} from './cricket/scorecard.js';
import { createInitialMatchState, type MatchState } from './cricket/index.js';

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
    }
    return state;
  }
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
    },
    teamAId: String(match.teamA.teamId),
    teamBId: String(match.teamB.teamId),
    battingTeamId: String(inn0.battingTeamId ?? match.teamA.teamId),
    bowlingTeamId: String(inn0.bowlingTeamId ?? match.teamB.teamId),
    version: match.version,
  });
}

export async function enableLiveSharing(auth: AuthContext, matchId: string) {
  const match = await Match.findById(parseObjectId(matchId, 'Match'));
  if (!match) throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  assertOwnerOrAdmin(match.createdBy, auth);

  if (!['LIVE', 'COMPLETED'].includes(match.status)) {
    throw new AppError('Live sharing is only available for live or completed matches', {
      statusCode: 400,
      code: 'BAD_REQUEST',
    });
  }

  if (!match.publicMatchId) {
    for (let i = 0; i < 5; i++) {
      const candidate = generatePublicMatchId();
      const exists = await Match.exists({ publicMatchId: candidate });
      if (!exists) {
        match.publicMatchId = candidate;
        break;
      }
    }
    if (!match.publicMatchId) {
      throw new AppError('Could not allocate public match id', {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
      });
    }
  }

  match.publicLiveEnabled = true;
  match.publicLiveEnabledAt = new Date();
  await match.save();

  const env = loadEnv();
  const publicPath = `/live/${match.publicMatchId}`;
  return {
    publicMatchId: match.publicMatchId,
    publicLiveEnabled: true,
    publicUrl: `${env.CLIENT_URL}${publicPath}`,
    publicPath,
  };
}

export async function disableLiveSharing(auth: AuthContext, matchId: string) {
  const match = await Match.findById(parseObjectId(matchId, 'Match'));
  if (!match) throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  assertOwnerOrAdmin(match.createdBy, auth);

  match.publicLiveEnabled = false;
  await match.save();
  await broadcastLiveSharingDisabled(String(match._id));

  return {
    publicMatchId: match.publicMatchId ?? null,
    publicLiveEnabled: false,
  };
}

export async function getLiveSharing(auth: AuthContext, matchId: string) {
  const match = await Match.findById(parseObjectId(matchId, 'Match'));
  if (!match) throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  assertOwnerOrAdmin(match.createdBy, auth);
  const env = loadEnv();
  const publicPath = match.publicMatchId ? `/live/${match.publicMatchId}` : null;
  return {
    publicMatchId: match.publicMatchId ?? null,
    publicLiveEnabled: Boolean(match.publicLiveEnabled),
    publicUrl: publicPath ? `${env.CLIENT_URL}${publicPath}` : null,
    publicPath,
  };
}

export async function getPublicMatchByPublicId(publicMatchId: string) {
  const match = await Match.findOne({ publicMatchId: publicMatchId.trim().toUpperCase() });
  if (!match) {
    throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (!match.publicLiveEnabled) {
    throw new AppError('This live score is no longer publicly available', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const { Team } = await import('../models/Team.js');
  const { Player } = await import('../models/Player.js');
  const { Delivery } = await import('../models/Delivery.js');

  const teams = await Team.find({
    _id: { $in: [match.teamA.teamId, match.teamB.teamId] },
  }).lean();
  const teamMap = new Map(teams.map((t) => [String(t._id), t]));

  const playerIds = [
    ...(match.teamA.playingXi ?? []).map((e) => e.playerId),
    ...(match.teamB.playingXi ?? []).map((e) => e.playerId),
  ];
  const players = await Player.find({ _id: { $in: playerIds } }).lean();
  const playerMap = new Map(players.map((p) => [String(p._id), p.name]));

  const mapSide = (side: 'teamA' | 'teamB') => {
    const block = match[side];
    const meta = teamMap.get(String(block.teamId));
    return {
      teamId: String(block.teamId),
      teamName: meta?.name ?? null,
      teamShortName: meta?.shortName ?? null,
      playingXi: (block.playingXi ?? []).map((e) => ({
        playerId: String(e.playerId),
        playerName: playerMap.get(String(e.playerId)) ?? null,
        role: e.role ?? null,
        battingOrder: e.battingOrder,
        isWicketKeeper: Boolean(e.isWicketKeeper),
        isCaptain: Boolean(e.isCaptain),
        isViceCaptain: Boolean(e.isViceCaptain),
      })),
    };
  };

  const state = loadState(match);
  const presentation = buildLivePresentation(state);
  const scorecard = buildMatchScorecard(state);

  const recent = await Delivery.find({
    matchId: match._id,
    isUndone: { $ne: true },
  })
    .sort({ sequence: -1 })
    .limit(24)
    .lean();

  return {
    live: true,
    publicMatchId: match.publicMatchId,
    matchId: String(match._id),
    name: match.name,
    status: match.status,
    venue: match.venue ?? null,
    version: match.version,
    lastUpdatedAt: match.updatedAt.toISOString(),
    resultText: match.resultText ?? state.result?.resultText ?? null,
    rules: {
      overs: match.rules.overs,
      ballsPerOver: match.rules.ballsPerOver,
      playersPerSide: match.rules.playersPerSide,
    },
    teamA: mapSide('teamA'),
    teamB: mapSide('teamB'),
    state,
    presentation,
    scorecard,
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
    })),
  };
}

export async function getPublicScorecard(publicMatchId: string) {
  const data = await getPublicMatchByPublicId(publicMatchId);
  return {
    publicMatchId: data.publicMatchId,
    matchId: data.matchId,
    name: data.name,
    status: data.status,
    resultText: data.resultText,
    teamA: data.teamA,
    teamB: data.teamB,
    scorecard: data.scorecard,
    version: data.version,
    lastUpdatedAt: data.lastUpdatedAt,
  };
}

/** Helper for scoringService broadcasts after DB commit */
export async function emitAfterScoringMutation(opts: {
  match: InstanceType<typeof Match>;
  state: MatchState;
  event: string;
  eventId?: string;
  delivery?: unknown;
  result?: {
    isLegalBall?: boolean;
    overCompleted?: boolean;
    inningsCompleted?: boolean;
    matchCompleted?: boolean;
    wicket?: boolean;
    needsNewBatter?: boolean;
    needsNewBowler?: boolean;
  };
}) {
  const presentation = buildLivePresentation(opts.state);
  const scorecard = buildMatchScorecard(opts.state);
  await broadcastMatchEvent({
    matchId: String(opts.match._id),
    publicMatchId: opts.match.publicMatchId ?? null,
    event: opts.event,
    version: opts.match.version,
    state: opts.state,
    presentation,
    scorecard,
    eventId: opts.eventId,
    delivery: opts.delivery,
    result: opts.result,
    resultText: opts.state.result?.resultText ?? opts.match.resultText,
  });

  // Secondary semantic events (no duplicate MATCH_STATE_UPDATED)
  if (opts.result?.wicket) {
    await broadcastMatchEvent({
      matchId: String(opts.match._id),
      publicMatchId: opts.match.publicMatchId ?? null,
      event: SocketEvents.WICKET_RECORDED,
      version: opts.match.version,
      state: opts.state,
      presentation,
      eventId: opts.eventId,
      result: opts.result,
      alsoStateUpdate: false,
    });
  }
  if (opts.result?.overCompleted) {
    await broadcastMatchEvent({
      matchId: String(opts.match._id),
      publicMatchId: opts.match.publicMatchId ?? null,
      event: SocketEvents.OVER_COMPLETED,
      version: opts.match.version,
      state: opts.state,
      presentation,
      eventId: opts.eventId,
      result: opts.result,
      alsoStateUpdate: false,
    });
  }
  if (opts.result?.inningsCompleted) {
    await broadcastMatchEvent({
      matchId: String(opts.match._id),
      publicMatchId: opts.match.publicMatchId ?? null,
      event: SocketEvents.INNINGS_COMPLETED,
      version: opts.match.version,
      state: opts.state,
      presentation,
      eventId: opts.eventId,
      result: opts.result,
      alsoStateUpdate: false,
    });
  }
  if (opts.result?.matchCompleted) {
    await broadcastMatchEvent({
      matchId: String(opts.match._id),
      publicMatchId: opts.match.publicMatchId ?? null,
      event: SocketEvents.MATCH_COMPLETED,
      version: opts.match.version,
      state: opts.state,
      presentation,
      eventId: opts.eventId,
      result: opts.result,
      resultText: opts.state.result?.resultText ?? opts.match.resultText,
      alsoStateUpdate: false,
    });
  }
}
