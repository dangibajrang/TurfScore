import type { Server } from 'socket.io';
import { Match } from '../models/Match.js';
import { logger } from '../config/logger.js';
import type { AuthedSocket } from './socket.auth.js';
import { SocketEvents, matchRoom } from './socket.events.js';
import type { MatchJoinPayload } from './socket.types.js';
import { getViewerCount } from './matchBroadcast.js';

export function registerMatchSocketHandlers(io: Server, socket: AuthedSocket): void {
  socket.on(SocketEvents.MATCH_JOIN, async (raw: MatchJoinPayload, ack?: (r: unknown) => void) => {
    try {
      const reply = await handleJoin(io, socket, raw);
      ack?.(reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Join failed';
      const code = (err as { code?: string }).code ?? 'BAD_REQUEST';
      socket.emit(SocketEvents.ERROR, { code, message });
      ack?.({ ok: false, code, message });
    }
  });

  socket.on(SocketEvents.MATCH_LEAVE, async (raw: MatchJoinPayload, ack?: (r: unknown) => void) => {
    const matchId = socket.data.joinedMatchId ?? raw.matchId;
    if (matchId) {
      await socket.leave(matchRoom(matchId));
      socket.data.joinedMatchId = undefined;
      const count = await getViewerCount(matchId);
      io.to(matchRoom(matchId)).emit(SocketEvents.VIEWER_COUNT, { matchId, viewerCount: count });
    }
    ack?.({ ok: true });
  });
}

async function handleJoin(io: Server, socket: AuthedSocket, raw: MatchJoinPayload) {
  const publicMatchId = raw.publicMatchId?.trim();
  const matchId = raw.matchId?.trim();

  let match;
  if (publicMatchId) {
    match = await Match.findOne({ publicMatchId }).select(
      '_id createdBy publicLiveEnabled publicMatchId status name',
    );
    if (!match) {
      return fail('NOT_FOUND', 'Match not found');
    }
    const isOwner =
      socket.data.auth && String(match.createdBy) === socket.data.auth.id;
    const isAdmin = socket.data.auth?.role === 'ADMIN';
    if (!match.publicLiveEnabled && !isOwner && !isAdmin) {
      return fail('FORBIDDEN', 'Live sharing is not enabled for this match');
    }
  } else if (matchId) {
    match = await Match.findById(matchId).select(
      '_id createdBy publicLiveEnabled publicMatchId status name',
    );
    if (!match) {
      return fail('NOT_FOUND', 'Match not found');
    }
    const isOwner =
      socket.data.auth && String(match.createdBy) === socket.data.auth.id;
    const isAdmin = socket.data.auth?.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      if (!match.publicLiveEnabled || !match.publicMatchId) {
        return fail('FORBIDDEN', 'Not authorized to watch this match');
      }
    } else {
      socket.data.role = 'scorer';
    }
  } else {
    return fail('BAD_REQUEST', 'matchId or publicMatchId required');
  }

  const id = String(match._id);
  if (socket.data.joinedMatchId && socket.data.joinedMatchId !== id) {
    await socket.leave(matchRoom(socket.data.joinedMatchId));
  }

  await socket.join(matchRoom(id));
  socket.data.joinedMatchId = id;

  const viewerCount = await getViewerCount(id);
  io.to(matchRoom(id)).emit(SocketEvents.VIEWER_COUNT, { matchId: id, viewerCount });

  const joined = {
    ok: true,
    matchId: id,
    publicMatchId: match.publicMatchId ?? null,
    status: match.status,
    viewerCount,
    role: socket.data.role,
  };
  socket.emit(SocketEvents.MATCH_JOINED, joined);
  logger.debug({ socketId: socket.id, matchId: id, role: socket.data.role }, 'Joined match room');
  return joined;
}

function fail(code: string, message: string) {
  return { ok: false, code, message };
}
