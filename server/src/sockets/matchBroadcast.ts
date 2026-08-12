import type { Server } from 'socket.io';
import { logger } from '../config/logger.js';
import type { LivePresentation, MatchScorecard } from '../services/cricket/scorecard.js';
import type { MatchState } from '../services/cricket/types.js';
import { SocketEvents, matchRoom } from './socket.events.js';
import { toPublicLiveState, type MatchRealtimePayload } from './socket.types.js';

let io: Server | null = null;

export function setIo(server: Server | null): void {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export async function getViewerCount(matchId: string): Promise<number> {
  if (!io) return 0;
  const room = matchRoom(matchId);
  const sockets = await io.in(room).fetchSockets();
  return sockets.length;
}

type BroadcastInput = {
  matchId: string;
  publicMatchId?: string | null;
  event: string;
  version: number;
  state: MatchState;
  presentation: LivePresentation;
  eventId?: string;
  delivery?: unknown;
  result?: MatchRealtimePayload['result'];
  resultText?: string | null;
  scorecard?: MatchScorecard;
  /** When false, skip the companion MATCH_STATE_UPDATED emit */
  alsoStateUpdate?: boolean;
};

export async function broadcastMatchEvent(input: BroadcastInput): Promise<void> {
  if (!io) return;

  const viewerCount = await getViewerCount(input.matchId);
  const payload: MatchRealtimePayload = {
    matchId: input.matchId,
    publicMatchId: input.publicMatchId ?? null,
    eventId: input.eventId,
    version: input.version,
    event: input.event,
    state: toPublicLiveState(input.state, input.presentation),
    presentation: input.presentation,
    scorecard: input.scorecard,
    delivery: input.delivery,
    result: input.result,
    resultText: input.resultText,
    timestamp: new Date().toISOString(),
    viewerCount,
  };

  try {
    io.to(matchRoom(input.matchId)).emit(input.event, payload);
    if (
      input.alsoStateUpdate !== false &&
      input.event !== SocketEvents.MATCH_STATE_UPDATED
    ) {
      io.to(matchRoom(input.matchId)).emit(SocketEvents.MATCH_STATE_UPDATED, payload);
    }
  } catch (err) {
    logger.error({ err, matchId: input.matchId, event: input.event }, 'Socket broadcast failed');
  }
}

export async function broadcastLiveSharingDisabled(matchId: string): Promise<void> {
  if (!io) return;
  io.to(matchRoom(matchId)).emit(SocketEvents.LIVE_SHARING_DISABLED, {
    matchId,
    timestamp: new Date().toISOString(),
  });
  // Kick anonymous viewers from the room
  const sockets = await io.in(matchRoom(matchId)).fetchSockets();
  for (const s of sockets) {
    const role = (s.data as { role?: string }).role;
    if (role !== 'scorer') {
      s.leave(matchRoom(matchId));
    }
  }
}
