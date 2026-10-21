import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { verifyApi } from '../../../../scripts/verify-api.mjs';
import { runVerifyApiCli } from '../../../../scripts/verify-api-cli.mjs';
const require = createRequire(import.meta.url);

// Source-only wiring; the shell still requires separately authorized services.
export function runGate({ env = process.env, spawn = spawnSync, cli = runVerifyApiCli } = {}) {
  const directory = env.TASK379_ARTIFACT_DIR;
  require('../task-379/runtime-path.cjs').validate(directory);
  let n = 0;
  cli({ env, verify: options => verifyApi({ ...options, spawn(command, args, opts) {
    n++;
    // Preserve the existing full-suite Jest JSON operation, without changing
    // the canonical command recorded by verifyApi's receipt callback.
    if (command === 'npm' && args.includes('test')) args = [...args, '--json', '--outputFile=' + path.join(directory, 'jest-result.json')];
    fs.appendFileSync(path.join(directory, 'commands.jsonl'), JSON.stringify({ command, args, cwd: opts.cwd }) + '\n');
    // Pipe so the real CLI callback receives raw output, then retain legacy logs.
    const result = spawn(command, args, { ...opts, maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(directory, n + '-stdout.log'), result.stdout ?? '');
    fs.writeFileSync(path.join(directory, n + '-stderr.log'), result.stderr ?? '');
    fs.appendFileSync(path.join(directory, 'commands.jsonl'), JSON.stringify({ step: n, status: result.status, signal: result.signal }) + '\n');
    return result;
  } }) });
  if (fs.existsSync(env.TASK427_BLOCK_LOG) && fs.statSync(env.TASK427_BLOCK_LOG).size) throw Error('Blocked outbound calls: guarded gate FAIL, inspect blocked-network.jsonl');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) runGate();
