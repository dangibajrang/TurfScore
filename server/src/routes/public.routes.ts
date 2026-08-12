import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicMatch, getPublicScorecard } from '../controllers/liveSharing.controller.js';

export const publicMatchesRouter = Router();

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many public match requests',
    },
  },
});

publicMatchesRouter.use(publicLimiter);
publicMatchesRouter.get('/:publicMatchId', getPublicMatch);
publicMatchesRouter.get('/:publicMatchId/scorecard', getPublicScorecard);
