import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getDashboardSummary } from '../services/dashboardService.js';

export const dashboardSummary: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const summary = await getDashboardSummary(auth);
    res.json(summary);
  } catch (err) {
    next(err);
  }
};
