/**
 * Phase 4 API verification against a live server.
 * Usage: npx tsx scripts/verify-phase4.ts
 */
import 'dotenv/config';

const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:15190';

async function json(res: Response) {
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const stamp = Date.now();
  const password = 'Password123!';
  const email = `verify4_${stamp}@example.com`;

  const register = await json(
    await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Verify Four', email, password }),
    }),
  );
  if (register.status !== 201) throw new Error(`register failed: ${JSON.stringify(register)}`);
  const token = register.body.accessToken as string;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function teamWithPlayers(name: string, players: string[]) {
    const team = await json(
      await fetch(`${API}/api/teams`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ name, shortName: name.slice(0, 3).toUpperCase() }),
      }),
    );
    if (team.status !== 201) throw new Error(`team failed: ${JSON.stringify(team)}`);
    const created = [];
    for (const pName of players) {
      const p = await json(
        await fetch(`${API}/api/players`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ name: pName, role: 'ALL_ROUNDER' }),
        }),
      );
      if (p.status !== 201) throw new Error(`player failed: ${JSON.stringify(p)}`);
      const add = await json(
        await fetch(`${API}/api/teams/${team.body.id}/players/${p.body.id}`, {
          method: 'POST',
          headers: auth,
        }),
      );
      if (add.status !== 200) throw new Error(`roster failed: ${JSON.stringify(add)}`);
      created.push(p.body);
    }
    return { team: team.body, players: created };
  }

  const a = await teamWithPlayers(`V4A ${stamp}`, [`VA1 ${stamp}`, `VA2 ${stamp}`]);
  const b = await teamWithPlayers(`V4B ${stamp}`, [`VB1 ${stamp}`, `VB2 ${stamp}`]);

  const xi = (players: Array<{ id: string }>) =>
    players.map((p, i) => ({
      playerId: p.id,
      battingOrder: i + 1,
      role: 'ALL_ROUNDER',
      isWicketKeeper: i === 0,
    }));

  const live = await json(
    await fetch(`${API}/api/matches`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        name: `Verify Clash ${stamp}`,
        venue: 'Green Arena',
        scheduledAt: new Date().toISOString(),
        teamA: { teamId: a.team.id, playingXi: xi(a.players) },
        teamB: { teamId: b.team.id, playingXi: xi(b.players) },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2, maxOversPerBowler: 2 },
        toss: { wonByTeamId: b.team.id, decision: 'BAT' },
        startNow: true,
      }),
    }),
  );
  if (live.status !== 201 || live.body.status !== 'LIVE') {
    throw new Error(`start failed: ${JSON.stringify(live)}`);
  }
  if (live.body.version !== 1 || !live.body.innings?.length) {
    throw new Error(`initial state invalid: ${JSON.stringify(live.body)}`);
  }

  const other = await json(
    await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other',
        email: `other4_${stamp}@example.com`,
        password,
      }),
    }),
  );
  const idor = await json(
    await fetch(`${API}/api/matches/${live.body.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${other.body.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Hacked' }),
    }),
  );
  if (idor.status !== 403) throw new Error(`IDOR not blocked: ${JSON.stringify(idor)}`);

  console.log('Phase 4 manual API verification OK');
  console.log(
    JSON.stringify(
      {
        matchId: live.body.id,
        status: live.body.status,
        version: live.body.version,
        firstInnings: live.body.firstInnings,
        idorBlocked: true,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
