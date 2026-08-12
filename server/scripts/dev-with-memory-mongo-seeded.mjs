/**
 * Boot memory Mongo, seed, then start API — for local Phase 2 verification.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('turfscore');
  console.log('[dev:seeded] MongoMemoryServer ready');

  const env = {
    ...process.env,
    MONGODB_URI: uri,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  await new Promise((resolve, reject) => {
    const seed = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'scripts/seed.ts', '--reset'], {
      cwd: rootDir,
      env,
      stdio: 'inherit',
      shell: true,
    });
    seed.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`seed exited ${code}`))));
  });

  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'watch', 'src/index.ts'],
    { cwd: rootDir, env, stdio: 'inherit', shell: true },
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
