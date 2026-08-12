import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Phase 3 roles. BATSMAN kept temporarily for seed backward-compat — prefer BATTER.
 */
export const PLAYER_ROLES = [
  'BATTER',
  'BATSMAN',
  'BOWLER',
  'ALL_ROUNDER',
  'WICKET_KEEPER',
] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

export const PLAYER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const BATTING_STYLES = ['RIGHT_HAND', 'LEFT_HAND'] as const;
export type BattingStyle = (typeof BATTING_STYLES)[number];

export const BOWLING_STYLES = [
  'RIGHT_ARM_FAST',
  'RIGHT_ARM_MEDIUM',
  'RIGHT_ARM_SPIN',
  'LEFT_ARM_FAST',
  'LEFT_ARM_MEDIUM',
  'LEFT_ARM_SPIN',
] as const;
export type BowlingStyle = (typeof BOWLING_STYLES)[number];

const playerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: {
      type: String,
      enum: PLAYER_ROLES,
      default: 'ALL_ROUNDER',
      required: true,
    },
    battingStyle: { type: String, enum: BATTING_STYLES },
    bowlingStyle: { type: String, enum: BOWLING_STYLES },
    /** Optional primary team hint — roster membership is authoritative */
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', index: true },
    profileImageUrl: { type: String, trim: true },
    dateOfBirth: { type: Date },
    phone: { type: String, trim: true, maxlength: 32 },
    bio: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: PLAYER_STATUSES,
      default: 'ACTIVE',
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'players',
  },
);

playerSchema.index({ name: 1, createdBy: 1 });
playerSchema.index({ createdBy: 1, status: 1, updatedAt: -1 });
playerSchema.index({ role: 1, battingStyle: 1, bowlingStyle: 1 });

export type PlayerDocument = InferSchemaType<typeof playerSchema> & {
  _id: Types.ObjectId;
};

export const Player = model('Player', playerSchema);

export function normalizePlayerRole(role: string): string {
  return role === 'BATSMAN' ? 'BATTER' : role;
}
