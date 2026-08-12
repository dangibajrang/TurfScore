import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { globalSearch } from '../services/searchService.js';

const querySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export const searchGlobal: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const parsed = querySchema.parse(req.query);
    const result = await globalSearch(auth, parsed.q, parsed.limit ?? 5);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
