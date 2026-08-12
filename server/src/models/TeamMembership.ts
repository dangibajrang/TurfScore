import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Extensible team membership — supports join/leave history for future phases.
 * Active roster = status ACTIVE and leftAt unset.
 */
export const MEMBERSHIP_STATUSES = ['ACTIVE', 'LEFT'] as const;

const teamMembershipSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    joinedAt: { type: Date, required: true, default: () => new Date() },
    leftAt: { type: Date },
    status: {
      type: String,
      enum: MEMBERSHIP_STATUSES,
      default: 'ACTIVE',
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    collection: 'team_memberships',
  },
);

teamMembershipSchema.index(
  { teamId: 1, playerId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
  },
);
teamMembershipSchema.index({ playerId: 1, status: 1 });
teamMembershipSchema.index({ teamId: 1, status: 1 });

export type TeamMembershipDocument = InferSchemaType<typeof teamMembershipSchema> & {
  _id: Types.ObjectId;
};

export const TeamMembership = model('TeamMembership', teamMembershipSchema);
