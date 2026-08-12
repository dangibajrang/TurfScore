import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';
import { verifyAccessToken } from '../services/auth/tokens.js';
import { getUserById } from '../services/auth/authService.js';
import type { AuthContext } from '../middleware/auth.js';
import { registerMatchSocketHandlers } from './match.socket.js';
import { setIo } from './matchBroadcast.js';

export type AuthedSocket = Socket & {
  data: {
    auth?: AuthContext;
    role: 'scorer' | 'viewer';
    joinedMatchId?: string;
  };
};

export function initSocketIO(httpServer: HttpServer): Server {
  const env = loadEnv();
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
    // Single-node for Render; Redis adapter can attach later without changing room API
    transports: ['websocket', 'polling'],
  });

  setIo(io);

  io.use(async (socket, next) => {
    const s = socket as AuthedSocket;
    s.data.role = 'viewer';
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        extractBearer(socket.handshake.headers.authorization);
      if (token) {
        const payload = verifyAccessToken(token);
        await getUserById(payload.sub);
        s.data.auth = { id: payload.sub, role: payload.role };
        s.data.role = 'scorer';
      }
      next();
    } catch (err) {
      logger.warn({ err }, 'Socket auth failed — continuing as anonymous viewer');
      s.data.auth = undefined;
      s.data.role = 'viewer';
      next();
    }
  });

  io.on('connection', (socket) => {
    const s = socket as AuthedSocket;
    logger.debug({ socketId: s.id, role: s.data.role }, 'Socket connected');
    registerMatchSocketHandlers(io, s);

    s.on('disconnect', (reason) => {
      logger.debug({ socketId: s.id, reason }, 'Socket disconnected');
    });
  });

  return io;
}

function extractBearer(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
