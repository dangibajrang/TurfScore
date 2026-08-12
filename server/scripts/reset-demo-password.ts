/**
 * Reset demo login password only (no match reseed).
 * Usage: npx tsx scripts/reset-demo-password.ts
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadEnv, resetEnvCache } from '../src/config/env.js';
import { User } from '../src/models/User.js';

const EMAIL = (process.env.DEMO_EMAIL || 'bajrangdangi937@gmail.com').toLowerCase();
const PASSWORD = process.env.DEMO_PASSWORD || 'Bajrang@9754';

async function main() {
  resetEnvCache();
  loadEnv();
  await connectDatabase();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const updated = await User.updateOne(
    { email: EMAIL },
    {
      $set: {
        name: 'Bajrang Dangi',
        passwordHash,
        role: 'USER',
        isActive: true,
      },
      $setOnInsert: { email: EMAIL },
    },
    { upsert: true },
  );

  const user = await User.findOne({ email: EMAIL }).select('+passwordHash');
  const ok = user ? await bcrypt.compare(PASSWORD, user.passwordHash) : false;

  console.log(
    JSON.stringify(
      {
        email: EMAIL,
        matched: updated.matchedCount,
        modified: updated.modifiedCount,
        upserted: Boolean(updated.upsertedCount),
        userFound: Boolean(user),
        passwordMatches: ok,
        isActive: user?.isActive ?? null,
      },
      null,
      2,
    ),
  );

  if (!ok) {
    throw new Error('Password reset verification failed');
  }
}

main()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await disconnectDatabase();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
