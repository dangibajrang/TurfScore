import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { searchGlobal } from '../controllers/search.controller.js';
import { requireAuth } from '../middleware/auth.js';

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many search requests, please slow down',
    },
  },
});

export const searchRouter = Router();

searchRouter.use(requireAuth);
searchRouter.get('/', searchLimiter, searchGlobal);
