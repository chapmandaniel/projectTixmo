 'use strict';
// Execute under scrubbed Node BEFORE loading Jest or its setup files.
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../../../../tixmoapi2/tests/qualification/orders-http-abort.local.ts');
function verify(env=process.env) {
  for (const key of ['NODE_OPTIONS','NODE_PATH','LD_PRELOAD']) if (env[key]) throw new Error('Ambient preload rejected: ' + key);
  for (const file of ['../../../../.env','../../../../tixmoapi2/.env']) if (fs.existsSync(path.resolve(__dirname,file))) throw new Error('Ambient dotenv rejected');
  const identity = require('./provenance.cjs').verify(source, env);
  require('./runtime-path.cjs').validate(env.TASK426_ARTIFACT_DIR);
  const ports = env.TASK379_ALLOWED_PORTS;
  if (!/^\d{1,5},\d{1,5}$/.test(ports || '') || ports.split(',').some(p => +p < 1024 || +p > 65535) || new Set(ports.split(',')).size !== 2) throw new Error('Require two exact owned service ports');
  // Reuse native guard without task427 outer loopback fallback.
  require('../task-379/network-guard.cjs');
  if (typeof require('node:net')[Symbol.for('tixmo.task379.registerListener')] !== 'function') throw new Error('Missing native listener guard');
  return identity;
}
module.exports = {verify};
if (require.main === module) verify();
