#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { evaluateDependencyAudit } from './dependency-audit-gate.mjs';

const steps = [
  {
    name: 'API dependency audit',
    auditPrefix: 'tixmoapi2',
  },
  {
    name: 'Dashboard dependency audit',
    auditPrefix: 'tdash',
  },
  {
    name: 'API tooling checks',
    command: 'npm',
    args: ['--prefix', 'tixmoapi2', 'run', 'test:tooling'],
  },
  {
    name: 'Development helper safety checks',
    command: 'npm',
    args: ['--prefix', 'tixmoapi2', 'run', 'test:development'],
  },
  {
    name: 'Root verification safety checks',
    command: 'node',
    args: ['--test', 'scripts/verification-safety.test.mjs', 'scripts/market-readiness-workflow.test.mjs', 'scripts/test-target.test.cjs', 'scripts/share-startup-safety.test.mjs', 'scripts/evidence-status.test.mjs', 'scripts/wallet-browser.test.cjs', 'scripts/dependency-audit-gate.test.mjs'],
  },
  {
    name: 'API build',
    command: 'npm',
    args: ['--prefix', 'tixmoapi2', 'run', 'build'],
  },
  {
    name: 'API verification',
    command: 'npm',
    args: ['run', 'verify:api'],
  },
  {
    name: 'API lint',
    command: 'npm',
    args: ['--prefix', 'tixmoapi2', 'run', 'lint'],
  },
  {
    name: 'Dashboard tests',
    command: 'npm',
    args: ['--prefix', 'tdash', 'test', '--', '--run'],
  },
  {
    name: 'Dashboard design guard',
    command: 'npm',
    args: ['--prefix', 'tdash', 'run', 'design:guard'],
  },
  {
    name: 'Dashboard build',
    environment: { NODE_ENV: 'production' },
    command: 'npm',
    args: ['--prefix', 'tdash', 'run', 'build'],
  },
  {
    name: 'Root helper syntax',
    command: 'node',
    args: ['--check', 'scripts/verify-api.mjs'],
  },
  {
    name: 'Status checker syntax',
    command: 'node',
    args: ['--check', 'scripts/check-status.mjs'],
  },
  {
    name: 'External smoke syntax',
    command: 'node',
    args: ['--check', 'scripts/external-smoke-evidence.mjs'],
  },
];

const runDependencyAudit = ({ name, auditPrefix }) => {
  process.stdout.write(`\n[verify:market] ${name}\n`);
  const result = spawnSync('npm', ['--prefix', auditPrefix, 'audit', '--json'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) {
    process.stderr.write(`[verify:market] ${name} failed to run\n`);
    process.exit(1);
  }
  let report;
  try {
    report = JSON.parse(result.stdout || '');
  } catch {
    process.stderr.write(result.stderr || '');
    process.stderr.write(`[verify:market] ${name} did not return JSON\n`);
    process.exit(result.status || 1);
  }
  let lockfile;
  try {
    lockfile = JSON.parse(readFileSync(`${auditPrefix}/package-lock.json`, 'utf8'));
  } catch {
    process.stderr.write(`[verify:market] ${name} could not read ${auditPrefix}/package-lock.json\n`);
    process.exit(1);
  }
  const decision = evaluateDependencyAudit(report, lockfile);
  if (!decision.ok) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.stderr.write(`[verify:market] ${name} failed: ${decision.reason}\n`);
    process.exit(1);
  }
  if (decision.ignored) process.stdout.write(`[verify:market] ${decision.ignored}\n`);
};

const run = (step) => {
  if (step.auditPrefix) return runDependencyAudit(step);
  const { name, command, args, environment = {} } = step;
  process.stdout.write(`\n[verify:market] ${name}\n`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...environment },
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.stderr.write(`[verify:market] ${name} failed with exit code ${result.status ?? 1}\n`);
    process.exit(result.status ?? 1);
  }
};

for (const step of steps) {
  run(step);
}

process.stdout.write('\n[verify:market] Market readiness local gates passed.\n');
