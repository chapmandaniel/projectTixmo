// Disk-only QA456 regression: run actual shell binding and inline publication,
// replacing ONLY snapshot import with a deterministic source fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const shell = fs.readFileSync(new URL('../task-427/runtime.sh', import.meta.url), 'utf8');
const binding = 'export TASK379_ARTIFACT_DIR="$owned_run"';
assert.equal(shell.split(binding).length, 2);
const validated = shell.indexOf('node "$PWD/docs/team/evidence/task-379/runtime-path.cjs" "$owned_run"');
const bound = shell.indexOf(binding);
const publication = shell.indexOf('TASK432_SOURCE_IDENTITY="$task432_identity" node --input-type=module');
const provision = shell.indexOf('"$pgbin/initdb"');
assert.ok(validated < bound && bound < publication && publication < provision);
const end = shell.indexOf("\n'", publication) + 2;
let actual = shell.slice(publication, end);
assert.ok(actual.includes('fs.openSync(process.env.TASK379_ARTIFACT_DIR + "/api-identity.json", "wx", 0o400)'));
assert.ok(actual.includes('fs.fsyncSync(fd)'));
assert.ok(actual.indexOf('Source changed before provisioning') < actual.indexOf('fs.openSync'));
const snapshotImport = 'import { snapshot } from "./scripts/market-composition.mjs";';
assert.equal(actual.split(snapshotImport).length, 2);
actual = actual.replace(snapshotImport, 'const snapshot = () => ({ source: process.env.FIXTURE_SOURCE });');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task432-publication-'));
try {
  function run(dir, source = 'same') {
    // /usr/bin/env -i is intentional: no inherited artifact environment can mask
    // the original undefined/api-identity.json defect. No runtime shell invoked.
    return spawnSync('/usr/bin/env', ['-i', `PATH=${path.dirname(process.execPath)}:/usr/bin:/bin`,
      `FIXTURE_SOURCE=${source}`, '/bin/bash', '-euc',
      'owned_run="$1"\ntask432_identity=\'{"source":"same"}\'\n' + binding + '\n' + actual,
      'offline-publication', dir], { cwd: root, encoding: 'utf8', timeout: 10000 });
  }
  const success = fs.mkdtempSync(path.join(root, 'success-'));
  let result = run(success);
  assert.equal(result.status, 0, result.stderr);
  const filename = path.join(success, 'api-identity.json');
  assert.equal(fs.readFileSync(filename, 'utf8'), '{"source":"same"}\n');
  assert.equal(fs.statSync(filename).mode & 0o777, 0o400);
  result = run(success);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /EEXIST/);
  assert.equal(fs.readFileSync(filename, 'utf8'), '{"source":"same"}\n');
  const drift = fs.mkdtempSync(path.join(root, 'drift-'));
  result = run(drift, 'changed');
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Source changed before provisioning/);
  assert.deepEqual(fs.readdirSync(drift), []);
  const denied = spawnSync('/usr/bin/env', ['-i', 'PATH=/usr/bin:/bin', '/bin/bash',
    new URL('../task-427/runtime.sh', import.meta.url).pathname], { encoding: 'utf8', timeout: 10000 });
  assert.equal(denied.status, 2); assert.match(denied.stderr, /fresh explicit PM sole-owner runtime grant/);
  console.log('PASS env-i actual publication/binding/private mode/exclusive no-overwrite/source-drift zero-file/validated preprovision order/missing-grant denial');
} finally {
  // Synchronous children have exited/reaped; remove only this fixture tree.
  fs.rmSync(root, { recursive: true, force: true });
}
