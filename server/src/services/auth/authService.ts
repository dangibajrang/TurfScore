import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { loadEnv } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { RefreshSession } from '../../models/RefreshSession.js';
import { User, type UserDocument, type UserRole } from '../../models/User.js';
import { AppError } from '../../utils/errors.js';
import { clearRefreshCookie, setRefreshCookie } from './cookies.js';
import {
  durationToMs,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './tokens.js';
import { toSafeUser, type SafeUser } from './userSerializer.js';
import type { Response } from 'express';

const BCRYPT_ROUNDS = 12;

const GENERIC_FORGOT_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

export type AuthResult = {
  user: SafeUser;
  accessToken: string;
};

async function createRefreshSession(
  userId: Types.ObjectId,
  userAgent?: string,
): Promise<{ rawToken: string; sessionId: string }> {
  const env = loadEnv();
  const sessionId = new Types.ObjectId().toString();
  const rawToken = signRefreshToken(userId.toString(), sessionId);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));

  await RefreshSession.create({
    _id: new Types.ObjectId(sessionId),
    userId,
    tokenHash,
    expiresAt,
    userAgent: userAgent?.slice(0, 512),
  });

  return { rawToken, sessionId };
}

async function issueAuth(user: UserDocument, res: Response, userAgent?: string): Promise<AuthResult> {
  const { rawToken } = await createRefreshSession(user._id, userAgent);
  setRefreshCookie(res, rawToken);
  const accessToken = signAccessToken(user._id.toString(), user.role as UserRole);

  return {
    user: toSafeUser(user),
    accessToken,
  };
}

export async function registerUser(
  input: { name: string; email: string; password: string },
  res: Response,
  userAgent?: string,
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw new AppError('An account with this email already exists', {
      statusCode: 409,
      code: 'DUPLICATE_EMAIL',
    });
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await User.create({
    name: input.name.trim(),
    email,
    passwordHash,
    role: 'USER',
    isActive: true,
  });

  return issueAuth(user, res, userAgent);
}

export async function loginUser(
  input: { email: string; password: string },
  res: Response,
  userAgent?: string,
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    throw new AppError('Invalid email or password', {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  if (!user.isActive) {
    throw new AppError('This account has been disabled', {
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
    });
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError('Invalid email or password', {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  return issueAuth(user, res, userAgent);
}

export async function requestPasswordReset(input: {
  email: string;
}): Promise<{ message: string; devResetUrl?: string }> {
  const env = loadEnv();
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select(
    '+passwordResetTokenHash +passwordResetExpiresAt',
  );

  if (!user || !user.isActive) {
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashToken(rawToken);
  user.passwordResetExpiresAt = new Date(Date.now() + durationToMs(env.PASSWORD_RESET_EXPIRES_IN));
  await user.save();

  const resetUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
  logger.info({ email, resetUrl }, 'Password reset link generated');

  const result: { message: string; devResetUrl?: string } = {
    message: GENERIC_FORGOT_MESSAGE,
  };
  if (env.NODE_ENV !== 'production') {
    result.devResetUrl = resetUrl;
  }
  return result;
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<{ message: string }> {
  const tokenHash = hashToken(input.token.trim());
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');

  if (!user || !user.isActive) {
    throw new AppError('This reset link is invalid or has expired', {
      statusCode: 400,
      code: 'INVALID_RESET_TOKEN',
    });
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  await User.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    },
  );

  await RefreshSession.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );

  return { message: 'Password updated. You can sign in with your new password.' };
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<{ message: string }> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !user.isActive) {
    throw new AppError('Authentication required', {
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    });
  }

  const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError('Current password is incorrect', {
      statusCode: 400,
      code: 'INVALID_CREDENTIALS',
    });
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError('New password must be different from the current password', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  user.passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await user.save();

  await RefreshSession.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );

  return { message: 'Password updated successfully.' };
}

export async function refreshAccessToken(
  rawRefreshToken: string | undefined,
  res: Response,
  userAgent?: string,
): Promise<{ accessToken: string; user: SafeUser }> {
  if (!rawRefreshToken) {
    throw new AppError('Authentication required', {
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    });
  }

  const payload = verifyRefreshToken(rawRefreshToken);
  const tokenHash = hashToken(rawRefreshToken);
  const session = await RefreshSession.findById(payload.sid);

  if (!session || session.tokenHash !== tokenHash) {
    throw new AppError('Invalid refresh token', {
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  }

  if (session.revokedAt) {
    await RefreshSession.updateMany(
      { userId: session.userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    clearRefreshCookie(res);
    throw new AppError('Invalid refresh token', {
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  }

  if (session.expiresAt.getTime() < Date.now()) {
    session.revokedAt = new Date();
    await session.save();
    clearRefreshCookie(res);
    throw new AppError('Refresh token expired', {
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
    });
  }

  const user = await User.findById(session.userId);
  if (!user || !user.isActive) {
    session.revokedAt = new Date();
    await session.save();
    clearRefreshCookie(res);
    throw new AppError('Authentication required', {
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    });
  }

  const { rawToken: newRaw } = await createRefreshSession(user._id, userAgent);
  session.revokedAt = new Date();
  session.replacedByHash = hashToken(newRaw);
  await session.save();
  setRefreshCookie(res, newRaw);

  return {
    accessToken: signAccessToken(user._id.toString(), user.role as UserRole),
    user: toSafeUser(user),
  };
}

export async function logoutUser(rawRefreshToken: string | undefined, res: Response): Promise<void> {
  if (rawRefreshToken) {
    try {
      const payload = verifyRefreshToken(rawRefreshToken);
      const tokenHash = hashToken(rawRefreshToken);
      const session = await RefreshSession.findById(payload.sid);
      if (session && session.tokenHash === tokenHash && !session.revokedAt) {
        session.revokedAt = new Date();
        await session.save();
      }
    } catch {
      // Still clear cookie even if token is invalid
    }
  }
  clearRefreshCookie(res);
}

export async function getUserById(userId: string): Promise<SafeUser> {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('Authentication required', {
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    });
  }
  return toSafeUser(user);
}

export async function updateUserProfile(
  userId: string,
  input: {
    name?: string;
    phone?: string;
    profileImageUrl?: string | null;
  },
): Promise<SafeUser> {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('Authentication required', {
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    });
  }

  if (input.name !== undefined) {
    user.name = input.name;
  }
  if (input.phone !== undefined) {
    user.phone = input.phone || undefined;
  }
  if (input.profileImageUrl !== undefined) {
    user.profileImageUrl = input.profileImageUrl || undefined;
  }

  await user.save();
  return toSafeUser(user);
}
