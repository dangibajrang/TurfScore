import type { AuthContext } from '../middleware/auth.js';
import {
  Player,
  normalizePlayerRole,
  type PlayerRole,
  type BattingStyle,
  type BowlingStyle,
} from '../models/Player.js';
import { Team } from '../models/Team.js';
import { TeamMembership } from '../models/TeamMembership.js';
import { assertOwnerOrAdmin, parseObjectId } from '../utils/authorization.js';
import { AppError } from '../utils/errors.js';
import { paginateParams, toPaginated, type PaginatedResult } from '../utils/pagination.js';

export type PlayerDto = {
  id: string;
  name: string;
  role: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  profileImageUrl: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  bio: string | null;
  status: string;
  primaryTeamId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type PlayerLean = {
  _id: { toString(): string };
  name: string;
  role: string;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  profileImageUrl?: string | null;
  dateOfBirth?: Date | null;
  phone?: string | null;
  bio?: string | null;
  status?: string;
  isActive?: boolean;
  teamId?: { toString(): string } | null;
  createdBy: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

function toPlayerDto(player: PlayerLean): PlayerDto {
  return {
    id: String(player._id),
    name: player.name,
    role: normalizePlayerRole(player.role),
    battingStyle: player.battingStyle ?? null,
    bowlingStyle: player.bowlingStyle ?? null,
    profileImageUrl: player.profileImageUrl ?? null,
    dateOfBirth: player.dateOfBirth ? player.dateOfBirth.toISOString() : null,
    phone: player.phone ?? null,
    bio: player.bio ?? null,
    status: player.status ?? (player.isActive ? 'ACTIVE' : 'INACTIVE'),
    primaryTeamId: player.teamId ? String(player.teamId) : null,
    createdBy: String(player.createdBy),
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString(),
  };
}

async function getOwnedPlayer(playerId: string, auth: AuthContext) {
  const player = await Player.findById(parseObjectId(playerId, 'Player'));
  if (!player) {
    throw new AppError('Player not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  assertOwnerOrAdmin(player.createdBy, auth);
  return player;
}

export async function listPlayers(
  auth: AuthContext,
  query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    battingStyle?: string;
    bowlingStyle?: string;
  },
): Promise<PaginatedResult<PlayerDto>> {
  const { page, limit, skip } = paginateParams(query);
  const filter: Record<string, unknown> = { status: 'ACTIVE' };
  if (auth.role !== 'ADMIN') {
    filter.createdBy = auth.id;
  }
  if (query.search?.trim()) {
    const re = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.name = re;
  }
  if (query.role) {
    filter.role = query.role === 'BATTER' ? { $in: ['BATTER', 'BATSMAN'] } : query.role;
  }
  if (query.battingStyle) filter.battingStyle = query.battingStyle;
  if (query.bowlingStyle) filter.bowlingStyle = query.bowlingStyle;

  const [items, total] = await Promise.all([
    Player.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Player.countDocuments(filter),
  ]);

  return toPaginated(items.map((p) => toPlayerDto(p as unknown as PlayerLean)), total, page, limit);
}

export async function createPlayer(
  auth: AuthContext,
  input: {
    name: string;
    role?: string;
    battingStyle?: string;
    bowlingStyle?: string;
    profileImageUrl?: string;
    dateOfBirth?: string;
    phone?: string;
    bio?: string;
  },
): Promise<PlayerDto> {
  const role = (input.role === 'BATSMAN' ? 'BATTER' : input.role || 'ALL_ROUNDER') as PlayerRole;
  const player = await Player.create({
    name: input.name.trim(),
    role,
    battingStyle: input.battingStyle as BattingStyle | undefined,
    bowlingStyle: input.bowlingStyle as BowlingStyle | undefined,
    profileImageUrl: input.profileImageUrl || undefined,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
    phone: input.phone?.trim() || undefined,
    bio: input.bio?.trim() || undefined,
    status: 'ACTIVE',
    isActive: true,
    createdBy: auth.id,
  });
  return toPlayerDto(player as unknown as PlayerLean);
}

export async function getPlayer(auth: AuthContext, playerId: string): Promise<PlayerDto> {
  const player = await getOwnedPlayer(playerId, auth);
  return toPlayerDto(player as unknown as PlayerLean);
}

export async function updatePlayer(
  auth: AuthContext,
  playerId: string,
  input: Partial<{
    name: string;
    role: string;
    battingStyle: string;
    bowlingStyle: string;
    profileImageUrl: string;
    dateOfBirth: string;
    phone: string;
    bio: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>,
): Promise<PlayerDto> {
  const player = await getOwnedPlayer(playerId, auth);
  if (input.name !== undefined) player.name = input.name.trim();
  if (input.role !== undefined) {
    player.role = (input.role === 'BATSMAN' ? 'BATTER' : input.role) as PlayerRole;
  }
  if (input.battingStyle !== undefined) {
    player.battingStyle = input.battingStyle as BattingStyle;
  }
  if (input.bowlingStyle !== undefined) {
    player.bowlingStyle = input.bowlingStyle as BowlingStyle;
  }
  if (input.profileImageUrl !== undefined) player.profileImageUrl = input.profileImageUrl || undefined;
  if (input.dateOfBirth !== undefined) {
    player.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : undefined;
  }
  if (input.phone !== undefined) player.phone = input.phone.trim() || undefined;
  if (input.bio !== undefined) player.bio = input.bio.trim() || undefined;
  if (input.status !== undefined) {
    player.status = input.status;
    player.isActive = input.status === 'ACTIVE';
  }
  await player.save();
  return toPlayerDto(player as unknown as PlayerLean);
}

export async function deactivatePlayer(auth: AuthContext, playerId: string): Promise<void> {
  const player = await getOwnedPlayer(playerId, auth);
  player.status = 'INACTIVE';
  player.isActive = false;
  await player.save();

  await TeamMembership.updateMany(
    { playerId: player._id, status: 'ACTIVE' },
    { $set: { status: 'LEFT', leftAt: new Date() } },
  );

  await Team.updateMany({ playerIds: player._id }, { $pull: { playerIds: player._id } });
  await Team.updateMany({ captainId: player._id }, { $unset: { captainId: 1 } });
  await Team.updateMany({ viceCaptainId: player._id }, { $unset: { viceCaptainId: 1 } });
}

export async function getPlayerTeams(auth: AuthContext, playerId: string) {
  const player = await getOwnedPlayer(playerId, auth);
  const memberships = await TeamMembership.find({
    playerId: player._id,
    status: 'ACTIVE',
  }).lean();
  const teamIds = memberships.map((m) => m.teamId);
  const teams = await Team.find({ _id: { $in: teamIds }, isActive: true }).sort({ name: 1 });

  return teams.map((t) => ({
    id: String(t._id),
    name: t.name,
    shortName: t.shortName ?? null,
    logoUrl: t.logoUrl ?? null,
    isCaptain: t.captainId ? String(t.captainId) === String(player._id) : false,
    isViceCaptain: t.viceCaptainId ? String(t.viceCaptainId) === String(player._id) : false,
  }));
}
