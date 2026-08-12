import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Server-side refresh session for rotation + logout invalidation.
 * Raw refresh token is never stored — only a SHA-256 hash.
 */
const refreshSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    replacedByHash: { type: String },
    userAgent: { type: String, maxlength: 512 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'refresh_sessions',
  },
);

refreshSessionSchema.index({ userId: 1, revokedAt: 1 });

export type RefreshSessionDocument = InferSchemaType<typeof refreshSessionSchema> & {
  _id: Types.ObjectId;
};

export const RefreshSession = model('RefreshSession', refreshSessionSchema);
