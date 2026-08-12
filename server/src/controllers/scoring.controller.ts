import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import * as scoringService from '../services/scoringService.js';
import type {
  bowlerSchema,
  deliveryCommandSchema,
  editDeliverySchema,
  expectedVersionSchema,
  openingsSchema,
  replacementBatterSchema,
  startInningsSchema,
} from '../validators/scoring.validators.js';

function auth(req: Parameters<RequestHandler>[0]) {
  return (req as AuthenticatedRequest).auth!;
}

export const getScoringState: RequestHandler = async (req, res, next) => {
  try {
    const data = await scoringService.getScoringState(auth(req), req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getScorecard: RequestHandler = async (req, res, next) => {
  try {
    const data = await scoringService.getScorecard(auth(req), req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getRecentDeliveries: RequestHandler = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 12);
    const data = await scoringService.listRecentDeliveries(
      auth(req),
      req.params.id as string,
      limit,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const postDelivery: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof deliveryCommandSchema>;
    const data = await scoringService.recordDelivery(
      auth(req),
      req.params.id as string,
      body,
    );
    res.status(data.duplicate ? 200 : 201).json(data);
  } catch (err) {
    next(err);
  }
};

export const undoDelivery: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof expectedVersionSchema>;
    const data = await scoringService.undoLastDelivery(
      auth(req),
      req.params.id as string,
      body,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const patchDelivery: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof editDeliverySchema>;
    const data = await scoringService.editDelivery(
      auth(req),
      req.params.id as string,
      req.params.deliveryId as string,
      body,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const postOpenings: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof openingsSchema>;
    const data = await scoringService.setOpenings(auth(req), req.params.id as string, body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const postBowler: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof bowlerSchema>;
    const data = await scoringService.selectBowler(auth(req), req.params.id as string, body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const postReplacementBatter: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof replacementBatterSchema>;
    const data = await scoringService.selectReplacementBatter(
      auth(req),
      req.params.id as string,
      body,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const postStartInnings: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof startInningsSchema>;
    const data = await scoringService.startNextInnings(
      auth(req),
      req.params.id as string,
      body,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const postRebuild: RequestHandler = async (req, res, next) => {
  try {
    const data = await scoringService.rebuildMatchState(auth(req), req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
