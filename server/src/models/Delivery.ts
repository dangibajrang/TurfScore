import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

export const WICKET_TYPES = [
  'BOWLED',
  'CAUGHT',
  'LBW',
  'STUMPED',
  'RUN_OUT',
  'HIT_WICKET',
  'RETIRED_HURT',
  'RETIRED_OUT',
  'OBSTRUCTING_THE_FIELD',
  'HANDLED_THE_BALL',
  'TIMED_OUT',
  'HIT_THE_BALL_TWICE',
  'OTHER',
] as const;

const runsSchema = new Schema(
  {
    batterRuns: { type: Number, required: true, min: 0, default: 0 },
    extrasRuns: { type: Number, required: true, min: 0, default: 0 },
    totalRuns: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

/** Numeric extras breakdown (Phase 5). */
const extrasSchema = new Schema(
  {
    wide: { type: Number, default: 0, min: 0 },
    noBall: { type: Number, default: 0, min: 0 },
    bye: { type: Number, default: 0, min: 0 },
    legBye: { type: Number, default: 0, min: 0 },
    penalty: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const wicketSchema = new Schema(
  {
    isWicket: { type: Boolean, required: true, default: false },
    wicketType: { type: String, enum: WICKET_TYPES },
    playerOutId: { type: Schema.Types.ObjectId, ref: 'Player' },
    fielderId: { type: Schema.Types.ObjectId, ref: 'Player' },
    runsCompleted: { type: Number, min: 0 },
    /** @deprecated alias */
    runsBeforeWicket: { type: Number, min: 0 },
  },
  { _id: false },
);

/**
 * Append-only delivery event — source of truth for scoring.
 * eventId provides idempotency for retries / offline sync.
 */
const deliverySchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 64 },
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
      index: true,
    },
    inningsIndex: { type: Number, required: true, min: 0 },
    inningsNumber: { type: Number, required: true, min: 1 },
    overNumber: { type: Number, required: true, min: 0 },
    ballNumber: { type: Number, required: true, min: 0 },
    sequence: { type: Number, required: true, min: 0 },
    batterId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    nonStrikerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    bowlerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    runs: { type: runsSchema, required: true },
    extras: { type: extrasSchema, required: true, default: () => ({}) },
    wicket: { type: wicketSchema, required: true, default: () => ({ isWicket: false }) },
    isLegalDelivery: { type: Boolean, required: true, default: true },
    commentary: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    supersededByEventId: { type: String, trim: true },
    isUndone: { type: Boolean, default: false },
    isCorrection: { type: Boolean, default: false },
    audit: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'deliveries',
  },
);

deliverySchema.index({ matchId: 1, eventId: 1 }, { unique: true });
deliverySchema.index({ matchId: 1, sequence: 1 });
deliverySchema.index({ matchId: 1, inningsIndex: 1, sequence: 1 });
deliverySchema.index({ matchId: 1, isUndone: 1, sequence: 1 });

export type DeliveryDocument = InferSchemaType<typeof deliverySchema> & {
  _id: Types.ObjectId;
};

export const Delivery = model('Delivery', deliverySchema);
