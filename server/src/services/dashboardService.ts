import type { AuthContext } from '../middleware/auth.js';
import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import {
  getStatisticsSummary,
  scoreSummaryFromMatch,
} from './statisticsService.js';

function ownerFilter(auth: AuthContext) {
  return auth.role === 'ADMIN' ? {} : { createdBy: auth.id };
}

function toLocalDateKey(value: Date) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getDashboardSummary(auth: AuthContext) {
  const base = ownerFilter(auth);
  const teamFilter = { ...base, isActive: true };
  const playerFilter = { ...base, status: 'ACTIVE' as const };

  const [
    liveCount,
    upcomingCount,
    completedCount,
    teamsCount,
    playersCount,
    liveMatches,
    upcomingMatches,
    recentMatches,
    featuredPlayers,
    recentTeams,
    stats,
  ] = await Promise.all([
    Match.countDocuments({ ...base, status: 'LIVE' }),
    Match.countDocuments({ ...base, status: 'UPCOMING' }),
    Match.countDocuments({ ...base, status: 'COMPLETED' }),
    Team.countDocuments(teamFilter),
    Player.countDocuments(playerFilter),
    Match.find({ ...base, status: 'LIVE' }).sort({ updatedAt: -1 }).limit(5).lean(),
    Match.find({ ...base, status: 'UPCOMING' }).sort({ scheduledAt: 1 }).limit(5).lean(),
    Match.find({ ...base, status: 'COMPLETED' }).sort({ completedAt: -1, updatedAt: -1 }).limit(5).lean(),
    Player.find(playerFilter).sort({ createdAt: -1 }).limit(5).lean(),
    Team.find(teamFilter).sort({ createdAt: -1 }).limit(5).lean(),
    getStatisticsSummary(auth, { range: 'ALL_TIME' }),
  ]);

  const teamIds = [
    ...liveMatches.flatMap((m) => [m.teamA.teamId, m.teamB.teamId]),
    ...upcomingMatches.flatMap((m) => [m.teamA.teamId, m.teamB.teamId]),
    ...recentMatches.flatMap((m) => [m.teamA.teamId, m.teamB.teamId]),
  ];
  const teams = await Team.find({ _id: { $in: teamIds } }).lean();
  const teamMap = new Map(teams.map((t) => [String(t._id), t]));

  const mapMatch = (m: (typeof liveMatches)[number]) => {
    const teamA = teamMap.get(String(m.teamA.teamId));
    const teamB = teamMap.get(String(m.teamB.teamId));
    const isFixture = Boolean(
      (m.correctionMeta as { seedFixture?: boolean } | undefined)?.seedFixture ||
        (m.snapshot as { scoreSummary?: { note?: string } } | undefined)?.scoreSummary?.note ===
          'DEV_FIXTURE',
    );
    return {
      id: String(m._id),
      name: m.name,
      status: m.status,
      venue: m.venue ?? null,
      scheduledAt: m.scheduledAt ? new Date(m.scheduledAt).toISOString() : null,
      completedAt: m.completedAt ? new Date(m.completedAt).toISOString() : null,
      teamA: {
        id: String(m.teamA.teamId),
        name: teamA?.name ?? 'Team A',
        shortName: teamA?.shortName ?? null,
      },
      teamB: {
        id: String(m.teamB.teamId),
        name: teamB?.name ?? 'Team B',
        shortName: teamB?.shortName ?? null,
      },
      resultText: m.resultText ?? null,
      scoreSummary: scoreSummaryFromMatch(m),
      isDevelopmentFixture: isFixture,
      displayNote: isFixture
        ? 'Development fixture — scoring engine not active yet'
        : null,
    };
  };

  const recentForm = recentMatches.map((m) => {
    const text = (m.resultText ?? '').toLowerCase();
    if (text.includes('tie')) {
      return { matchId: String(m._id), outcome: 'TIE' as const, label: m.resultText ?? 'Tie' };
    }
    if (!m.winnerTeamId) {
      return { matchId: String(m._id), outcome: 'NR' as const, label: m.resultText ?? 'No result' };
    }
    return {
      matchId: String(m._id),
      outcome: 'RESULT' as const,
      label: m.resultText ?? 'Completed',
    };
  });

  return {
    metrics: {
      liveMatches: liveCount,
      upcomingMatches: upcomingCount,
      completedMatches: completedCount,
      wins: stats.teamRecords.reduce((sum, t) => sum + t.won, 0),
      teams: teamsCount,
      players: playersCount,
    },
    liveMatches: liveMatches.map(mapMatch),
    upcomingMatches: upcomingMatches.map(mapMatch),
    recentMatches: recentMatches.map(mapMatch),
    recentForm,
    topPerformers: {
      topRunScorer: stats.topBatters[0]
        ? {
            playerId: stats.topBatters[0].playerId,
            name: stats.topBatters[0].name,
            value: stats.topBatters[0].runs,
            label: 'Runs',
          }
        : null,
      topWicketTaker: stats.topBowlers[0]
        ? {
            playerId: stats.topBowlers[0].playerId,
            name: stats.topBowlers[0].name,
            value: stats.topBowlers[0].wickets,
            label: 'Wickets',
          }
        : null,
      bestStrikeRate: stats.bestStrikeRate[0]
        ? {
            playerId: stats.bestStrikeRate[0].playerId,
            name: stats.bestStrikeRate[0].name,
            value: stats.bestStrikeRate[0].strikeRate,
            label: 'Strike rate',
          }
        : null,
      bestEconomy: stats.bestEconomy[0]
        ? {
            playerId: stats.bestEconomy[0].playerId,
            name: stats.bestEconomy[0].name,
            value: stats.bestEconomy[0].economy,
            label: 'Economy',
          }
        : null,
    },
    featuredPlayers: featuredPlayers.map((p) => ({
      id: String(p._id),
      name: p.name,
      role: p.role === 'BATSMAN' ? 'BATTER' : p.role,
      battingStyle: p.battingStyle ?? null,
      bowlingStyle: p.bowlingStyle ?? null,
      profileImageUrl: p.profileImageUrl ?? null,
    })),
    recentTeams: recentTeams.map((t) => ({
      id: String(t._id),
      name: t.name,
      shortName: t.shortName ?? null,
      logoUrl: t.logoUrl ?? null,
      playerCount: t.playerIds?.length ?? 0,
    })),
    calendarHighlights: [...liveMatches, ...upcomingMatches]
      .filter((m) => m.scheduledAt || m.startedAt || m.status === 'LIVE')
      .map((m) => {
        const when = (m.scheduledAt ?? m.startedAt ?? m.updatedAt) as Date;
        return {
          date: toLocalDateKey(when),
          matchId: String(m._id),
          label: m.name,
          status: m.status,
        };
      }),
  };
}
