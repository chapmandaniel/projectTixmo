'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const DEFAULT_HEAP_MB = 8192;

function isCi(env) {
  const value = String(env.CI || '')
    .trim()
    .toLowerCase();
  return value === 'true' || value === '1';
}

// Local full-suite Jest (especially HTTP ramp) can stall or OOM at Node's
// default ~2 GiB heap. CI already passes at the runner default, so leave
// CI heap unchanged. A caller that already asked for 8192 MiB or more wins.
function ensureLocalJestHeap(env, minMb = DEFAULT_HEAP_MB) {
  const next = { ...env };
  if (isCi(next)) return next;
  const current = typeof next.NODE_OPTIONS === 'string' ? next.NODE_OPTIONS : '';
  const match = current.match(/--max-old-space-size=(\d+)/);
  if (!match) {
    next.NODE_OPTIONS = `${current}${current ? ' ' : ''}--max-old-space-size=${minMb}`;
    return next;
  }
  if (Number(match[1]) < minMb) {
    next.NODE_OPTIONS = current.replace(
      /--max-old-space-size=\d+/,
      `--max-old-space-size=${minMb}`
    );
  }
  return next;
}

function runJest(argv = process.argv.slice(2), env = process.env) {
  const jest = require.resolve('jest/bin/jest');
  // Combined #220/#221 suites can leave open handles after a complete run,
  // so npm test would hang even when every test passed. --forceExit does not
  // change assertions; skip if the caller already passed it.
  const args = argv.includes('--forceExit') ? argv : [...argv, '--forceExit'];
  const child = spawn(process.execPath, [jest, ...args], {
    stdio: 'inherit',
    env: ensureLocalJestHeap(env),
    windowsHide: true,
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code === null ? 1 : code);
  });
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  return child;
}

module.exports = { DEFAULT_HEAP_MB, ensureLocalJestHeap, runJest };

if (require.main === module) runJest();
