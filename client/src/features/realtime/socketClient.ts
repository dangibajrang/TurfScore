import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/apiClient';
import { getApiBaseUrl } from '@/lib/api';

let socket: Socket | null = null;

/** Resolve Socket.IO base URL (same origin proxy or absolute API). */
export function getSocketUrl(): string {
  const base = getApiBaseUrl();
  if (base) return base;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://127.0.0.1:15190';
}

/**
 * Singleton Socket.IO client. Auth token is refreshed on each connect attempt.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(getSocketUrl(), {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: (cb) => {
      cb({ token: getAccessToken() ?? undefined });
    },
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
