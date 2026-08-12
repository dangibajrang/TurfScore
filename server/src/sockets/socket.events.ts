/** Typed Socket.IO event names — keep in sync with client. */
export const SocketEvents = {
  // Client → server
  MATCH_JOIN: 'MATCH_JOIN',
  MATCH_LEAVE: 'MATCH_LEAVE',

  // Server → client
  MATCH_JOINED: 'MATCH_JOINED',
  MATCH_STARTED: 'MATCH_STARTED',
  DELIVERY_RECORDED: 'DELIVERY_RECORDED',
  DELIVERY_UPDATED: 'DELIVERY_UPDATED',
  DELIVERY_UNDONE: 'DELIVERY_UNDONE',
  WICKET_RECORDED: 'WICKET_RECORDED',
  OVER_COMPLETED: 'OVER_COMPLETED',
  INNINGS_COMPLETED: 'INNINGS_COMPLETED',
  INNINGS_STARTED: 'INNINGS_STARTED',
  MATCH_COMPLETED: 'MATCH_COMPLETED',
  MATCH_STATE_UPDATED: 'MATCH_STATE_UPDATED',
  LIVE_SHARING_DISABLED: 'LIVE_SHARING_DISABLED',
  VIEWER_COUNT: 'VIEWER_COUNT',
  ERROR: 'SOCKET_ERROR',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

export function matchRoom(matchId: string): string {
  return `match:${matchId}`;
}
