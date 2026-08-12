import { z } from 'zod';

const objectId = z.string().min(1).refine((v) => /^[a-f\d]{24}$/i.test(v), 'Invalid id');

export const matchRulesSchemaZod = z.object({
  overs: z.coerce.number().int().min(1).max(50),
  ballsPerOver: z.coerce.number().int().min(1).max(12).default(6),
  playersPerSide: z.coerce.number().int().min(2).max(15).default(11),
  maxOversPerBowler: z.coerce.number().int().min(1).max(50).optional(),
  powerplayEnabled: z.boolean().optional(),
  powerplayOvers: z.coerce.number().int().min(0).max(50).optional(),
  superOverEnabled: z.boolean().optional(),
  customRules: z.record(z.string(), z.unknown()).optional(),
});

export const playingXiEntrySchema = z.object({
  playerId: objectId,
  role: z.enum(['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']).optional(),
  battingOrder: z.coerce.number().int().min(1).max(15),
  isWicketKeeper: z.boolean().optional(),
  isCaptain: z.boolean().optional(),
  isViceCaptain: z.boolean().optional(),
});

export const tossSchemaZod = z.object({
  wonByTeamId: objectId,
  decision: z.enum(['BAT', 'BOWL']),
});

export const matchTeamInputSchema = z.object({
  teamId: objectId,
  playingXi: z.array(playingXiEntrySchema).optional(),
});

export const createMatchSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional(),
  venue: z.string().trim().min(1).max(200),
  scheduledAt: z.string().min(1).optional(),
  teamA: matchTeamInputSchema,
  teamB: matchTeamInputSchema,
  rules: matchRulesSchemaZod,
  toss: tossSchemaZod.optional(),
  status: z.enum(['DRAFT', 'UPCOMING']).optional(),
  startNow: z.boolean().optional(),
});

export const updateMatchSchema = createMatchSchema.partial().extend({
  teamA: matchTeamInputSchema.optional(),
  teamB: matchTeamInputSchema.optional(),
  rules: matchRulesSchemaZod.optional(),
});

export const listMatchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z
    .enum(['DRAFT', 'UPCOMING', 'LIVE', 'COMPLETED', 'ABANDONED', 'CANCELLED', 'ALL'])
    .optional(),
  search: z.string().trim().max(120).optional(),
  teamId: objectId.optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
