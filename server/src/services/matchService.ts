import type { AuthContext } from '../middleware/auth.js';
import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { TeamMembership } from '../models/TeamMembership.js';
import { assertOwnerOrAdmin, parseObjectId } from '../utils/authorization.js';
import { AppError } from '../utils/errors.js';
import { paginateParams, toPaginated, type PaginatedResult } from '../utils/pagination.js';
import { validateMatchRules, type MatchRulesInput } from './matches/matchRules.js';
import {
  deriveInningsTeams,
  validatePlayingXI,
  validateToss,
  type PlayingXiEntryInput,
  type TossInput,
} from './matches/playingXi.js';
import type { CreateMatchInput, UpdateMatchInput } from '../validators/match.validators.js';
import { createInitialMatchState } from './cricket/MatchStateBuilder.js';
import { emitAfterScoringMutation } from './liveSharingService.js';
import { SocketEvents } from '../sockets/socket.events.js';
import { scoreSummaryFromMatch } from './statisticsService.js';

export type PlayingXiDto = {
  playerId: string;
  playerName: string | null;
  role: string | null;
  battingOrder: number;
  isWicketKeeper: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type MatchTeamDto = {
  teamId: string;
  teamName: string | null;
  teamShortName: string | null;
  playingXi: PlayingXiDto[];
};

export type MatchDto = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  venue: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  teamA: MatchTeamDto;
  teamB: MatchTeamDto;
  rules: MatchRulesInput;
  toss: TossInput | null;
  firstInnings: { battingTeamId: string; bowlingTeamId: string } | null;
  innings: unknown[];
  version: number;
  publicMatchId: string | null;
  publicLiveEnabled: boolean;
  resultText: string | null;
  scoreSummary: {
    teamA: { runs: number; wickets: number; overs: string } | null;
    teamB: { runs: number; wickets: number; overs: string } | null;
  } | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
};

function parseScheduledAt(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('Invalid date/time', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  return d;
}

async function getOwnedMatch(matchId: string, auth: AuthContext) {
  const match = await Match.findById(parseObjectId(matchId, 'Match'));
  if (!match) {
    throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  assertOwnerOrAdmin(match.createdBy, auth);
  return match;
}

async function assertUsableTeam(teamId: string, auth: AuthContext) {
  const team = await Team.findById(parseObjectId(teamId, 'Team'));
  if (!team || !team.isActive) {
    throw new AppError('Team not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  assertOwnerOrAdmin(team.createdBy, auth, 'You are not authorized to use this team');
  return team;
}

async function loadRosterContext(teamId: string, teamLabel: string) {
  const memberships = await TeamMembership.find({ teamId, status: 'ACTIVE' }).lean();
  const rosterPlayerIds = new Set(memberships.map((m) => String(m.playerId)));
  const players = await Player.find({
    _id: { $in: [...rosterPlayerIds] },
  }).lean();
  const activePlayerIds = new Set(
    players.filter((p) => p.status === 'ACTIVE' && p.isActive !== false).map((p) => String(p._id)),
  );
  return { rosterPlayerIds, activePlayerIds, teamLabel };
}

function mapXi(entries: PlayingXiEntryInput[] | undefined): PlayingXiDto[] {
  return (entries ?? []).map((e) => ({
    playerId: e.playerId,
    playerName: null,
    role: e.role ?? null,
    battingOrder: e.battingOrder,
    isWicketKeeper: Boolean(e.isWicketKeeper),
    isCaptain: Boolean(e.isCaptain),
    isViceCaptain: Boolean(e.isViceCaptain),
  }));
}

async function toMatchDto(match: InstanceType<typeof Match>, warnings: string[] = []): Promise<MatchDto> {
  const teamIds = [match.teamA.teamId, match.teamB.teamId];
  const teams = await Team.find({ _id: { $in: teamIds } }).lean();
  const teamMap = new Map(teams.map((t) => [String(t._id), t]));

  const playerIds = [
    ...(match.teamA.playingXi ?? []).map((e) => e.playerId),
    ...(match.teamB.playingXi ?? []).map((e) => e.playerId),
  ];
  const players = await Player.find({ _id: { $in: playerIds } }).lean();
  const playerMap = new Map(players.map((p) => [String(p._id), p]));

  const teamAId = String(match.teamA.teamId);
  const teamBId = String(match.teamB.teamId);
  const teamA = teamMap.get(teamAId);
  const teamB = teamMap.get(teamBId);

  const toss =
    match.toss?.wonByTeamId && match.toss?.decision
      ? {
          wonByTeamId: String(match.toss.wonByTeamId),
          decision: match.toss.decision as 'BAT' | 'BOWL',
        }
      : null;

  const firstInnings = toss ? deriveInningsTeams(teamAId, teamBId, toss) : null;

  const mapTeam = (side: 'teamA' | 'teamB'): MatchTeamDto => {
    const block = match[side];
    const meta = side === 'teamA' ? teamA : teamB;
    const xi = (block.playingXi ?? []).map((e) => {
      const pid = String(e.playerId);
      return {
        playerId: pid,
        playerName: playerMap.get(pid)?.name ?? null,
        role: e.role ?? null,
        battingOrder: e.battingOrder,
        isWicketKeeper: Boolean(e.isWicketKeeper),
        isCaptain: Boolean(e.isCaptain),
        isViceCaptain: Boolean(e.isViceCaptain),
      };
    });
    return {
      teamId: String(block.teamId),
      teamName: meta?.name ?? null,
      teamShortName: meta?.shortName ?? null,
      playingXi: xi.sort((a, b) => a.battingOrder - b.battingOrder),
    };
  };

  return {
    id: String(match._id),
    name: match.name,
    description: match.description ?? null,
    status: match.status,
    venue: match.venue ?? null,
    scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
    startedAt: match.startedAt ? match.startedAt.toISOString() : null,
    completedAt: match.completedAt ? match.completedAt.toISOString() : null,
    teamA: mapTeam('teamA'),
    teamB: mapTeam('teamB'),
    rules: {
      overs: match.rules.overs,
      ballsPerOver: match.rules.ballsPerOver,
      playersPerSide: match.rules.playersPerSide,
      maxOversPerBowler: match.rules.maxOversPerBowler ?? undefined,
      powerplayEnabled: match.rules.powerplayEnabled,
      powerplayOvers: match.rules.powerplayOvers ?? undefined,
      superOverEnabled: match.rules.superOverEnabled,
      customRules: (match.rules.customRules as Record<string, unknown> | undefined) ?? undefined,
    },
    toss,
    firstInnings,
    innings: match.innings ?? [],
    version: match.version,
    publicMatchId: match.publicMatchId ?? null,
    publicLiveEnabled: Boolean(match.publicLiveEnabled),
    resultText: match.resultText ?? null,
    scoreSummary: scoreSummaryFromMatch(match),
    createdBy: String(match.createdBy),
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
    warnings,
  };
}

async function buildCaptainWarnings(
  teamId: string,
  xi: PlayingXiEntryInput[],
  label: string,
): Promise<string[]> {
  const team = await Team.findById(teamId).lean();
  if (!team) return [];
  const warnings: string[] = [];
  const selected = new Set(xi.map((e) => e.playerId));
  if (team.captainId && !selected.has(String(team.captainId))) {
    warnings.push(`${label} captain is not in the playing XI`);
  }
  if (team.viceCaptainId && !selected.has(String(team.viceCaptainId))) {
    warnings.push(`${label} vice captain is not in the playing XI`);
  }
  return warnings;
}

type PreparedMatchConfig = {
  name: string;
  description?: string;
  venue: string;
  scheduledAt?: Date;
  teamAId: string;
  teamBId: string;
  rules: MatchRulesInput;
  teamAXi: PlayingXiEntryInput[];
  teamBXi: PlayingXiEntryInput[];
  toss?: TossInput;
  warnings: string[];
};

async function prepareMatchConfig(
  auth: AuthContext,
  input: CreateMatchInput | UpdateMatchInput,
  options: { requireComplete: boolean },
): Promise<PreparedMatchConfig> {
  if (!input.name?.trim()) {
    throw new AppError('Match name is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (!input.venue?.trim()) {
    throw new AppError('Venue is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (!input.teamA?.teamId || !input.teamB?.teamId) {
    throw new AppError('Both teams are required', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (input.teamA.teamId === input.teamB.teamId) {
    throw new AppError('Team A and Team B must be different', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (!input.rules) {
    throw new AppError('Match rules are required', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  await assertUsableTeam(input.teamA.teamId, auth);
  await assertUsableTeam(input.teamB.teamId, auth);

  const rules = validateMatchRules(input.rules);
  const requireXi = options.requireComplete;

  const [ctxA, ctxB] = await Promise.all([
    loadRosterContext(input.teamA.teamId, 'Team A'),
    loadRosterContext(input.teamB.teamId, 'Team B'),
  ]);

  const teamAXi = validatePlayingXI(input.teamA.playingXi, { ...ctxA, playersPerSide: rules.playersPerSide, teamId: input.teamA.teamId }, { required: requireXi });
  const teamBXi = validatePlayingXI(input.teamB.playingXi, { ...ctxB, playersPerSide: rules.playersPerSide, teamId: input.teamB.teamId }, { required: requireXi });

  // Cross-team duplicate players
  const allIds = [...teamAXi, ...teamBXi].map((e) => e.playerId);
  if (new Set(allIds).size !== allIds.length) {
    throw new AppError('A player cannot appear in both playing XIs', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const toss = validateToss(
    input.toss,
    input.teamA.teamId,
    input.teamB.teamId,
    { required: requireXi },
  );

  const warnings = [
    ...(await buildCaptainWarnings(input.teamA.teamId, teamAXi, 'Team A')),
    ...(await buildCaptainWarnings(input.teamB.teamId, teamBXi, 'Team B')),
  ];

  return {
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    venue: input.venue.trim(),
    scheduledAt: parseScheduledAt(input.scheduledAt),
    teamAId: input.teamA.teamId,
    teamBId: input.teamB.teamId,
    rules,
    teamAXi,
    teamBXi,
    toss,
    warnings,
  };
}

function applyConfig(match: InstanceType<typeof Match>, cfg: PreparedMatchConfig) {
  match.name = cfg.name;
  match.description = cfg.description;
  match.venue = cfg.venue;
  match.scheduledAt = cfg.scheduledAt;
  match.set('teamA', {
    teamId: parseObjectId(cfg.teamAId, 'Team'),
    playingXi: cfg.teamAXi.map((e) => ({
      playerId: parseObjectId(e.playerId, 'Player'),
      role: e.role,
      battingOrder: e.battingOrder,
      isWicketKeeper: Boolean(e.isWicketKeeper),
      isCaptain: Boolean(e.isCaptain),
      isViceCaptain: Boolean(e.isViceCaptain),
    })),
  });
  match.set('teamB', {
    teamId: parseObjectId(cfg.teamBId, 'Team'),
    playingXi: cfg.teamBXi.map((e) => ({
      playerId: parseObjectId(e.playerId, 'Player'),
      role: e.role,
      battingOrder: e.battingOrder,
      isWicketKeeper: Boolean(e.isWicketKeeper),
      isCaptain: Boolean(e.isCaptain),
      isViceCaptain: Boolean(e.isViceCaptain),
    })),
  });
  match.set('rules', {
    overs: cfg.rules.overs,
    ballsPerOver: cfg.rules.ballsPerOver,
    playersPerSide: cfg.rules.playersPerSide,
    maxOversPerBowler: cfg.rules.maxOversPerBowler,
    powerplayEnabled: Boolean(cfg.rules.powerplayEnabled),
    powerplayOvers: cfg.rules.powerplayOvers ?? 0,
    superOverEnabled: Boolean(cfg.rules.superOverEnabled),
    customRules: cfg.rules.customRules,
  });
  if (cfg.toss) {
    match.set('toss', {
      wonByTeamId: parseObjectId(cfg.toss.wonByTeamId, 'Team'),
      decision: cfg.toss.decision,
    });
  } else {
    match.set('toss', undefined);
  }
}

export async function listMatches(
  auth: AuthContext,
  query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    teamId?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<PaginatedResult<MatchDto>> {
  const { page, limit, skip } = paginateParams(query);
  const filter: Record<string, unknown> = {};
  if (auth.role !== 'ADMIN') filter.createdBy = auth.id;
  if (query.status && query.status !== 'ALL') filter.status = query.status;
  if (query.teamId) {
    filter.$or = [{ 'teamA.teamId': query.teamId }, { 'teamB.teamId': query.teamId }];
  }
  if (query.dateFrom || query.dateTo) {
    const range: Record<string, Date> = {};
    if (query.dateFrom) {
      const d = new Date(query.dateFrom);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }
    if (Object.keys(range).length) filter.scheduledAt = range;
  }
  if (query.search?.trim()) {
    const re = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const searchOr: Record<string, unknown>[] = [{ name: re }, { venue: re }];
    // Also match team names owned by this user
    const teams = await Team.find({
      ...ownerTeamFilter(auth),
      $or: [{ name: re }, { shortName: re }],
    })
      .select('_id')
      .lean();
    const teamIds = teams.map((t) => t._id);
    if (teamIds.length) {
      searchOr.push({ 'teamA.teamId': { $in: teamIds } }, { 'teamB.teamId': { $in: teamIds } });
    }
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or as unknown[] }, { $or: searchOr }];
      delete filter.$or;
    } else {
      filter.$or = searchOr;
    }
  }

  const [items, total] = await Promise.all([
    Match.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Match.countDocuments(filter),
  ]);

  const dtos = await Promise.all(items.map((m) => toMatchDto(m)));
  return toPaginated(dtos, total, page, limit);
}

function ownerTeamFilter(auth: AuthContext) {
  return auth.role === 'ADMIN' ? {} : { createdBy: auth.id };
}

export async function getMatch(auth: AuthContext, matchId: string): Promise<MatchDto> {
  const match = await getOwnedMatch(matchId, auth);
  return toMatchDto(match);
}

export async function createMatch(auth: AuthContext, input: CreateMatchInput): Promise<MatchDto> {
  const asDraft = (input.status ?? 'DRAFT') === 'DRAFT';
  const cfg = await prepareMatchConfig(auth, input, { requireComplete: !asDraft });

  const match = await Match.create({
    name: cfg.name,
    description: cfg.description,
    venue: cfg.venue,
    scheduledAt: cfg.scheduledAt,
    status: asDraft ? 'DRAFT' : 'UPCOMING',
    teamA: {
      teamId: cfg.teamAId,
      playingXi: mapXi(cfg.teamAXi),
    },
    teamB: {
      teamId: cfg.teamBId,
      playingXi: mapXi(cfg.teamBXi),
    },
    rules: cfg.rules,
    toss: cfg.toss
      ? { wonByTeamId: cfg.toss.wonByTeamId, decision: cfg.toss.decision }
      : undefined,
    innings: [],
    snapshot: {},
    version: 0,
    createdBy: auth.id,
  });

  return toMatchDto(match, cfg.warnings);
}

export async function updateMatch(
  auth: AuthContext,
  matchId: string,
  input: UpdateMatchInput,
): Promise<MatchDto> {
  const match = await getOwnedMatch(matchId, auth);
  if (match.status === 'LIVE' || match.status === 'COMPLETED' || match.status === 'ABANDONED') {
    throw new AppError('This match can no longer be edited', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (match.status === 'CANCELLED') {
    throw new AppError('Cancelled matches cannot be edited', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const merged: CreateMatchInput = {
    name: input.name ?? match.name,
    description: input.description ?? match.description ?? undefined,
    venue: input.venue ?? match.venue ?? '',
    scheduledAt: input.scheduledAt ?? (match.scheduledAt ? match.scheduledAt.toISOString() : undefined),
    teamA: input.teamA ?? {
      teamId: String(match.teamA.teamId),
      playingXi: (match.teamA.playingXi ?? []).map((e) => ({
        playerId: String(e.playerId),
        role: e.role as PlayingXiEntryInput['role'],
        battingOrder: e.battingOrder,
        isWicketKeeper: e.isWicketKeeper,
        isCaptain: e.isCaptain,
        isViceCaptain: e.isViceCaptain,
      })),
    },
    teamB: input.teamB ?? {
      teamId: String(match.teamB.teamId),
      playingXi: (match.teamB.playingXi ?? []).map((e) => ({
        playerId: String(e.playerId),
        role: e.role as PlayingXiEntryInput['role'],
        battingOrder: e.battingOrder,
        isWicketKeeper: e.isWicketKeeper,
        isCaptain: e.isCaptain,
        isViceCaptain: e.isViceCaptain,
      })),
    },
    rules: input.rules ?? {
      overs: match.rules.overs,
      ballsPerOver: match.rules.ballsPerOver,
      playersPerSide: match.rules.playersPerSide,
      maxOversPerBowler: match.rules.maxOversPerBowler ?? undefined,
      powerplayEnabled: match.rules.powerplayEnabled,
      powerplayOvers: match.rules.powerplayOvers ?? undefined,
      superOverEnabled: match.rules.superOverEnabled,
      customRules: match.rules.customRules as Record<string, unknown> | undefined,
    },
    toss: input.toss ??
      (match.toss?.wonByTeamId && match.toss.decision
        ? {
            wonByTeamId: String(match.toss.wonByTeamId),
            decision: match.toss.decision as 'BAT' | 'BOWL',
          }
        : undefined),
    status: match.status === 'UPCOMING' ? 'UPCOMING' : 'DRAFT',
  };

  const requireComplete = match.status === 'UPCOMING';
  const cfg = await prepareMatchConfig(auth, merged, { requireComplete });
  applyConfig(match, cfg);
  if (match.status === 'DRAFT' && input.status === 'UPCOMING') {
    // upgrading draft requires complete config
    const complete = await prepareMatchConfig(auth, merged, { requireComplete: true });
    applyConfig(match, complete);
    match.status = 'UPCOMING';
  }
  await match.save();
  return toMatchDto(match, cfg.warnings);
}

export async function startMatch(auth: AuthContext, matchId: string): Promise<MatchDto> {
  const match = await getOwnedMatch(matchId, auth);
  if (match.status === 'LIVE') {
    throw new AppError('Match is already live', { statusCode: 409, code: 'CONFLICT' });
  }
  if (match.status === 'COMPLETED' || match.status === 'ABANDONED' || match.status === 'CANCELLED') {
    throw new AppError('This match cannot be started', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const input: CreateMatchInput = {
    name: match.name,
    description: match.description ?? undefined,
    venue: match.venue ?? '',
    scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : undefined,
    teamA: {
      teamId: String(match.teamA.teamId),
      playingXi: (match.teamA.playingXi ?? []).map((e) => ({
        playerId: String(e.playerId),
        role: e.role as PlayingXiEntryInput['role'],
        battingOrder: e.battingOrder,
        isWicketKeeper: e.isWicketKeeper,
        isCaptain: e.isCaptain,
        isViceCaptain: e.isViceCaptain,
      })),
    },
    teamB: {
      teamId: String(match.teamB.teamId),
      playingXi: (match.teamB.playingXi ?? []).map((e) => ({
        playerId: String(e.playerId),
        role: e.role as PlayingXiEntryInput['role'],
        battingOrder: e.battingOrder,
        isWicketKeeper: e.isWicketKeeper,
        isCaptain: e.isCaptain,
        isViceCaptain: e.isViceCaptain,
      })),
    },
    rules: {
      overs: match.rules.overs,
      ballsPerOver: match.rules.ballsPerOver,
      playersPerSide: match.rules.playersPerSide,
      maxOversPerBowler: match.rules.maxOversPerBowler ?? undefined,
      powerplayEnabled: match.rules.powerplayEnabled,
      powerplayOvers: match.rules.powerplayOvers ?? undefined,
      superOverEnabled: match.rules.superOverEnabled,
      customRules: match.rules.customRules as Record<string, unknown> | undefined,
    },
    toss:
      match.toss?.wonByTeamId && match.toss.decision
        ? {
            wonByTeamId: String(match.toss.wonByTeamId),
            decision: match.toss.decision as 'BAT' | 'BOWL',
          }
        : undefined,
  };

  const cfg = await prepareMatchConfig(auth, input, { requireComplete: true });
  if (!cfg.toss) {
    throw new AppError('Toss is required to start the match', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  applyConfig(match, cfg);
  const sides = deriveInningsTeams(cfg.teamAId, cfg.teamBId, cfg.toss);
  match.status = 'LIVE';
  match.startedAt = new Date();
  match.version = 1;
  const scoring = createInitialMatchState({
    matchId: String(match._id),
    rules: cfg.rules,
    teamAId: cfg.teamAId,
    teamBId: cfg.teamBId,
    battingTeamId: sides.battingTeamId,
    bowlingTeamId: sides.bowlingTeamId,
    version: 1,
  });
  match.innings = scoring.innings as unknown as typeof match.innings;
  match.snapshot = {
    currentInningsIndex: 0,
    scoring,
    scoreSummary: {
      runs: 0,
      wickets: 0,
      legalBalls: 0,
      note: 'Ready for scoring (Phase 5)',
    },
  };

  await match.save();
  await emitAfterScoringMutation({
    match,
    state: scoring,
    event: SocketEvents.MATCH_STARTED,
  });
  return toMatchDto(match, cfg.warnings);
}

/** Create fully configured match and start it in one validated flow. */
export async function createAndStartMatch(
  auth: AuthContext,
  input: CreateMatchInput,
): Promise<MatchDto> {
  const cfg = await prepareMatchConfig(auth, input, { requireComplete: true });
  if (!cfg.toss) {
    throw new AppError('Toss is required to start the match', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  const sides = deriveInningsTeams(cfg.teamAId, cfg.teamBId, cfg.toss);

  const match = await Match.create({
    name: cfg.name,
    description: cfg.description,
    venue: cfg.venue,
    scheduledAt: cfg.scheduledAt,
    status: 'LIVE',
    startedAt: new Date(),
    teamA: { teamId: cfg.teamAId, playingXi: mapXi(cfg.teamAXi) },
    teamB: { teamId: cfg.teamBId, playingXi: mapXi(cfg.teamBXi) },
    rules: cfg.rules,
    toss: { wonByTeamId: cfg.toss.wonByTeamId, decision: cfg.toss.decision },
    version: 1,
    innings: [],
    snapshot: {},
    createdBy: auth.id,
  });

  const scoring = createInitialMatchState({
    matchId: String(match._id),
    rules: cfg.rules,
    teamAId: cfg.teamAId,
    teamBId: cfg.teamBId,
    battingTeamId: sides.battingTeamId,
    bowlingTeamId: sides.bowlingTeamId,
    version: 1,
  });
  match.innings = scoring.innings as unknown as typeof match.innings;
  match.snapshot = {
    currentInningsIndex: 0,
    scoring,
    scoreSummary: {
      runs: 0,
      wickets: 0,
      legalBalls: 0,
      note: 'Ready for scoring (Phase 5)',
    },
  };
  await match.save();

  await emitAfterScoringMutation({
    match,
    state: scoring,
    event: SocketEvents.MATCH_STARTED,
  });

  return toMatchDto(match, cfg.warnings);
}

export async function cancelMatch(auth: AuthContext, matchId: string): Promise<MatchDto> {
  const match = await getOwnedMatch(matchId, auth);
  if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
    throw new AppError('Match cannot be cancelled', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (match.status === 'LIVE') {
    throw new AppError('Live matches must be abandoned, not cancelled', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  match.status = 'CANCELLED';
  await match.save();
  return toMatchDto(match);
}

export async function abandonMatch(auth: AuthContext, matchId: string): Promise<MatchDto> {
  const match = await getOwnedMatch(matchId, auth);
  if (match.status !== 'LIVE') {
    throw new AppError('Only live matches can be abandoned', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  match.status = 'ABANDONED';
  match.completedAt = new Date();
  await match.save();
  return toMatchDto(match);
}

export async function deleteMatch(auth: AuthContext, matchId: string): Promise<void> {
  const match = await getOwnedMatch(matchId, auth);
  if (match.status !== 'DRAFT' && match.status !== 'CANCELLED') {
    throw new AppError('Only draft or cancelled matches can be deleted', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  await match.deleteOne();
}
