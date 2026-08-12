import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name is too long'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Za-z]/, 'Password must include a letter')
    .regex(/[0-9]/, 'Password must include a number'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password is required').max(128),
});

const passwordRules = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(254)
    .transform((v) => v.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'Reset token is invalid').max(200),
  password: passwordRules,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordRules,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

const profileImageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      v === '' ||
      v.startsWith('/uploads/') ||
      /^https?:\/\//i.test(v),
    'Profile image must be an uploaded file path or http(s) URL',
  );

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name is too long')
    .optional(),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  profileImageUrl: profileImageUrlSchema.optional().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
