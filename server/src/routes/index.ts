import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { teamsRouter } from './teams.routes.js';
import { playersRouter } from './players.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { matchesRouter } from './matches.routes.js';
import { publicMatchesRouter } from './public.routes.js';
import { uploadsRouter } from './uploads.routes.js';
import { statisticsRouter } from './statistics.routes.js';
import { searchRouter } from './search.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/teams', teamsRouter);
apiRouter.use('/players', playersRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/statistics', statisticsRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/public/matches', publicMatchesRouter);
apiRouter.use('/matches', matchesRouter);
