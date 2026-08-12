import mongoose from 'mongoose';
import { loadEnv } from './env.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<typeof mongoose> {
  const { MONGODB_URI, NODE_ENV } = loadEnv();

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: NODE_ENV === 'production' ? 10_000 : 5_000,
  });

  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  }
}

export function getDatabaseStatus(): {
  readyState: number;
  readyStateLabel: string;
} {
  const labels: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const readyState = mongoose.connection.readyState;
  return {
    readyState,
    readyStateLabel: labels[readyState] ?? 'unknown',
  };
}
