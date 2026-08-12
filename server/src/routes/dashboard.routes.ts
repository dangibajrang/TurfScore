import { Router } from 'express';
import { dashboardSummary } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get('/summary', dashboardSummary);
