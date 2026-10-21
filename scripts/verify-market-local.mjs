#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

import { steps } from './market-stages.mjs';

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
