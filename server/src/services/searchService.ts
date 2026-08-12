import type { AuthContext } from '../middleware/auth.js';
import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ownerFilter(auth: AuthContext) {
  if (auth.role === 'ADMIN') return {};
  return { createdBy: auth.id };
}

/**
 * Categorized global search across the caller's matches, teams, and players.
 * Caps each category to keep latency predictable.
 */
export async function globalSearch(auth: AuthContext, q: string, limitPerCategory = 5) {
  const term = q.trim();
  if (term.length < 2) {
    return { matches: [], teams: [], players: [] };
  }

  const re = new RegExp(escapeRegex(term), 'i');
  const base = ownerFilter(auth);
  const cap = Math.min(Math.max(limitPerCategory, 1), 10);

  const matchingTeams = await Team.find({
    ...base,
    isActive: true,
    $or: [{ name: re }, { shortName: re }],
  })
    .sort({ name: 1 })
    .limit(cap)
    .select({ name: 1, shortName: 1, logoUrl: 1 })
    .lean();

  const teamIds = matchingTeams.map((t) => t._id);
  const matchOr: Record<string, unknown>[] = [{ name: re }, { venue: re }];
  if (teamIds.length) {
    matchOr.push({ 'teamA.teamId': { $in: teamIds } }, { 'teamB.teamId': { $in: teamIds } });
  }

  const [matches, players] = await Promise.all([
    Match.find({ ...base, $or: matchOr })
      .sort({ updatedAt: -1 })
      .limit(cap)
      .select({ name: 1, status: 1, venue: 1, teamA: 1, teamB: 1 })
      .lean(),
    Player.find({
      ...base,
      status: 'ACTIVE',
      name: re,
    })
      .sort({ name: 1 })
      .limit(cap)
      .select({ name: 1, role: 1, profileImageUrl: 1 })
      .lean(),
  ]);

  const matchTeamIds = [
    ...new Set(
      matches.flatMap((m) => [String(m.teamA.teamId), String(m.teamB.teamId)]),
    ),
  ];
  const matchTeams = await Team.find({ _id: { $in: matchTeamIds } })
    .select({ name: 1 })
    .lean();
  const teamNameMap = new Map(matchTeams.map((t) => [String(t._id), t.name]));

  return {
    matches: matches.map((m) => ({
      id: String(m._id),
      name: m.name,
      status: m.status,
      venue: m.venue ?? null,
      label: `${teamNameMap.get(String(m.teamA.teamId)) ?? 'Team A'} vs ${
        teamNameMap.get(String(m.teamB.teamId)) ?? 'Team B'
      }`,
    })),
    teams: matchingTeams.map((t) => ({
      id: String(t._id),
      name: t.name,
      shortName: t.shortName ?? null,
      logoUrl: t.logoUrl ?? null,
    })),
    players: players.map((p) => ({
      id: String(p._id),
      name: p.name,
      role: p.role === 'BATSMAN' ? 'BATTER' : p.role,
      profileImageUrl: p.profileImageUrl ?? null,
    })),
  };
}
