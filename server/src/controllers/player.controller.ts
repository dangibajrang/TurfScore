import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { ValidatedRequest } from '../middleware/validate.js';
import * as playerService from '../services/playerService.js';
import type {
  createPlayerSchema,
  listPlayersQuerySchema,
  updatePlayerSchema,
} from '../validators/player.validators.js';

function auth(req: Parameters<RequestHandler>[0]) {
  return (req as AuthenticatedRequest).auth!;
}

export const listPlayers: RequestHandler = async (req, res, next) => {
  try {
    const query =
      (req as ValidatedRequest<z.infer<typeof listPlayersQuerySchema>>).validatedQuery ?? {};
    const result = await playerService.listPlayers(auth(req), query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createPlayer: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createPlayerSchema>;
    const player = await playerService.createPlayer(auth(req), body);
    res.status(201).json(player);
  } catch (err) {
    next(err);
  }
};

export const getPlayer: RequestHandler = async (req, res, next) => {
  try {
    const player = await playerService.getPlayer(auth(req), req.params.id as string);
    res.json(player);
  } catch (err) {
    next(err);
  }
};

export const updatePlayer: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof updatePlayerSchema>;
    const player = await playerService.updatePlayer(auth(req), req.params.id as string, body);
    res.json(player);
  } catch (err) {
    next(err);
  }
};

export const deletePlayer: RequestHandler = async (req, res, next) => {
  try {
    await playerService.deactivatePlayer(auth(req), req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const getPlayerTeams: RequestHandler = async (req, res, next) => {
  try {
    const teams = await playerService.getPlayerTeams(auth(req), req.params.id as string);
    res.json({ items: teams });
  } catch (err) {
    next(err);
  }
};
