 'use strict';
// Execute under scrubbed Node BEFORE loading Jest or its setup files.
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../../../../tixmoapi2/tests/qualification/orders-http-abort.local.ts');
function validatePorts(ports) {
  if (!/^\d{1,5},\d{1,5}$/.test(ports || '')) throw new Error('Require two exact owned service ports');
  const values = ports.split(',').map(Number);
  if (values.some((value, index) => value < 1024 || value > 65535 || String(value) !== ports.split(',')[index]) || new Set(values).size !== 2) throw new Error('Require two distinct canonical owned service ports');
  return values;
}
function verify(env=process.env) {
  for (const key of ['NODE_OPTIONS','NODE_PATH','LD_PRELOAD']) if (env[key]) throw new Error('Ambient preload rejected: ' + key);
  for (const file of ['../../../../.env','../../../../tixmoapi2/.env']) if (fs.existsSync(path.resolve(__dirname,file))) throw new Error('Ambient dotenv rejected');
  const identity = require('./provenance.cjs').verify(source, env);
  require('./runtime-path.cjs').validate(env.TASK426_ARTIFACT_DIR);
  const ports = env.TASK379_ALLOWED_PORTS;
  validatePorts(ports);
  // Snapshot exact tracked guard identity before execution; NOT immutability.
  const guard = path.resolve(__dirname, '../task-379/network-guard.cjs');
  const trackedGuard = require('node:child_process').execFileSync('/usr/bin/git',
    ['show', 'HEAD:docs/team/evidence/task-379/network-guard.cjs'], {cwd:identity.sourceRoot});
  if (!fs.readFileSync(guard).equals(trackedGuard)) throw new Error('Native guard identity mismatch');
  // Reuse native guard without task427 outer loopback fallback.
  require('../task-379/network-guard.cjs');
  if (typeof require('node:net')[Symbol.for('tixmo.task379.registerListener')] !== 'function') throw new Error('Missing native listener guard');
  return identity;
}
module.exports = {verify, validatePorts};
if (require.main === module) verify();
