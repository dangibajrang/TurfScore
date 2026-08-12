/**
 * Boots API against MongoMemoryServer for Playwright E2E (no file watcher).
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('turfscore-e2e');

  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'src/index.ts'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        MONGODB_URI: uri,
        CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5190',
        JWT_ACCESS_SECRET:
          process.env.JWT_ACCESS_SECRET || 'e2e-access-secret-min-32-characters!!',
        JWT_REFRESH_SECRET:
          process.env.JWT_REFRESH_SECRET || 'e2e-refresh-secret-min-32-characters!',
        LOG_LEVEL: process.env.LOG_LEVEL || 'error',
      },
      stdio: 'inherit',
      shell: true,
    },
  );

  const shutdown = async () => {
    if (!child.killed) child.kill('SIGTERM');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  child.on('exit', async (code) => {
    await mongod.stop();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
