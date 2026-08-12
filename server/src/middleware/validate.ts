import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

export type ValidatedRequest<T> = Request & {
  validatedQuery?: T;
  validatedParams?: T;
};

export function validateRequest<T>(schema: ZodSchema<T>, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(result.error);
      return;
    }

    if (part === 'body') {
      req.body = result.data;
    } else if (part === 'query') {
      (req as ValidatedRequest<T>).validatedQuery = result.data;
    } else {
      (req as ValidatedRequest<T>).validatedParams = result.data;
    }
    next();
  };
}
