import type { RequestHandler } from 'express';
import { REFRESH_COOKIE_NAME } from '../services/auth/cookies.js';
import {
  getUserById,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
  changePassword as changePasswordService,
  updateUserProfile,
} from '../services/auth/authService.js';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../validators/auth.validators.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export const register: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as RegisterInput;
    const result = await registerUser(body, res, req.get('user-agent') ?? undefined);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as LoginInput;
    const result = await loginUser(body, res, req.get('user-agent') ?? undefined);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as ForgotPasswordInput;
    const result = await requestPasswordReset(body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as ResetPasswordInput;
    const result = await resetPasswordWithToken(body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
      });
      return;
    }
    const body = req.body as ChangePasswordInput;
    const result = await changePasswordService(auth.id, body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await refreshAccessToken(raw, res, req.get('user-agent') ?? undefined);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await logoutUser(raw, res);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
      });
      return;
    }
    const user = await getUserById(auth.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
      });
      return;
    }
    const body = req.body as UpdateProfileInput;
    const user = await updateUserProfile(auth.id, {
      name: body.name,
      phone: body.phone,
      profileImageUrl: body.profileImageUrl,
    });
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};
