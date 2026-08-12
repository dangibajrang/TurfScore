import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    shortName: { type: String, trim: true, maxlength: 12 },
    logoUrl: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 120 },
    captainId: { type: Schema.Types.ObjectId, ref: 'Player' },
    viceCaptainId: { type: Schema.Types.ObjectId, ref: 'Player' },
    /** Denormalized active roster for fast counts — membership is source of truth */
    playerIds: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'teams',
  },
);

teamSchema.index({ name: 1, createdBy: 1 });
teamSchema.index({ createdBy: 1, isActive: 1, updatedAt: -1 });
teamSchema.index({ name: 'text', shortName: 'text' });

export type TeamDocument = InferSchemaType<typeof teamSchema> & {
  _id: Types.ObjectId;
};

export const Team = model('Team', teamSchema);
