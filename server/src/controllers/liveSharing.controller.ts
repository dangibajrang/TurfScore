import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import * as liveSharingService from '../services/liveSharingService.js';

function auth(req: Parameters<RequestHandler>[0]) {
  return (req as AuthenticatedRequest).auth!;
}

export const enableLiveSharing: RequestHandler = async (req, res, next) => {
  try {
    const data = await liveSharingService.enableLiveSharing(auth(req), req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const disableLiveSharing: RequestHandler = async (req, res, next) => {
  try {
    const data = await liveSharingService.disableLiveSharing(auth(req), req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getLiveSharing: RequestHandler = async (req, res, next) => {
  try {
    const data = await liveSharingService.getLiveSharing(auth(req), req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getPublicMatch: RequestHandler = async (req, res, next) => {
  try {
    const data = await liveSharingService.getPublicMatchByPublicId(
      req.params.publicMatchId as string,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getPublicScorecard: RequestHandler = async (req, res, next) => {
  try {
    const data = await liveSharingService.getPublicScorecard(req.params.publicMatchId as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
