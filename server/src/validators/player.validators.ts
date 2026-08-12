import { z } from 'zod';
import { BATTING_STYLES, BOWLING_STYLES, PLAYER_ROLES } from '../models/Player.js';

const roleSchema = z.enum(PLAYER_ROLES);
const battingSchema = z.enum(BATTING_STYLES);
const bowlingSchema = z.enum(BOWLING_STYLES);

export const createPlayerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: roleSchema.default('ALL_ROUNDER'),
  battingStyle: battingSchema.optional(),
  bowlingStyle: bowlingSchema.optional(),
  profileImageUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) =>
        v === '' ||
        v.startsWith('/uploads/') ||
        /^https?:\/\//i.test(v),
      'Profile image must be an uploaded file path or http(s) URL',
    )
    .optional()
    .or(z.literal('')),
  dateOfBirth: z.string().datetime().optional().or(z.string().date().optional()),
  phone: z.string().trim().max(32).optional(),
  bio: z.string().trim().max(1000).optional(),
});

export const updatePlayerSchema = createPlayerSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const listPlayersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  role: roleSchema.optional(),
  battingStyle: battingSchema.optional(),
  bowlingStyle: bowlingSchema.optional(),
});
