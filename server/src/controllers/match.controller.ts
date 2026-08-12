import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { ValidatedRequest } from '../middleware/validate.js';
import * as matchService from '../services/matchService.js';
import type {
  createMatchSchema,
  listMatchesQuerySchema,
  updateMatchSchema,
} from '../validators/match.validators.js';

function auth(req: Parameters<RequestHandler>[0]) {
  return (req as AuthenticatedRequest).auth!;
}

export const listMatches: RequestHandler = async (req, res, next) => {
  try {
    const query =
      (req as ValidatedRequest<z.infer<typeof listMatchesQuerySchema>>).validatedQuery ?? {};
    const result = await matchService.listMatches(auth(req), query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createMatch: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createMatchSchema> & { startNow?: boolean };
    if (body.startNow) {
      const { startNow: _ignored, ...rest } = body;
      const match = await matchService.createAndStartMatch(auth(req), rest);
      res.status(201).json(match);
      return;
    }
    const match = await matchService.createMatch(auth(req), body);
    res.status(201).json(match);
  } catch (err) {
    next(err);
  }
};

export const getMatch: RequestHandler = async (req, res, next) => {
  try {
    const match = await matchService.getMatch(auth(req), req.params.id as string);
    res.json(match);
  } catch (err) {
    next(err);
  }
};

export const updateMatch: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof updateMatchSchema>;
    const match = await matchService.updateMatch(auth(req), req.params.id as string, body);
    res.json(match);
  } catch (err) {
    next(err);
  }
};

export const deleteMatch: RequestHandler = async (req, res, next) => {
  try {
    await matchService.deleteMatch(auth(req), req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const startMatch: RequestHandler = async (req, res, next) => {
  try {
    const match = await matchService.startMatch(auth(req), req.params.id as string);
    res.json(match);
  } catch (err) {
    next(err);
  }
};

export const cancelMatch: RequestHandler = async (req, res, next) => {
  try {
    const match = await matchService.cancelMatch(auth(req), req.params.id as string);
    res.json(match);
  } catch (err) {
    next(err);
  }
};

export const abandonMatch: RequestHandler = async (req, res, next) => {
  try {
    const match = await matchService.abandonMatch(auth(req), req.params.id as string);
    res.json(match);
  } catch (err) {
    next(err);
  }
};
