import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
  updateMe,
} from '../controllers/auth.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validators.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10_000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many password reset attempts. Please try again later.',
    },
  },
});

authRouter.post('/register', authLimiter, validateRequest(registerSchema), register);
authRouter.post('/login', authLimiter, validateRequest(loginSchema), login);
authRouter.post(
  '/forgot-password',
  forgotLimiter,
  validateRequest(forgotPasswordSchema),
  forgotPassword,
);
authRouter.post(
  '/reset-password',
  authLimiter,
  validateRequest(resetPasswordSchema),
  resetPassword,
);
authRouter.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validateRequest(changePasswordSchema),
  changePassword,
);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
authRouter.patch('/me', requireAuth, validateRequest(updateProfileSchema), updateMe);

/** Smoke-test route for ADMIN authorization */
authRouter.get('/admin-check', requireAuth, requireRole('ADMIN'), (_req, res) => {
  res.status(200).json({ ok: true, scope: 'ADMIN' });
});
