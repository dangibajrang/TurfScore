import { Router } from 'express';
import {
  addTeamPlayer,
  createTeam,
  deleteTeam,
  getTeam,
  listTeamPlayers,
  listTeams,
  removeTeamPlayer,
  setCaptain,
  setViceCaptain,
  updateTeam,
} from '../controllers/team.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createTeamSchema,
  listTeamsQuerySchema,
  setCaptainSchema,
  updateTeamSchema,
} from '../validators/team.validators.js';

export const teamsRouter = Router();

teamsRouter.use(requireAuth);

teamsRouter.get('/', validateRequest(listTeamsQuerySchema, 'query'), listTeams);
teamsRouter.post('/', validateRequest(createTeamSchema), createTeam);
teamsRouter.get('/:id', getTeam);
teamsRouter.patch('/:id', validateRequest(updateTeamSchema), updateTeam);
teamsRouter.delete('/:id', deleteTeam);
teamsRouter.get('/:id/players', listTeamPlayers);
teamsRouter.post('/:id/players/:playerId', addTeamPlayer);
teamsRouter.delete('/:id/players/:playerId', removeTeamPlayer);
teamsRouter.patch('/:id/captain', validateRequest(setCaptainSchema), setCaptain);
teamsRouter.patch('/:id/vice-captain', validateRequest(setCaptainSchema), setViceCaptain);
