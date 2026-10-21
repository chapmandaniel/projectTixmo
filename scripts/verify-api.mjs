import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import safety from './verification-safety.cjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Services must already be provisioned in isolation. Never start the shared
// development Compose stack or infer disposability from a localhost URL alone.
export function verifyApi({ env = process.env, spawn = spawnSync, log = console.log, record } = {}) {
  safety.validateVerificationTargets(env); // Before any subprocess or service action.
  const testEnv = { ...env, NODE_ENV: 'test' };
  // Never pass inherited real provider credentials to local test children.
  for (const key of Object.keys(testEnv)) {
    if (/^(AWS_|S3_|POSTMARK_|SMTP_|STRIPE_|SENTRY_)/.test(key)) delete testEnv[key];
  }
  // Preserve the existing verifier's synthetic test-key fallback, without
  // loading implicit .env credentials or mutating the parent environment.
  for (const [key, fallback] of Object.entries({
    STRIPE_SECRET_KEY: 'sk_test_verify_api',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_verify_api',
    STRIPE_WEBHOOK_SECRET: 'whsec_verify_api',
  })) {
    const normalized = String(testEnv[key] || '').trim().toLowerCase();
    if (!normalized || /your_|_your|change-this|placeholder/.test(normalized)) testEnv[key] = fallback;
  }
  log(`[verify:api] DATABASE_URL ${safety.redactConnectionUrl(env.DATABASE_URL)}`);
  log(`[verify:api] REDIS_URL ${safety.redactConnectionUrl(env.REDIS_URL)}`);
  const run = (command, args, cwd, label) => {
    let result;
    const started = new Date().toISOString();
    try {
      // Capture and suppress raw child output: Prisma/Jest failures may embed URLs.
      result = spawn(command, args, { cwd, env: testEnv, encoding: 'utf8', stdio: 'pipe', shell: false });
    } catch (error) {
      record?.({ command, args: [...args], cwd, started, status: -1, signal: null, error: error.message, stdout: '', stderr: '' });
      throw new Error(`${label} failed (child output suppressed).`);
    }
    record?.({ command, args: [...args], cwd, started, status: result.status ?? -1, signal: result.signal ?? null, error: result.error?.message ?? null, stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
    if (result.error || result.status !== 0) throw new Error(`${label} failed (child output suppressed).`);
  };
  run('npm', ['run', 'build'], path.join(repoRoot, 'tixmoapi2'), 'API build');
  run('npm', ['run', 'migrate'], path.join(repoRoot, 'tixmoapi2'), 'Migration rehearsal');
  run('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], path.join(repoRoot, 'tixmoapi2'), 'Schema bootstrap');
  run('npm', ['--prefix', 'tixmoapi2', 'test', '--', '--runInBand'], repoRoot, 'API tests');
  log('[verify:api] API verification passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { runVerifyApiCli } = await import('./verify-api-cli.mjs');
    runVerifyApiCli({ verify: verifyApi });
  } catch (error) {
    console.error(`[verify:api] ${error.message}`);
    process.exitCode = 1;
  }
}
