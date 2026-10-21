// Opt-in task432 CLI receipt adapter. Not runtime authorization or OS isolation.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { snapshot } from './market-composition.mjs';
import { createApiReceiptTransport } from './api-receipt-transport.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

export function runVerifyApiCli({ verify, env = process.env, cwd = process.cwd(),
  capture = snapshot, guarded = () => typeof net[Symbol.for('tixmo.task427.ownedScope')] === 'function' } = {}) {
  const directory = env.TASK432_API_RECEIPTS;
  if (directory === undefined) return verify({ env }); // Existing default unchanged.
  // All opt-in checks precede verifyApi and therefore every child/service action.
  if (!directory || path.resolve(cwd) !== root) throw Error('Receipt CLI requires canonical source cwd');
  require('../docs/team/evidence/task-379/runtime-path.cjs').validate(directory);
  if (!guarded()) throw Error('Missing pre-import task427 guard');
  if (env.TASK379_ARTIFACT_DIR !== directory || !/^[a-f0-9]{64}$/.test(env.TASK379_RUN_ID ?? '') ||
      env.npm_config_offline !== 'true' || env.npm_config_yes !== 'false') throw Error('Missing owned offline runtime contract');
  const file = path.join(directory, 'api-identity.json');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error('Unsafe API identity file');
  const identity = JSON.parse(fs.readFileSync(file, 'utf8'));
  const unchanged = () => {
    if (JSON.stringify(capture(root)) !== JSON.stringify(identity)) throw Error('API CLI source identity changed');
  };
  unchanged();
  const record = createApiReceiptTransport({ directory, root, identity });
  return verify({ env, record: receipt => { record(receipt); unchanged(); } });
}
