import type { RequestHandler } from 'express';
import { imageUpload, toPublicUploadPath } from '../middleware/upload.js';
import { AppError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export const uploadImageMiddleware = imageUpload.single('image');

export const uploadImage: RequestHandler = (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      throw new AppError('Authentication required', {
        statusCode: 401,
        code: 'AUTH_REQUIRED',
      });
    }

    const file = req.file;
    if (!file) {
      throw new AppError('Image file is required (field name: image)', {
        statusCode: 400,
        code: 'BAD_REQUEST',
      });
    }

    res.status(201).json({
      url: toPublicUploadPath(file.filename),
      filename: file.filename,
      size: file.size,
      mimeType: file.mimetype,
    });
  } catch (err) {
    next(err);
  }
};
