/**
 * Local-only helper: start an in-memory MongoDB, then boot the API.
 * Use when Docker/local mongod is unavailable.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('turfscore');

  console.log(`[dev:memory] MongoMemoryServer ready`);
  console.log(`[dev:memory] MONGODB_URI=${uri}`);

  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'watch', 'src/index.ts'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        MONGODB_URI: uri,
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
