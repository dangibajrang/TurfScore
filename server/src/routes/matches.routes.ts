import { Router } from 'express';
import {
  abandonMatch,
  cancelMatch,
  createMatch,
  deleteMatch,
  getMatch,
  listMatches,
  startMatch,
  updateMatch,
} from '../controllers/match.controller.js';
import {
  disableLiveSharing,
  enableLiveSharing,
  getLiveSharing,
} from '../controllers/liveSharing.controller.js';
import {
  getRecentDeliveries,
  getScorecard,
  getScoringState,
  patchDelivery,
  postBowler,
  postDelivery,
  postOpenings,
  postRebuild,
  postReplacementBatter,
  postStartInnings,
  undoDelivery,
} from '../controllers/scoring.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createMatchSchema,
  listMatchesQuerySchema,
  updateMatchSchema,
} from '../validators/match.validators.js';
import {
  bowlerSchema,
  deliveryCommandSchema,
  editDeliverySchema,
  expectedVersionSchema,
  openingsSchema,
  replacementBatterSchema,
  startInningsSchema,
} from '../validators/scoring.validators.js';

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

matchesRouter.get('/', validateRequest(listMatchesQuerySchema, 'query'), listMatches);
matchesRouter.post('/', validateRequest(createMatchSchema), createMatch);

// Scoring routes (before generic :id where helpful)
matchesRouter.get('/:id/scoring', getScoringState);
matchesRouter.get('/:id/scorecard', getScorecard);
matchesRouter.get('/:id/deliveries', getRecentDeliveries);
matchesRouter.post('/:id/deliveries', validateRequest(deliveryCommandSchema), postDelivery);
matchesRouter.post('/:id/undo', validateRequest(expectedVersionSchema), undoDelivery);
matchesRouter.patch(
  '/:id/deliveries/:deliveryId',
  validateRequest(editDeliverySchema),
  patchDelivery,
);
matchesRouter.post('/:id/openings', validateRequest(openingsSchema), postOpenings);
matchesRouter.post('/:id/bowler', validateRequest(bowlerSchema), postBowler);
matchesRouter.post('/:id/batter', validateRequest(replacementBatterSchema), postReplacementBatter);
matchesRouter.post('/:id/innings/start', validateRequest(startInningsSchema), postStartInnings);
matchesRouter.post('/:id/rebuild', postRebuild);

matchesRouter.get('/:id/live-sharing', getLiveSharing);
matchesRouter.post('/:id/live-sharing/enable', enableLiveSharing);
matchesRouter.post('/:id/live-sharing/disable', disableLiveSharing);

matchesRouter.get('/:id', getMatch);
matchesRouter.patch('/:id', validateRequest(updateMatchSchema), updateMatch);
matchesRouter.delete('/:id', deleteMatch);
matchesRouter.post('/:id/start', startMatch);
matchesRouter.post('/:id/cancel', cancelMatch);
matchesRouter.post('/:id/abandon', abandonMatch);
