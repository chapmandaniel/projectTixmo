const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { assertDisposableTestTarget } = require('./test-target.cjs');

function priorDumpRequested(env = process.env) {
  if (env.TIXMO_UPGRADE_PRIOR_DUMP === undefined) return false;
  if (env.TIXMO_UPGRADE_PRIOR_DUMP !== '1' || !env.TIXMO_UPGRADE_EVIDENCE_DIR)
    throw new Error('Prior dump requires option 1 and an owned evidence parent.');
  return true;
}

function retainPriorDump({ env = process.env, evidenceDir, beforeSha256, persist, serverVersion, run = spawnSync }) {
  // Recheck authorization before any tool invocation, including --version.
  const target = new URL(assertDisposableTestTarget(env));
  if (!priorDumpRequested(env)) return;
  let fd;
  let receipt;
  try {
    const stat = fs.lstatSync(evidenceDir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(evidenceDir) !== evidenceDir ||
        stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700 || !/^[a-f0-9]{64}$/.test(beforeSha256)) throw new Error();
    const destination = path.join(evidenceDir, 'prior-schema.dump');
    fd = fs.openSync(destination, 'wx', 0o600); // Never follow or overwrite an existing leaf.
    const toolEnv = { PATH: env.PATH, LANG: 'C', PGHOST: target.hostname.replace(/^\[|\]$/g, ''),
      PGPORT: target.port || '5432', PGUSER: decodeURIComponent(target.username),
      PGPASSWORD: decodeURIComponent(target.password), PGDATABASE: target.pathname.slice(1),
      PGCONNECT_TIMEOUT: '10', PGSSLMODE: 'disable' };
    const version = run('pg_dump', ['--version'], { env: toolEnv, encoding: 'utf8', timeout: 10000 });
    const match = /^pg_dump \(PostgreSQL\) ([0-9]+(?:\.[0-9]+){0,2})(?:\s|$)/.exec(version.stdout || '');
    if (version.status !== 0 || !match) throw new Error();
    receipt = { format: 1, startedAt: new Date(), beforeSha256, toolVersion: match[1],
      serverVersion: /^[0-9]{5,6}$/.test(String(serverVersion)) ? String(serverVersion) : null,
      scope: 'synthetic prior-schema archive only; restore/parity/rollback unverified' };
    const result = run('pg_dump', ['--format=custom', '--no-password'], {
      env: toolEnv, stdio: ['ignore', fd, 'pipe'], timeout: 60000,
    });
    receipt.endedAt = new Date();
    receipt.exitStatus = Number.isInteger(result.status) ? result.status : null;
    receipt.success = result.status === 0 && !result.error && !result.signal;
    fs.fsyncSync(fd);
    const bytes = fs.readFileSync(destination);
    receipt.archiveSha256 = createHash('sha256').update(bytes).digest('hex');
    receipt.archiveBytes = bytes.length;
    receipt.success = receipt.success && bytes.subarray(0, 5).toString() === 'PGDMP';
    persist('prior-dump.json', receipt);
    if (!receipt.success) throw new Error();
  } catch {
    // No raw tool stderr, exception, destination, connection URI or credentials.
    throw new Error('Prior-schema dump checkpoint failed; upgrade was not started.');
  } finally {
    if (fd !== undefined) {
      try { try { fs.fchmodSync(fd, 0o400); } finally { fs.closeSync(fd); } }
      catch { throw new Error('Prior-schema dump archive finalization failed; upgrade was not started.'); }
    }
  }
}
module.exports = { priorDumpRequested, retainPriorDump };
