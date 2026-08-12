import { Router } from 'express';
import {
  playerMatchHistory,
  playerStatistics,
  statisticsSummary,
  teamStatistics,
} from '../controllers/statistics.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const statisticsRouter = Router();

statisticsRouter.use(requireAuth);
statisticsRouter.get('/summary', statisticsSummary);
statisticsRouter.get('/players/:playerId', playerStatistics);
statisticsRouter.get('/players/:playerId/matches', playerMatchHistory);
statisticsRouter.get('/teams/:teamId', teamStatistics);
