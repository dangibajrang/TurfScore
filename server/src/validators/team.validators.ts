import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team name is required').max(120),
  shortName: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : v)),
  description: z.string().trim().max(500).optional(),
  logoUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), 'Enter a valid URL'),
});

export const updateTeamSchema = createTeamSchema.partial();

export const setCaptainSchema = z.object({
  playerId: z.string().min(1),
});

export const listTeamsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
});
