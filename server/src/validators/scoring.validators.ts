import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const wicketType = z.enum([
  'BOWLED',
  'CAUGHT',
  'LBW',
  'STUMPED',
  'RUN_OUT',
  'HIT_WICKET',
  'RETIRED_HURT',
  'OTHER',
]);

export const deliveryCommandSchema = z.object({
  eventId: z.string().trim().min(1).max(64),
  expectedVersion: z.coerce.number().int().min(0),
  batterId: objectId,
  nonStrikerId: objectId,
  bowlerId: objectId,
  batterRuns: z.coerce.number().int().min(0).max(7).default(0),
  extras: z
    .object({
      wide: z.coerce.number().int().min(0).optional(),
      noBall: z.coerce.number().int().min(0).optional(),
      bye: z.coerce.number().int().min(0).optional(),
      legBye: z.coerce.number().int().min(0).optional(),
      penalty: z.coerce.number().int().min(0).optional(),
    })
    .optional(),
  wicket: z
    .object({
      wicketType,
      playerOutId: objectId,
      fielderId: objectId.optional(),
      runsCompleted: z.coerce.number().int().min(0).optional(),
    })
    .nullable()
    .optional(),
  nextBatterId: objectId.optional(),
  commentary: z.string().trim().max(500).optional(),
});

export const expectedVersionSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
});

export const openingsSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
  strikerId: objectId,
  nonStrikerId: objectId,
});

export const bowlerSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
  bowlerId: objectId,
});

export const replacementBatterSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
  nextBatterId: objectId,
});

export const startInningsSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
  strikerId: objectId,
  nonStrikerId: objectId,
  bowlerId: objectId,
});

export const editDeliverySchema = deliveryCommandSchema
  .omit({ eventId: true })
  .extend({
    reason: z.string().trim().max(500).optional(),
  });

export type DeliveryCommandBody = z.infer<typeof deliveryCommandSchema>;
