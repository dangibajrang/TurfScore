import { Router } from 'express';
import {
  createPlayer,
  deletePlayer,
  getPlayer,
  getPlayerTeams,
  listPlayers,
  updatePlayer,
} from '../controllers/player.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createPlayerSchema,
  listPlayersQuerySchema,
  updatePlayerSchema,
} from '../validators/player.validators.js';

export const playersRouter = Router();

playersRouter.use(requireAuth);

playersRouter.get('/', validateRequest(listPlayersQuerySchema, 'query'), listPlayers);
playersRouter.post('/', validateRequest(createPlayerSchema), createPlayer);
playersRouter.get('/:id', getPlayer);
playersRouter.patch('/:id', validateRequest(updatePlayerSchema), updatePlayer);
playersRouter.delete('/:id', deletePlayer);
playersRouter.get('/:id/teams', getPlayerTeams);
