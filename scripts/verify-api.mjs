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
  const suites = [], assertions = [];
  const results = Array.isArray(report?.testResults) ? report.testResults.slice(0, 100) : [];
  for (const result of results) {
    if (result?.status !== 'failed' || typeof result.name !== 'string' || result.name.length > 4096) continue;
    const name = path.basename(result.name);
    if (name.length > 128 || !/^[A-Za-z0-9_.-]+\.test\.ts$/.test(name)) continue;
    if (!suites.includes(name) && suites.length < 20) suites.push(name);
    const cases = Array.isArray(result.assertionResults) ? result.assertionResults.slice(0, 1000) : [];
    const source = /:(\d{1,6}):(\d{1,6})\)?\s*$/;
    for (let index = 0; index < cases.length && assertions.length < 20; index++) {
      const item = cases[index];
      if (item?.status !== 'failed') continue;
      const lines = [];
      const messages = Array.isArray(item.failureMessages) ? item.failureMessages.slice(0, 3) : [];
      for (const message of messages) {
        if (typeof message !== 'string') continue;
        for (const frame of message.slice(0, 20000).split('\n').slice(0, 100)) {
          if (lines.length >= 3) break;
          if (!/^\s*at\s/.test(frame) || frame.includes('://') || frame.length > 4096) continue;
          const match = source.exec(frame);
          const filename = match ? frame.slice(0, match.index) : '';
          if (![ '/' + name, '\\' + name, ' ' + name, '(' + name ].some(suffix => filename.endsWith(suffix))) continue;
          const line = match ? Number(match[1]) : 0;
          const column = match ? Number(match[2]) : 0;
          if (line >= 1 && line <= 100000 && column >= 1 && column <= 100000 && !lines.includes(line)) lines.push(line);
        }
      }
      assertions.push(`${name}#${index + 1}${lines.length ? `@${lines.join(',')}` : ''}`);
    }
  }
  const count = report?.numFailedTests;
  const failed = Number.isSafeInteger(count) && count >= 0 && count <= 1000000 ? count : 'unknown';
  return ` Failed tests: ${failed}; suites: ${suites.join(', ') || 'unavailable'}; assertions: ${assertions.join('; ') || 'unavailable'}.`;
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
