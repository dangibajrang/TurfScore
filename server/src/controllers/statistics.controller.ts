import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getPlayerMatchHistory,
  getPlayerStatistics,
  getStatisticsSummary,
  getTeamStatistics,
  type StatsRange,
} from '../services/statisticsService.js';

function parseRange(raw: unknown): StatsRange {
  if (raw === 'THIS_MONTH' || raw === 'THIS_YEAR' || raw === 'ALL_TIME') return raw;
  return 'ALL_TIME';
}

export const statisticsSummary: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const data = await getStatisticsSummary(auth, { range: parseRange(req.query.range) });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

export const playerStatistics: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const data = await getPlayerStatistics(auth, String(req.params.playerId), {
      range: parseRange(req.query.range),
    });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

export const playerMatchHistory: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const data = await getPlayerMatchHistory(auth, String(req.params.playerId), { page, limit });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

export const teamStatistics: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const data = await getTeamStatistics(auth, String(req.params.teamId), {
      range: parseRange(req.query.range),
    });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};
