import type { RequestHandler } from 'express';
import { getDatabaseStatus } from '../config/database.js';
import { loadEnv } from '../config/env.js';

export const healthCheck: RequestHandler = (_req, res) => {
  const env = loadEnv();
  const db = getDatabaseStatus();
  const healthy = db.readyState === 1;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'turfscore-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: db.readyStateLabel,
      readyState: db.readyState,
    },
  });
};
