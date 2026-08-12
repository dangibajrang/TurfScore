import type { AuthContext } from '../middleware/auth.js';
import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { AppError } from '../utils/errors.js';
import type { BatterState, BowlerState, InningsState, MatchState } from './cricket/types.js';

export type StatsRange = 'ALL_TIME' | 'THIS_MONTH' | 'THIS_YEAR';

function ownerFilter(auth: AuthContext) {
  return auth.role === 'ADMIN' ? {} : { createdBy: auth.id };
}

function rangeFilter(range: StatsRange = 'ALL_TIME'): Record<string, unknown> {
  const now = new Date();
  if (range === 'THIS_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { completedAt: { $gte: start } };
  }
  if (range === 'THIS_YEAR') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { completedAt: { $gte: start } };
  }
  return {};
}

type BatterAgg = {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  innings: number;
  notOuts: number;
  fifties: number;
  hundreds: number;
  highest: number;
  highestNotOut: boolean;
};

type BowlerAgg = {
  playerId: string;
  wickets: number;
  runsConceded: number;
  legalBalls: number;
  maidens: number;
  innings: number;
  fourWickets: number;
  fiveWickets: number;
  bestWickets: number;
  bestRuns: number;
};

type TeamAgg = {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  ties: number;
  noResults: number;
  runsFor: number;
  runsAgainst: number;
  wicketsTaken: number;
  highestScore: number;
};

function strikeRate(runs: number, balls: number): number {
  if (balls <= 0) return 0;
  return Math.round((runs / balls) * 1000) / 10;
}

function battingAverage(runs: number, dismissals: number): number | null {
  if (dismissals <= 0) return null;
  return Math.round((runs / dismissals) * 10) / 10;
}

function bowlingAverage(runsConceded: number, wickets: number): number | null {
  if (wickets <= 0) return null;
  return Math.round((runsConceded / wickets) * 10) / 10;
}

function bowlingStrikeRate(legalBalls: number, wickets: number): number | null {
  if (wickets <= 0) return null;
  return Math.round((legalBalls / wickets) * 10) / 10;
}

function economy(runsConceded: number, legalBalls: number, ballsPerOver = 6): number {
  if (legalBalls <= 0) return 0;
  const overs = legalBalls / ballsPerOver;
  return Math.round((runsConceded / overs) * 10) / 10;
}

function oversDisplay(legalBalls: number, ballsPerOver = 6): string {
  const overs = Math.floor(legalBalls / ballsPerOver);
  const balls = legalBalls % ballsPerOver;
  return `${overs}.${balls}`;
}

function formatBestScore(runs: number, notOut: boolean): string {
  return notOut ? `${runs}*` : String(runs);
}

function formatBestBowling(wickets: number, runs: number): string | null {
  if (wickets <= 0 && runs <= 0) return null;
  return `${wickets}/${runs}`;
}

/** Sample completed matches for the owner (snapshot-based career stats). */
export async function loadCompletedMatches(
  auth: AuthContext,
  opts?: { limit?: number; range?: StatsRange },
) {
  const limit = Math.min(opts?.limit ?? 500, 500);
  const base = { ...ownerFilter(auth), status: 'COMPLETED' as const, ...rangeFilter(opts?.range) };
  return Match.find(base)
    .sort({ completedAt: -1, updatedAt: -1 })
    .limit(limit)
    .lean();
}

export function extractInningsScore(
  inn: InningsState,
  ballsPerOver = 6,
): { runs: number; wickets: number; overs: string; battingTeamId: string } {
  return {
    runs: inn.totalRuns ?? 0,
    wickets: inn.wickets ?? 0,
    overs: oversDisplay(inn.legalBalls ?? 0, ballsPerOver),
    battingTeamId: String(inn.battingTeamId),
  };
}

export function scoreSummaryFromMatch(match: {
  teamA: { teamId: unknown };
  teamB: { teamId: unknown };
  snapshot?: { scoring?: MatchState; scoreSummary?: unknown } | null;
  rules?: { ballsPerOver?: number };
}) {
  const scoring = match.snapshot?.scoring;
  const bpo = match.rules?.ballsPerOver ?? 6;
  const teamAId = String(match.teamA.teamId);
  const teamBId = String(match.teamB.teamId);

  if (!scoring?.innings?.length) {
    return null;
  }

  const byTeam = new Map<string, { runs: number; wickets: number; overs: string }>();
  for (const inn of scoring.innings as InningsState[]) {
    const s = extractInningsScore(inn, bpo);
    byTeam.set(s.battingTeamId, {
      runs: s.runs,
      wickets: s.wickets,
      overs: s.overs,
    });
  }

  return {
    teamA: byTeam.get(teamAId) ?? null,
    teamB: byTeam.get(teamBId) ?? null,
  };
}

export function aggregateFromMatches(
  completedMatches: Awaited<ReturnType<typeof loadCompletedMatches>>,
) {
  const batterMap = new Map<string, BatterAgg>();
  const bowlerMap = new Map<string, BowlerAgg>();
  const teamMapAgg = new Map<string, TeamAgg>();

  const bumpTeam = (
    teamId: string,
    field: keyof Omit<TeamAgg, 'teamId'>,
    amount = 1,
  ) => {
    const cur = teamMapAgg.get(teamId) ?? {
      teamId,
      played: 0,
      won: 0,
      lost: 0,
      ties: 0,
      noResults: 0,
      runsFor: 0,
      runsAgainst: 0,
      wicketsTaken: 0,
      highestScore: 0,
    };
    (cur[field] as number) += amount;
    teamMapAgg.set(teamId, cur);
  };

  for (const match of completedMatches) {
    const teamAId = String(match.teamA.teamId);
    const teamBId = String(match.teamB.teamId);
    bumpTeam(teamAId, 'played');
    bumpTeam(teamBId, 'played');

    if (match.winnerTeamId) {
      const winner = String(match.winnerTeamId);
      bumpTeam(winner, 'won');
      bumpTeam(winner === teamAId ? teamBId : teamAId, 'lost');
    } else if (match.resultText?.toLowerCase().includes('tie')) {
      bumpTeam(teamAId, 'ties');
      bumpTeam(teamBId, 'ties');
    } else {
      bumpTeam(teamAId, 'noResults');
      bumpTeam(teamBId, 'noResults');
    }

    const scoring = (match.snapshot as { scoring?: MatchState } | undefined)?.scoring;
    const innings = (scoring?.innings ?? []) as InningsState[];
    const bpo = scoring?.rules?.ballsPerOver ?? match.rules?.ballsPerOver ?? 6;

    for (const inn of innings) {
      const battingId = String(inn.battingTeamId);
      const bowlingId = String(inn.bowlingTeamId);
      const innRuns = inn.totalRuns ?? 0;
      bumpTeam(battingId, 'runsFor', innRuns);
      bumpTeam(bowlingId, 'runsAgainst', innRuns);
      bumpTeam(bowlingId, 'wicketsTaken', inn.wickets ?? 0);
      const t = teamMapAgg.get(battingId);
      if (t && innRuns > t.highestScore) t.highestScore = innRuns;

      const batters = Object.values(inn.batters ?? {}) as BatterState[];
      for (const b of batters) {
        if (!b?.playerId) continue;
        const id = String(b.playerId);
        const cur = batterMap.get(id) ?? {
          playerId: id,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          innings: 0,
          notOuts: 0,
          fifties: 0,
          hundreds: 0,
          highest: 0,
          highestNotOut: false,
        };
        const runs = b.runs ?? 0;
        const notOut = !b.isOut && !b.isRetiredHurt;
        cur.runs += runs;
        cur.balls += b.balls ?? 0;
        cur.fours += b.fours ?? 0;
        cur.sixes += b.sixes ?? 0;
        cur.innings += 1;
        if (notOut) cur.notOuts += 1;
        if (runs >= 100) cur.hundreds += 1;
        else if (runs >= 50) cur.fifties += 1;
        if (runs > cur.highest || (runs === cur.highest && notOut && !cur.highestNotOut)) {
          cur.highest = runs;
          cur.highestNotOut = notOut;
        }
        batterMap.set(id, cur);
      }

      const bowlers = Object.values(inn.bowlers ?? {}) as BowlerState[];
      for (const bowl of bowlers) {
        if (!bowl?.playerId) continue;
        const id = String(bowl.playerId);
        const cur = bowlerMap.get(id) ?? {
          playerId: id,
          wickets: 0,
          runsConceded: 0,
          legalBalls: 0,
          maidens: 0,
          innings: 0,
          fourWickets: 0,
          fiveWickets: 0,
          bestWickets: 0,
          bestRuns: 0,
        };
        const w = bowl.wickets ?? 0;
        const r = bowl.runsConceded ?? 0;
        cur.wickets += w;
        cur.runsConceded += r;
        cur.legalBalls += bowl.legalBalls ?? 0;
        cur.maidens += bowl.maidens ?? 0;
        cur.innings += 1;
        if (w >= 5) cur.fiveWickets += 1;
        else if (w >= 4) cur.fourWickets += 1;
        if (
          w > cur.bestWickets ||
          (w === cur.bestWickets && (cur.bestWickets === 0 || r < cur.bestRuns))
        ) {
          cur.bestWickets = w;
          cur.bestRuns = r;
        }
        bowlerMap.set(id, cur);
        void bpo;
      }
    }
  }

  return { batterMap, bowlerMap, teamMapAgg };
}

function mapBatterRow(b: BatterAgg, name: string, profileImageUrl: string | null) {
  const dismissals = Math.max(0, b.innings - b.notOuts);
  return {
    playerId: b.playerId,
    name,
    profileImageUrl,
    matches: b.innings,
    innings: b.innings,
    runs: b.runs,
    balls: b.balls,
    fours: b.fours,
    sixes: b.sixes,
    notOuts: b.notOuts,
    fifties: b.fifties,
    hundreds: b.hundreds,
    highestScore: b.highest,
    highestScoreDisplay: formatBestScore(b.highest, b.highestNotOut),
    average: battingAverage(b.runs, dismissals),
    strikeRate: strikeRate(b.runs, b.balls),
  };
}

function mapBowlerRow(b: BowlerAgg, name: string, profileImageUrl: string | null) {
  return {
    playerId: b.playerId,
    name,
    profileImageUrl,
    matches: b.innings,
    innings: b.innings,
    wickets: b.wickets,
    runsConceded: b.runsConceded,
    overs: oversDisplay(b.legalBalls),
    legalBalls: b.legalBalls,
    maidens: b.maidens,
    fourWickets: b.fourWickets,
    fiveWickets: b.fiveWickets,
    bestBowling: formatBestBowling(b.bestWickets, b.bestRuns),
    average: bowlingAverage(b.runsConceded, b.wickets),
    strikeRate: bowlingStrikeRate(b.legalBalls, b.wickets),
    economy: economy(b.runsConceded, b.legalBalls),
  };
}

export async function getStatisticsSummary(
  auth: AuthContext,
  opts?: { range?: StatsRange },
) {
  const range = opts?.range ?? 'ALL_TIME';
  const base = ownerFilter(auth);

  const [completedCount, liveCount, teamsCount, playersCount, completedMatches] =
    await Promise.all([
      Match.countDocuments({ ...base, status: 'COMPLETED', ...rangeFilter(range) }),
      Match.countDocuments({ ...base, status: 'LIVE' }),
      Team.countDocuments({ ...base, isActive: true }),
      Player.countDocuments({ ...base, status: 'ACTIVE' }),
      loadCompletedMatches(auth, { limit: 500, range }),
    ]);

  const wins = completedMatches.filter((m) => m.winnerTeamId).length;
  const { batterMap, bowlerMap, teamMapAgg } = aggregateFromMatches(completedMatches);

  const playerIds = [...new Set([...batterMap.keys(), ...bowlerMap.keys()])];
  const teamIds = [...teamMapAgg.keys()];

  const [players, teams] = await Promise.all([
    Player.find({ _id: { $in: playerIds } }).lean(),
    Team.find({ _id: { $in: teamIds } }).lean(),
  ]);
  const playerName = new Map(players.map((p) => [String(p._id), p.name]));
  const playerImage = new Map(
    players.map((p) => [String(p._id), (p.profileImageUrl as string | undefined) ?? null]),
  );
  const teamInfo = new Map(
    teams.map((t) => [
      String(t._id),
      { name: t.name, shortName: (t.shortName as string | undefined) ?? null },
    ]),
  );

  const topBatters = [...batterMap.values()]
    .filter((b) => b.runs > 0 || b.balls > 0)
    .sort((a, b) => b.runs - a.runs || b.balls - a.balls)
    .slice(0, 10)
    .map((b) =>
      mapBatterRow(
        b,
        playerName.get(b.playerId) ?? 'Unknown player',
        playerImage.get(b.playerId) ?? null,
      ),
    );

  const topBowlers = [...bowlerMap.values()]
    .filter((b) => b.wickets > 0 || b.legalBalls > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
    .slice(0, 10)
    .map((b) =>
      mapBowlerRow(
        b,
        playerName.get(b.playerId) ?? 'Unknown player',
        playerImage.get(b.playerId) ?? null,
      ),
    );

  const bestStrikeRate = [...batterMap.values()]
    .filter((b) => b.balls >= 20)
    .sort((a, b) => strikeRate(b.runs, b.balls) - strikeRate(a.runs, a.balls))
    .slice(0, 10)
    .map((b) =>
      mapBatterRow(
        b,
        playerName.get(b.playerId) ?? 'Unknown player',
        playerImage.get(b.playerId) ?? null,
      ),
    );

  const bestEconomy = [...bowlerMap.values()]
    .filter((b) => b.legalBalls >= 12)
    .sort(
      (a, b) =>
        economy(a.runsConceded, a.legalBalls) - economy(b.runsConceded, b.legalBalls),
    )
    .slice(0, 10)
    .map((b) =>
      mapBowlerRow(
        b,
        playerName.get(b.playerId) ?? 'Unknown player',
        playerImage.get(b.playerId) ?? null,
      ),
    );

  const teamRecords = [...teamMapAgg.values()]
    .sort((a, b) => b.won - a.won || b.played - a.played)
    .slice(0, 10)
    .map((t) => {
      const info = teamInfo.get(t.teamId);
      return {
        teamId: t.teamId,
        name: info?.name ?? 'Unknown team',
        shortName: info?.shortName ?? null,
        played: t.played,
        won: t.won,
        lost: t.lost,
        ties: t.ties,
        winPct: t.played > 0 ? Math.round((t.won / t.played) * 1000) / 10 : 0,
      };
    });

  const recentResults = completedMatches.slice(0, 8).map((m) => {
    const teamA = teamInfo.get(String(m.teamA.teamId));
    const teamB = teamInfo.get(String(m.teamB.teamId));
    const scores = scoreSummaryFromMatch(m);
    return {
      id: String(m._id),
      name: m.name,
      resultText: m.resultText ?? null,
      completedAt: m.completedAt ? new Date(m.completedAt).toISOString() : null,
      scoreSummary: scores,
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
    };
  });

  return {
    source: 'match_snapshots' as const,
    range,
    note: 'Built from completed match scoring snapshots (rebuildable from delivery events). Sample up to 500 matches.',
    metrics: {
      completedMatches: completedCount,
      liveMatches: liveCount,
      teams: teamsCount,
      players: playersCount,
      wins,
      matchesSampled: completedMatches.length,
    },
    topBatters,
    topBowlers,
    bestStrikeRate,
    bestEconomy,
    teamRecords,
    recentResults,
  };
}

export async function getPlayerStatistics(
  auth: AuthContext,
  playerId: string,
  opts?: { range?: StatsRange },
) {
  const base = ownerFilter(auth);
  const player = await Player.findOne({ _id: playerId, ...base }).lean();
  if (!player) {
    throw new AppError('Player not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const range = opts?.range ?? 'ALL_TIME';
  const completedMatches = await loadCompletedMatches(auth, { limit: 500, range });
  const { batterMap, bowlerMap } = aggregateFromMatches(completedMatches);
  const batting = batterMap.get(playerId);
  const bowling = bowlerMap.get(playerId);

  const appearances = completedMatches.filter((m) => {
    const scoring = (m.snapshot as { scoring?: MatchState } | undefined)?.scoring;
    const innings = (scoring?.innings ?? []) as InningsState[];
    return innings.some((inn) => {
      const batters = Object.values(inn.batters ?? {}) as BatterState[];
      const bowlers = Object.values(inn.bowlers ?? {}) as BowlerState[];
      return (
        batters.some((b) => String(b.playerId) === playerId) ||
        bowlers.some((b) => String(b.playerId) === playerId)
      );
    });
  });

  const recentForm = appearances.slice(0, 5).map((m) => {
    const scoring = (m.snapshot as { scoring?: MatchState } | undefined)?.scoring;
    const innings = (scoring?.innings ?? []) as InningsState[];
    let runs = 0;
    let balls = 0;
    let wickets = 0;
    let notOut = false;
    for (const inn of innings) {
      const bat = Object.values(inn.batters ?? {}).find(
        (b) => String((b as BatterState).playerId) === playerId,
      ) as BatterState | undefined;
      if (bat) {
        runs += bat.runs ?? 0;
        balls += bat.balls ?? 0;
        notOut = !bat.isOut && !bat.isRetiredHurt;
      }
      const bowl = Object.values(inn.bowlers ?? {}).find(
        (b) => String((b as BowlerState).playerId) === playerId,
      ) as BowlerState | undefined;
      if (bowl) wickets += bowl.wickets ?? 0;
    }
    return {
      matchId: String(m._id),
      matchName: m.name,
      completedAt: m.completedAt ? new Date(m.completedAt).toISOString() : null,
      resultText: m.resultText ?? null,
      runs,
      balls,
      wickets,
      battingDisplay: balls > 0 || runs > 0 ? `${formatBestScore(runs, notOut)} (${balls})` : null,
    };
  });

  return {
    source: 'match_snapshots' as const,
    range,
    playerId,
    name: player.name,
    profileImageUrl: (player.profileImageUrl as string | undefined) ?? null,
    role: player.role,
    battingStyle: player.battingStyle ?? null,
    bowlingStyle: player.bowlingStyle ?? null,
    matchesPlayed: appearances.length,
    batting: batting
      ? mapBatterRow(batting, player.name, (player.profileImageUrl as string | undefined) ?? null)
      : null,
    bowling: bowling
      ? mapBowlerRow(bowling, player.name, (player.profileImageUrl as string | undefined) ?? null)
      : null,
    recentForm,
  };
}

export async function getPlayerMatchHistory(
  auth: AuthContext,
  playerId: string,
  opts?: { page?: number; limit?: number },
) {
  const base = ownerFilter(auth);
  const player = await Player.findOne({ _id: playerId, ...base }).lean();
  if (!player) {
    throw new AppError('Player not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 20));
  const completedMatches = await loadCompletedMatches(auth, { limit: 500 });

  const rows = [];
  for (const m of completedMatches) {
    const scoring = (m.snapshot as { scoring?: MatchState } | undefined)?.scoring;
    const innings = (scoring?.innings ?? []) as InningsState[];
    let appeared = false;
    let runs = 0;
    let balls = 0;
    let wickets = 0;
    let teamId: string | null = null;

    for (const inn of innings) {
      const bat = Object.values(inn.batters ?? {}).find(
        (b) => String((b as BatterState).playerId) === playerId,
      ) as BatterState | undefined;
      if (bat) {
        appeared = true;
        runs += bat.runs ?? 0;
        balls += bat.balls ?? 0;
        teamId = String(inn.battingTeamId);
      }
      const bowl = Object.values(inn.bowlers ?? {}).find(
        (b) => String((b as BowlerState).playerId) === playerId,
      ) as BowlerState | undefined;
      if (bowl) {
        appeared = true;
        wickets += bowl.wickets ?? 0;
        if (!teamId) teamId = String(inn.bowlingTeamId);
      }
    }
    if (!appeared) continue;

    const xiA = (m.teamA.playingXi ?? []).some((e) => String(e.playerId) === playerId);
    const xiB = (m.teamB.playingXi ?? []).some((e) => String(e.playerId) === playerId);
    if (xiA) teamId = String(m.teamA.teamId);
    if (xiB) teamId = String(m.teamB.teamId);

    rows.push({
      matchId: String(m._id),
      matchName: m.name,
      date: m.completedAt ? new Date(m.completedAt).toISOString() : null,
      venue: m.venue ?? null,
      teamId,
      runs,
      balls,
      wickets,
      resultText: m.resultText ?? null,
      scoreSummary: scoreSummaryFromMatch(m),
    });
  }

  const total = rows.length;
  const start = (page - 1) * limit;
  const items = rows.slice(start, start + limit);
  const teamIds = [...new Set(items.map((r) => r.teamId).filter(Boolean))] as string[];
  const teams = await Team.find({ _id: { $in: teamIds } }).lean();
  const teamMap = new Map(teams.map((t) => [String(t._id), t.name]));

  return {
    items: items.map((r) => ({
      ...r,
      teamName: r.teamId ? (teamMap.get(r.teamId) ?? null) : null,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getTeamStatistics(
  auth: AuthContext,
  teamId: string,
  opts?: { range?: StatsRange },
) {
  const base = ownerFilter(auth);
  const team = await Team.findOne({ _id: teamId, ...base }).lean();
  if (!team) {
    throw new AppError('Team not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const range = opts?.range ?? 'ALL_TIME';
  const completedMatches = await loadCompletedMatches(auth, { limit: 500, range });
  const relevant = completedMatches.filter(
    (m) => String(m.teamA.teamId) === teamId || String(m.teamB.teamId) === teamId,
  );
  const { teamMapAgg } = aggregateFromMatches(relevant);
  const agg = teamMapAgg.get(teamId) ?? {
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    ties: 0,
    noResults: 0,
    runsFor: 0,
    runsAgainst: 0,
    wicketsTaken: 0,
    highestScore: 0,
  };

  const recentMatches = relevant.slice(0, 10).map((m) => ({
    id: String(m._id),
    name: m.name,
    resultText: m.resultText ?? null,
    completedAt: m.completedAt ? new Date(m.completedAt).toISOString() : null,
    scoreSummary: scoreSummaryFromMatch(m),
    opponent:
      String(m.teamA.teamId) === teamId
        ? { id: String(m.teamB.teamId) }
        : { id: String(m.teamA.teamId) },
  }));

  const opponentIds = recentMatches.map((r) => r.opponent.id);
  const opponents = await Team.find({ _id: { $in: opponentIds } }).lean();
  const oppMap = new Map(opponents.map((t) => [String(t._id), t.name]));

  return {
    source: 'match_snapshots' as const,
    range,
    teamId,
    name: team.name,
    shortName: team.shortName ?? null,
    logoUrl: team.logoUrl ?? null,
    statistics: {
      matches: agg.played,
      wins: agg.won,
      losses: agg.lost,
      ties: agg.ties,
      noResults: agg.noResults,
      winPct: agg.played > 0 ? Math.round((agg.won / agg.played) * 1000) / 10 : 0,
      totalRuns: agg.runsFor,
      averageScore:
        agg.played > 0 ? Math.round((agg.runsFor / Math.max(1, agg.played)) * 10) / 10 : 0,
      highestScore: agg.highestScore,
      wickets: agg.wicketsTaken,
      averageRunsConceded:
        agg.played > 0
          ? Math.round((agg.runsAgainst / Math.max(1, agg.played)) * 10) / 10
          : 0,
    },
    recentMatches: recentMatches.map((r) => ({
      ...r,
      opponent: { id: r.opponent.id, name: oppMap.get(r.opponent.id) ?? 'Opponent' },
    })),
  };
}
