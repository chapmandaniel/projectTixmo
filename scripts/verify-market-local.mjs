#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const steps = [
  {
    name: 'API dependency audit',
    command: 'npm',
    args: ['--prefix', 'tixmoapi2', 'audit'],
  },
  {
    name: 'Dashboard dependency audit',
    command: 'npm',
    args: ['--prefix', 'tdash', 'audit'],
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
    args: ['--test', 'scripts/verification-safety.test.mjs', 'scripts/market-readiness-workflow.test.mjs', 'scripts/test-target.test.cjs'],
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

const run = ({ name, command, args, environment = {} }) => {
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
