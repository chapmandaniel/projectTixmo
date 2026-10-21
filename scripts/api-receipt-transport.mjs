// Opt-in raw nested API receipts. Transport only, never runtime admission.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
export const apiCommands = [
  ['npm', ['run', 'build'], 'tixmoapi2'],
  ['npm', ['run', 'migrate'], 'tixmoapi2'],
  ['npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], 'tixmoapi2'],
  ['npm', ['--prefix', 'tixmoapi2', 'test', '--', '--runInBand'], ''],
];
function validate(directory) {
  // Reuse reviewed task379 owned private runtime path validation; not a grant.
  require('../docs/team/evidence/task-379/runtime-path.cjs').validate(directory);
}
export function createApiReceiptTransport({ directory, root, identity, now = () => new Date().toISOString() }) {
  validate(directory);
  if (!identity?.source || !identity?.sourceHash) throw Error('Missing candidate identity');
  let index = 0;
  return receipt => {
    validate(directory);
    const expected = apiCommands[index];
    if (!expected || receipt.command !== expected[0] || JSON.stringify(receipt.args) !== JSON.stringify(expected[1]) || path.resolve(receipt.cwd) !== path.resolve(root, expected[2])) throw Error('Noncanonical nested API command');
    if (!Number.isInteger(receipt.status) || typeof receipt.stdout !== 'string' || typeof receipt.stderr !== 'string') throw Error('Missing nested API raw result');
    const item = { schema: 'task432-api-receipt-v1', index: index + 1,
      identity: structuredClone(identity), command: expected[0], args: [...expected[1]],
      cwd: path.resolve(root, expected[2]), started: receipt.started, finished: now(),
      status: receipt.status, signal: receipt.signal ?? null, error: receipt.error ?? null,
      stdout: receipt.stdout, stderr: receipt.stderr,
      stdoutHash: hash(receipt.stdout), stderrHash: hash(receipt.stderr) };
    const fd = fs.openSync(path.join(directory, `api-${index + 1}.json`), 'wx', 0o400);
    try { fs.writeFileSync(fd, JSON.stringify(item) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    index++;
  };
}
export function collectApiReceipts({ directory, root, identity, status }) {
  validate(directory);
  if (fs.readdirSync(directory).some(file => /^api-\d+\.json$/.test(file) && !/^api-[1-4]\.json$/.test(file))) throw Error('Extra nested API receipt');
  const receipts = [];
  let failed = false;
  for (let index = 0; index < apiCommands.length; index++) {
    const file = path.join(directory, `api-${index + 1}.json`);
    if (!fs.existsSync(file)) {
      if (status === 0 || !failed || apiCommands.slice(index + 1).some((_, offset) => fs.existsSync(path.join(directory, `api-${index + offset + 2}.json`)))) throw Error('Missing nested API receipt');
      break;
    }
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error('Invalid nested receipt file');
    if (failed) throw Error('Nested command after failure');
    const item = JSON.parse(fs.readFileSync(file, 'utf8'));
    const expected = apiCommands[index];
    if (item.schema !== 'task432-api-receipt-v1' || item.index !== index + 1 || JSON.stringify(item.identity) !== JSON.stringify(identity) || item.command !== expected[0] || JSON.stringify(item.args) !== JSON.stringify(expected[1]) || item.cwd !== path.resolve(root, expected[2])) throw Error('Nested receipt provenance mismatch');
    for (const stream of ['stdout', 'stderr']) if (typeof item[stream] !== 'string' || hash(item[stream]) !== item[stream + 'Hash']) throw Error('Nested raw hash mismatch');
    if (!Number.isInteger(item.status) || typeof item.started !== 'string' || typeof item.finished !== 'string') throw Error('Invalid nested result');
    failed = item.status !== 0 || Boolean(item.signal || item.error);
    receipts.push(item);
  }
  if (status === 0 && (failed || receipts.length !== 4)) throw Error('Nested API did not pass');
  return receipts;
}
