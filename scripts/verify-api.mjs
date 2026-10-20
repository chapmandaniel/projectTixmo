import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
    const normalized = String(testEnv[key] || '').trim().toLowerCase();
    if (!normalized || /your_|_your|change-this|placeholder/.test(normalized)) testEnv[key] = fallback;
  }
  log(`[verify:api] DATABASE_URL ${safety.redactConnectionUrl(env.DATABASE_URL)}`);
  log(`[verify:api] REDIS_URL ${safety.redactConnectionUrl(env.REDIS_URL)}`);
  const run = (command, args, cwd, label, diagnostics = () => '') => {
    let result;
    try {
      // Discard raw output: it can contain secrets and exceed spawnSync buffers.
      // Jest writes the separate report used for safe failure diagnostics.
      result = spawn(command, args, { cwd, env: testEnv, encoding: 'utf8', stdio: 'ignore', shell: false });
    } catch { throw new Error(`${label} failed (child output suppressed).`); }
    if (result.error || result.status !== 0) {
      const code = typeof result.error?.code === 'string' && /^[A-Z_]{1,24}$/.test(result.error.code) ? result.error.code : '';
      throw new Error(`${label} failed (child output suppressed).${code ? ` Runner: ${code}.` : ''}${diagnostics()}`);
    }
  };
  run('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], path.join(repoRoot, 'tixmoapi2'), 'Schema bootstrap');
  const reports = mkdtempSync(path.join(os.tmpdir(), 'tixmo-verification-'));
  const report = path.join(reports, 'jest.json');
  try {
    run('npm', ['--prefix', 'tixmoapi2', 'test', '--', '--runInBand', '--json', '--outputFile', report], repoRoot, 'API tests', () => {
      try { return formatTestFailures(JSON.parse(readFileSync(report, 'utf8'))); } catch { return ''; }
    });
  } finally { rmSync(reports, { recursive: true, force: true }); }
  log('[verify:api] API verification passed.');
}


// Never surface assertion text, console output, URLs or test argument values.
export function formatTestFailures(report) {
  const suites = (report.testResults || []).filter(result => result.status === 'failed')
    .map(result => path.basename(String(result.name || '')))
    .filter(name => /^[A-Za-z0-9_.-]+\.test\.ts$/.test(name));
  const failed = Number.isSafeInteger(report.numFailedTests) ? report.numFailedTests : 'unknown';
  return ` Failed tests: ${failed}; suites: ${[...new Set(suites)].join(', ') || 'unavailable'}.`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.env.TIXMO_ALLOW_DESTRUCTIVE_TESTS === '1') verifyApi();
    else await import('./verify-api-owned.mjs');
  } catch (error) {
    console.error(`[verify:api] ${error.message}`);
    process.exitCode = 1;
  }
}
