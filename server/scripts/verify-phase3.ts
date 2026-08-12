/**
 * Manual Phase 3 API verification against a live server.
 * Usage: node --import tsx scripts/verify-phase3.ts
 */
import 'dotenv/config';

const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:15190';

async function json(res: Response) {
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const stamp = Date.now();
  const email = `verify3_${stamp}@example.com`;
  const password = 'Password123!';

  const register = await json(
    await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Verify User', email, password }),
    }),
  );
  if (register.status !== 201) throw new Error(`register failed: ${JSON.stringify(register)}`);
  const token = register.body.accessToken as string;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const team = await json(
    await fetch(`${API}/api/teams`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: `Verify XI ${stamp}`, shortName: 'VX' }),
    }),
  );
  if (team.status !== 201) throw new Error(`team create failed: ${JSON.stringify(team)}`);

  const player = await json(
    await fetch(`${API}/api/players`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: `Verify Batter ${stamp}`, role: 'BATTER', battingStyle: 'RIGHT_HAND' }),
    }),
  );
  if (player.status !== 201) throw new Error(`player create failed: ${JSON.stringify(player)}`);

  const add = await json(
    await fetch(`${API}/api/teams/${team.body.id}/players/${player.body.id}`, {
      method: 'POST',
      headers: auth,
    }),
  );
  if (add.status !== 200) throw new Error(`add player failed: ${JSON.stringify(add)}`);

  const cap = await json(
    await fetch(`${API}/api/teams/${team.body.id}/captain`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ playerId: player.body.id }),
    }),
  );
  if (cap.status !== 200) throw new Error(`captain failed: ${JSON.stringify(cap)}`);

  const dash = await json(
    await fetch(`${API}/api/dashboard/summary`, { headers: auth }),
  );
  if (dash.status !== 200) throw new Error(`dashboard failed: ${JSON.stringify(dash)}`);
  if (dash.body.metrics.teams < 1 || dash.body.metrics.players < 1) {
    throw new Error(`dashboard counts unexpected: ${JSON.stringify(dash.body.metrics)}`);
  }

  const other = await json(
    await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other User',
        email: `other_${stamp}@example.com`,
        password,
      }),
    }),
  );
  const idor = await json(
    await fetch(`${API}/api/teams/${team.body.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${other.body.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Hacked' }),
    }),
  );
  if (idor.status !== 403) throw new Error(`IDOR not blocked: ${JSON.stringify(idor)}`);

  console.log('Phase 3 manual API verification OK');
  console.log(
    JSON.stringify(
      {
        teamId: team.body.id,
        playerId: player.body.id,
        metrics: dash.body.metrics,
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
