import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from './socketClient';
import {
  SocketEvents,
  type ConnectionStatus,
  type MatchRealtimePayload,
} from './socketEvents';

type JoinTarget =
  | { matchId: string; publicMatchId?: never }
  | { publicMatchId: string; matchId?: never };

type Options = {
  enabled?: boolean;
  /** Current local version — used to ignore stale / duplicate events */
  localVersion: number;
  /** eventIds already applied via HTTP (scorer dedupe) */
  knownEventIds?: Set<string>;
  onPayload: (payload: MatchRealtimePayload) => void;
  onVersionGap: (payload: MatchRealtimePayload) => void;
  onSharingDisabled?: () => void;
  onReconnect?: () => void;
};

export function useMatchRealtime(target: JoinTarget | null, options: Options) {
  const {
    enabled = true,
    localVersion,
    knownEventIds,
    onPayload,
    onVersionGap,
    onSharingDisabled,
    onReconnect,
  } = options;

  const matchId = target?.matchId;
  const publicMatchId = target?.publicMatchId;
  const active = Boolean(enabled && target && (matchId || publicMatchId));
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const localVersionRef = useRef(localVersion);
  const knownRef = useRef(knownEventIds);
  const onPayloadRef = useRef(onPayload);
  const onGapRef = useRef(onVersionGap);
  const onDisabledRef = useRef(onSharingDisabled);
  const onReconnectRef = useRef(onReconnect);
  const wasConnected = useRef(false);

  useEffect(() => {
    localVersionRef.current = localVersion;
    knownRef.current = knownEventIds;
    onPayloadRef.current = onPayload;
    onGapRef.current = onVersionGap;
    onDisabledRef.current = onSharingDisabled;
    onReconnectRef.current = onReconnect;
  }, [
    localVersion,
    knownEventIds,
    onPayload,
    onVersionGap,
    onSharingDisabled,
    onReconnect,
  ]);

  const handlePayload = useCallback((payload: MatchRealtimePayload) => {
    if (payload.eventId && knownRef.current?.has(payload.eventId)) {
      return;
    }
    if (payload.version < localVersionRef.current) {
      return;
    }
    if (payload.version === localVersionRef.current) {
      // Same version — ignore duplicate broadcast of current state
      return;
    }
    if (payload.version > localVersionRef.current + 1) {
      onGapRef.current(payload);
      return;
    }
    setLastUpdatedAt(payload.timestamp);
    if (typeof payload.viewerCount === 'number') {
      setViewerCount(payload.viewerCount);
    }
    onPayloadRef.current(payload);
  }, []);

  useEffect(() => {
    if (!active || (!matchId && !publicMatchId)) {
      return;
    }

    const joinPayload = matchId ? { matchId } : { publicMatchId: publicMatchId! };
    const leavePayload = joinPayload;

    const socket: Socket = getSocket();

    const onConnect = () => {
      setConnStatus('connected');
      if (wasConnected.current) {
        onReconnectRef.current?.();
      }
      wasConnected.current = true;
      socket.emit(
        SocketEvents.MATCH_JOIN,
        joinPayload,
        (ack: { ok?: boolean; viewerCount?: number; code?: string; message?: string }) => {
          if (ack?.ok === false) {
            setConnStatus('error');
            return;
          }
          if (typeof ack?.viewerCount === 'number') setViewerCount(ack.viewerCount);
        },
      );
    };

    const onDisconnect = () => setConnStatus('disconnected');
    const onReconnectAttempt = () => setConnStatus('reconnecting');
    const onConnectError = () => setConnStatus('error');

    const events = [
      SocketEvents.MATCH_STATE_UPDATED,
      SocketEvents.DELIVERY_RECORDED,
      SocketEvents.DELIVERY_UPDATED,
      SocketEvents.DELIVERY_UNDONE,
      SocketEvents.MATCH_STARTED,
      SocketEvents.MATCH_COMPLETED,
      SocketEvents.INNINGS_STARTED,
      SocketEvents.INNINGS_COMPLETED,
      SocketEvents.OVER_COMPLETED,
      SocketEvents.WICKET_RECORDED,
    ] as const;

    for (const ev of events) {
      socket.on(ev, handlePayload);
    }

    socket.on(SocketEvents.VIEWER_COUNT, (p: { viewerCount?: number }) => {
      if (typeof p.viewerCount === 'number') setViewerCount(p.viewerCount);
    });

    socket.on(SocketEvents.LIVE_SHARING_DISABLED, () => {
      onDisabledRef.current?.();
    });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('connect_error', onConnectError);

    if (!socket.connected) socket.connect();
    else onConnect();

    return () => {
      socket.emit(SocketEvents.MATCH_LEAVE, leavePayload);
      for (const ev of events) socket.off(ev, handlePayload);
      socket.off(SocketEvents.VIEWER_COUNT);
      socket.off(SocketEvents.LIVE_SHARING_DISABLED);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('connect_error', onConnectError);
    };
  }, [active, matchId, publicMatchId, handlePayload]);

  return {
    status: (active ? connStatus : 'idle') as ConnectionStatus,
    viewerCount,
    lastUpdatedAt,
  };
}
