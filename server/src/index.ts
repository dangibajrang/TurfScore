import 'dotenv/config';
import http from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { initSocketIO } from './sockets/index.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  initSocketIO(server);

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    const forceTimer = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000);
    forceTimer.unref();

    server.close(async (closeErr) => {
      if (closeErr) {
        logger.error({ err: closeErr }, 'Error closing HTTP server');
      }
      try {
        await disconnectDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during database disconnect');
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    void shutdown('uncaughtException');
  });

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        clientUrl: env.CLIENT_URL,
      },
      'TurfScore API listening',
    );
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
