import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

export const MATCH_STATUSES = [
  'DRAFT',
  'UPCOMING',
  'LIVE',
  'COMPLETED',
  'ABANDONED',
  'CANCELLED',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const TOSS_DECISIONS = ['BAT', 'BOWL'] as const;
export type TossDecision = (typeof TOSS_DECISIONS)[number];

export const MATCH_PLAYER_ROLES = [
  'BATTER',
  'BOWLER',
  'ALL_ROUNDER',
  'WICKET_KEEPER',
] as const;

/**
 * Configurable cricket rules for a match.
 * Scoring engine (Phase 5) must read these — never hardcode formats in app logic.
 */
export const matchRulesSchema = new Schema(
  {
    overs: { type: Number, required: true, min: 1, max: 50 },
    ballsPerOver: { type: Number, required: true, min: 1, max: 12, default: 6 },
    playersPerSide: { type: Number, required: true, min: 2, max: 15, default: 11 },
    maxOversPerBowler: { type: Number, min: 1, max: 50 },
    powerplayEnabled: { type: Boolean, default: false },
    powerplayOvers: { type: Number, min: 0, max: 50 },
    superOverEnabled: { type: Boolean, default: false },
    customRules: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const tossSchema = new Schema(
  {
    wonByTeamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    decision: { type: String, enum: TOSS_DECISIONS },
  },
  { _id: false },
);

/** Match-specific XI entry — does not mutate global Player documents. */
const playingXiEntrySchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    role: { type: String, enum: MATCH_PLAYER_ROLES },
    battingOrder: { type: Number, required: true, min: 1, max: 15 },
    isWicketKeeper: { type: Boolean, default: false },
    isCaptain: { type: Boolean, default: false },
    isViceCaptain: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * Denormalized live snapshot — always rebuildable from Delivery events.
 * Shape kept flexible for Phase 5 engine; no cricket calculations live here.
 */
const matchSnapshotSchema = new Schema(
  {
    currentInningsIndex: { type: Number, default: 0 },
    scoreSummary: { type: Schema.Types.Mixed },
    batting: { type: Schema.Types.Mixed },
    bowling: { type: Schema.Types.Mixed },
    partnership: { type: Schema.Types.Mixed },
    required: { type: Schema.Types.Mixed },
    thisOver: { type: Schema.Types.Mixed },
    lastEventId: { type: String },
    /** Full engine MatchState — rebuildable from deliveries */
    scoring: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const matchTeamSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    playingXi: { type: [playingXiEntrySchema], default: [] },
  },
  { _id: false },
);

const matchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: MATCH_STATUSES,
      default: 'DRAFT',
      required: true,
      index: true,
    },
    teamA: { type: matchTeamSchema, required: true },
    teamB: { type: matchTeamSchema, required: true },
    venue: { type: String, trim: true, maxlength: 200 },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    toss: { type: tossSchema },
    rules: { type: matchRulesSchema, required: true },
    innings: { type: [Schema.Types.Mixed], default: [] },
    snapshot: { type: matchSnapshotSchema, default: () => ({}) },
    /**
     * Optimistic concurrency token for scoring mutations (Phase 5+).
     * Stale client version → MATCH_VERSION_CONFLICT.
     */
    version: { type: Number, required: true, default: 0, min: 0 },
    /** Non-guessable public share id, e.g. TS-8F4K29AB */
    publicMatchId: { type: String, trim: true, maxlength: 32 },
    /** When true, anonymous viewers may join the live room / public API */
    publicLiveEnabled: { type: Boolean, default: false },
    publicLiveEnabledAt: { type: Date },
    winnerTeamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    resultText: { type: String, trim: true, maxlength: 240 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /**
     * Reserved for future audit / correction metadata (Phase 5+).
     * Do not remove — keeps schema extensible without redesign.
     */
    correctionMeta: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'matches',
  },
);

matchSchema.index({ status: 1, scheduledAt: -1 });
matchSchema.index({ createdBy: 1, status: 1, updatedAt: -1 });
matchSchema.index({ 'teamA.teamId': 1, 'teamB.teamId': 1 });
matchSchema.index({ publicMatchId: 1 }, { unique: true, sparse: true });
matchSchema.index({ publicLiveEnabled: 1, status: 1 });
/** Phase 9 — completed match history by owner + date */
matchSchema.index({ createdBy: 1, status: 1, completedAt: -1 });

export type MatchDocument = InferSchemaType<typeof matchSchema> & {
  _id: Types.ObjectId;
};

export const Match = model('Match', matchSchema);
