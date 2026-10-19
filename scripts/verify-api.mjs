import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import safety from './verification-safety.cjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Services must already be provisioned in isolation. Never start the shared
// development Compose stack or infer disposability from a localhost URL alone.
export function verifyApi({ env = process.env, spawn = spawnSync, log = console.log } = {}) {
  safety.validateVerificationTargets(env); // Before any subprocess or service action.
  const testEnv = { ...env, NODE_ENV: 'test' };
  // Preserve the existing verifier's synthetic test-key fallback, without
  // loading implicit .env credentials or mutating the parent environment.
  for (const [key, fallback] of Object.entries({
    STRIPE_SECRET_KEY: 'sk_test_verify_api',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_verify_api',
    STRIPE_WEBHOOK_SECRET: 'whsec_verify_api',
  })) {
    if (!testEnv[key] || /your_|_your|change-this|placeholder/i.test(testEnv[key])) testEnv[key] = fallback;
  }
  log(`[verify:api] DATABASE_URL ${safety.redactConnectionUrl(env.DATABASE_URL)}`);
  log(`[verify:api] REDIS_URL ${safety.redactConnectionUrl(env.REDIS_URL)}`);
  const run = (command, args, cwd, label) => {
    let result;
    try {
      // Capture and suppress raw child output: Prisma/Jest failures may embed URLs.
      result = spawn(command, args, { cwd, env: testEnv, encoding: 'utf8', stdio: 'pipe', shell: false });
    } catch { throw new Error(`${label} failed (child output suppressed).`); }
    if (result.error || result.status !== 0) throw new Error(`${label} failed (child output suppressed).`);
  };
  run('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], path.join(repoRoot, 'tixmoapi2'), 'Schema bootstrap');
  run('npm', ['--prefix', 'tixmoapi2', 'test', '--', '--runInBand'], repoRoot, 'API tests');
  log('[verify:api] API verification passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { verifyApi(); } catch (error) {
    console.error(`[verify:api] ${error.message}`);
    process.exitCode = 1;
  }
}
