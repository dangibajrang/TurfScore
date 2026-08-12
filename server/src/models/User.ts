import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Active roles for Phase 2.
 * Future roles (ORGANIZATION_ADMIN, SCORER, COACH) can be added to ACTIVE_ROLES
 * without rewriting auth middleware — requireRole accepts any role string.
 */
export const ACTIVE_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof ACTIVE_ROLES)[number];

/** Documented future roles — not active in Phase 2 */
export const FUTURE_ROLES = ['ORGANIZATION_ADMIN', 'SCORER', 'COACH'] as const;

/** @deprecated Use ACTIVE_ROLES — kept for existing imports */
export const USER_ROLES = ACTIVE_ROLES;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    phone: { type: String, trim: true, maxlength: 32 },
    profileImageUrl: { type: String, trim: true },
    role: {
      type: String,
      enum: ACTIVE_ROLES,
      default: 'USER',
      required: true,
    },
    isActive: { type: Boolean, default: true, required: true },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
};

export const User = model('User', userSchema);
