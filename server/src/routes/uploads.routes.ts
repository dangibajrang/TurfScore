import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { uploadImage, uploadImageMiddleware } from '../controllers/upload.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const uploadsRouter = Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10_000 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many uploads. Please try again later.',
    },
  },
});

function mapMulterError(err: unknown): Error {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError('Image must be 2 MB or smaller', {
        statusCode: 400,
        code: 'BAD_REQUEST',
      });
    }
    return new AppError(err.message, { statusCode: 400, code: 'BAD_REQUEST' });
  }
  if (err instanceof Error) return err;
  return new AppError('Upload failed', { statusCode: 400, code: 'BAD_REQUEST' });
}

uploadsRouter.post('/image', requireAuth, uploadLimiter, (req, res, next) => {
  uploadImageMiddleware(req, res, (err) => {
    if (err) {
      next(mapMulterError(err));
      return;
    }
    next();
  });
}, uploadImage);
