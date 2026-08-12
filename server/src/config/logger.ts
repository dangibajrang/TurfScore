import pino from 'pino';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const level = process.env.LOG_LEVEL ?? 'info';

export const logger = pino({
  level,
  transport:
    nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
