#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const steps = [
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

const run = ({ name, command, args }) => {
  process.stdout.write(`\n[verify:market] ${name}\n`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
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

