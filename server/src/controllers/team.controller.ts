import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { ValidatedRequest } from '../middleware/validate.js';
import * as teamService from '../services/teamService.js';
import type {
  createTeamSchema,
  listTeamsQuerySchema,
  setCaptainSchema,
  updateTeamSchema,
} from '../validators/team.validators.js';

function auth(req: Parameters<RequestHandler>[0]) {
  return (req as AuthenticatedRequest).auth!;
}

export const listTeams: RequestHandler = async (req, res, next) => {
  try {
    const query =
      (req as ValidatedRequest<z.infer<typeof listTeamsQuerySchema>>).validatedQuery ?? {};
    const result = await teamService.listTeams(auth(req), query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createTeam: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createTeamSchema>;
    const team = await teamService.createTeam(auth(req), body);
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
};

export const getTeam: RequestHandler = async (req, res, next) => {
  try {
    const team = await teamService.getTeam(auth(req), req.params.id as string);
    res.json(team);
  } catch (err) {
    next(err);
  }
};

export const updateTeam: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof updateTeamSchema>;
    const team = await teamService.updateTeam(auth(req), req.params.id as string, body);
    res.json(team);
  } catch (err) {
    next(err);
  }
};

export const deleteTeam: RequestHandler = async (req, res, next) => {
  try {
    await teamService.deleteTeam(auth(req), req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const listTeamPlayers: RequestHandler = async (req, res, next) => {
  try {
    const players = await teamService.listTeamPlayers(auth(req), req.params.id as string);
    res.json({ items: players });
  } catch (err) {
    next(err);
  }
};

export const addTeamPlayer: RequestHandler = async (req, res, next) => {
  try {
    const team = await teamService.addPlayerToTeam(
      auth(req),
      req.params.id as string,
      req.params.playerId as string,
    );
    res.json(team);
  } catch (err) {
    next(err);
  }
};

export const removeTeamPlayer: RequestHandler = async (req, res, next) => {
  try {
    const team = await teamService.removePlayerFromTeam(
      auth(req),
      req.params.id as string,
      req.params.playerId as string,
    );
    res.json(team);
  } catch (err) {
    next(err);
  }
};

export const setCaptain: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof setCaptainSchema>;
    const team = await teamService.setCaptain(auth(req), req.params.id as string, body.playerId);
    res.json(team);
  } catch (err) {
    next(err);
  }
};

export const setViceCaptain: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof setCaptainSchema>;
    const team = await teamService.setViceCaptain(
      auth(req),
      req.params.id as string,
      body.playerId,
    );
    res.json(team);
  } catch (err) {
    next(err);
  }
};
