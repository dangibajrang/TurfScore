import type { AuthContext } from '../middleware/auth.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { TeamMembership } from '../models/TeamMembership.js';
import { assertOwnerOrAdmin, parseObjectId } from '../utils/authorization.js';
import { AppError } from '../utils/errors.js';
import { paginateParams, toPaginated, type PaginatedResult } from '../utils/pagination.js';

export type TeamDto = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  description: string | null;
  captainId: string | null;
  viceCaptainId: string | null;
  playerCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type TeamLean = {
  _id: { toString(): string };
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  captainId?: { toString(): string } | null;
  viceCaptainId?: { toString(): string } | null;
  playerIds?: Array<{ toString(): string }>;
  createdBy: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

function toTeamDto(team: TeamLean): TeamDto {
  return {
    id: String(team._id),
    name: team.name,
    shortName: team.shortName ?? null,
    logoUrl: team.logoUrl ?? null,
    description: team.description ?? null,
    captainId: team.captainId ? String(team.captainId) : null,
    viceCaptainId: team.viceCaptainId ? String(team.viceCaptainId) : null,
    playerCount: team.playerIds?.length ?? 0,
    createdBy: String(team.createdBy),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

async function getOwnedTeam(teamId: string, auth: AuthContext) {
  const team = await Team.findById(parseObjectId(teamId, 'Team'));
  if (!team || !team.isActive) {
    throw new AppError('Team not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  assertOwnerOrAdmin(team.createdBy, auth);
  return team;
}

export async function listTeams(
  auth: AuthContext,
  query: { page?: number; limit?: number; search?: string },
): Promise<PaginatedResult<TeamDto>> {
  const { page, limit, skip } = paginateParams(query);
  const filter: Record<string, unknown> = { isActive: true };
  if (auth.role !== 'ADMIN') {
    filter.createdBy = auth.id;
  }
  if (query.search?.trim()) {
    const re = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: re }, { shortName: re }];
  }

  const [items, total] = await Promise.all([
    Team.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Team.countDocuments(filter),
  ]);

  return toPaginated(items.map((t) => toTeamDto(t as unknown as TeamLean)), total, page, limit);
}

export async function createTeam(
  auth: AuthContext,
  input: {
    name: string;
    shortName?: string;
    description?: string;
    logoUrl?: string;
  },
): Promise<TeamDto> {
  const team = await Team.create({
    name: input.name.trim(),
    shortName: input.shortName?.trim() || undefined,
    description: input.description?.trim() || undefined,
    logoUrl: input.logoUrl || undefined,
    createdBy: auth.id,
    playerIds: [],
    isActive: true,
  });
  return toTeamDto(team as unknown as TeamLean);
}

export async function getTeam(auth: AuthContext, teamId: string): Promise<TeamDto> {
  const team = await getOwnedTeam(teamId, auth);
  return toTeamDto(team as unknown as TeamLean);
}

export async function updateTeam(
  auth: AuthContext,
  teamId: string,
  input: Partial<{
    name: string;
    shortName: string;
    description: string;
    logoUrl: string;
  }>,
): Promise<TeamDto> {
  const team = await getOwnedTeam(teamId, auth);
  if (input.name !== undefined) team.name = input.name.trim();
  if (input.shortName !== undefined) team.shortName = input.shortName.trim() || undefined;
  if (input.description !== undefined) team.description = input.description.trim() || undefined;
  if (input.logoUrl !== undefined) team.logoUrl = input.logoUrl || undefined;
  await team.save();
  return toTeamDto(team as unknown as TeamLean);
}

export async function deleteTeam(auth: AuthContext, teamId: string): Promise<void> {
  const team = await getOwnedTeam(teamId, auth);
  team.isActive = false;
  team.captainId = undefined;
  team.viceCaptainId = undefined;
  await team.save();

  await TeamMembership.updateMany(
    { teamId: team._id, status: 'ACTIVE' },
    { $set: { status: 'LEFT', leftAt: new Date() } },
  );
}

export async function listTeamPlayers(auth: AuthContext, teamId: string) {
  const team = await getOwnedTeam(teamId, auth);
  const memberships = await TeamMembership.find({ teamId: team._id, status: 'ACTIVE' }).lean();
  const playerIds = memberships.map((m) => m.playerId);
  const players = await Player.find({ _id: { $in: playerIds }, status: 'ACTIVE' }).sort({ name: 1 });

  return players.map((p) => ({
    id: String(p._id),
    name: p.name,
    role: p.role === 'BATSMAN' ? 'BATTER' : p.role,
    battingStyle: p.battingStyle ?? null,
    bowlingStyle: p.bowlingStyle ?? null,
    profileImageUrl: p.profileImageUrl ?? null,
    isCaptain: team.captainId ? String(team.captainId) === String(p._id) : false,
    isViceCaptain: team.viceCaptainId ? String(team.viceCaptainId) === String(p._id) : false,
  }));
}

export async function addPlayerToTeam(
  auth: AuthContext,
  teamId: string,
  playerId: string,
): Promise<TeamDto> {
  const team = await getOwnedTeam(teamId, auth);
  const player = await Player.findById(parseObjectId(playerId, 'Player'));
  if (!player || player.status !== 'ACTIVE') {
    throw new AppError('Player not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  assertOwnerOrAdmin(player.createdBy, auth);

  const existing = await TeamMembership.findOne({
    teamId: team._id,
    playerId: player._id,
    status: 'ACTIVE',
  });
  if (existing) {
    throw new AppError('Player is already on this team', {
      statusCode: 409,
      code: 'CONFLICT',
    });
  }

  await TeamMembership.create({
    teamId: team._id,
    playerId: player._id,
    status: 'ACTIVE',
    joinedAt: new Date(),
    createdBy: auth.id,
  });

  const ids = new Set((team.playerIds ?? []).map(String));
  ids.add(String(player._id));
  team.playerIds = [...ids].map((id) => parseObjectId(id));
  if (!player.teamId) {
    player.teamId = team._id;
    await player.save();
  }
  await team.save();
  return toTeamDto(team as unknown as TeamLean);
}

export async function removePlayerFromTeam(
  auth: AuthContext,
  teamId: string,
  playerId: string,
): Promise<TeamDto> {
  const team = await getOwnedTeam(teamId, auth);
  const pid = parseObjectId(playerId, 'Player');

  const membership = await TeamMembership.findOne({
    teamId: team._id,
    playerId: pid,
    status: 'ACTIVE',
  });
  if (!membership) {
    throw new AppError('Player is not on this team', { statusCode: 404, code: 'NOT_FOUND' });
  }

  membership.status = 'LEFT';
  membership.leftAt = new Date();
  await membership.save();

  team.playerIds = (team.playerIds ?? []).filter((id) => String(id) !== String(pid));
  if (team.captainId && String(team.captainId) === String(pid)) {
    team.captainId = undefined;
  }
  if (team.viceCaptainId && String(team.viceCaptainId) === String(pid)) {
    team.viceCaptainId = undefined;
  }
  await team.save();
  return toTeamDto(team as unknown as TeamLean);
}

async function assertPlayerOnTeam(team: Awaited<ReturnType<typeof getOwnedTeam>>, playerId: string) {
  const pid = parseObjectId(playerId, 'Player');
  const membership = await TeamMembership.findOne({
    teamId: team._id,
    playerId: pid,
    status: 'ACTIVE',
  });
  if (!membership) {
    throw new AppError('Player must belong to the team', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  return pid;
}

export async function setCaptain(
  auth: AuthContext,
  teamId: string,
  playerId: string,
): Promise<TeamDto> {
  const team = await getOwnedTeam(teamId, auth);
  const pid = await assertPlayerOnTeam(team, playerId);
  if (team.viceCaptainId && String(team.viceCaptainId) === String(pid)) {
    throw new AppError('Captain and vice captain must be different players', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  team.captainId = pid;
  await team.save();
  return toTeamDto(team as unknown as TeamLean);
}

export async function setViceCaptain(
  auth: AuthContext,
  teamId: string,
  playerId: string,
): Promise<TeamDto> {
  const team = await getOwnedTeam(teamId, auth);
  const pid = await assertPlayerOnTeam(team, playerId);
  if (team.captainId && String(team.captainId) === String(pid)) {
    throw new AppError('Captain and vice captain must be different players', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  team.viceCaptainId = pid;
  await team.save();
  return toTeamDto(team as unknown as TeamLean);
}
