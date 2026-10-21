'use strict';
// Observation only: never signal a PID, probe TCP, or connect to a service.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = process.argv[2];
require('../task-379/runtime-path.cjs').validate(root);
const report = { observedAt: new Date().toISOString(), errors: [] };
try {
  const identity = JSON.parse(fs.readFileSync(path.join(root, 'jest-identity.json')));
  if (!Number.isInteger(identity.pid) || identity.pid < 1) throw new Error('Invalid Jest PID');
  report.identity = identity;
  report.pidAbsent = !fs.existsSync(`/proc/${identity.pid}`);
  if (!report.pidAbsent) report.errors.push('Recorded Jest PID still present; inspect exact startStat before any action');
  const listener = JSON.parse(fs.readFileSync(path.join(root, 'http-listener.json')));
  const port = listener.address?.port;
  if (listener.pid !== identity.pid || !Number.isInteger(port) || port < 1 || port > 65535 || listener.address.address !== '127.0.0.1') throw new Error('Invalid listener provenance');
  const checked = spawnSync('ss', ['-H', '-ltnp', `sport = :${port}`], {encoding:'utf8'});
  report.httpPort = port;
  report.listenerRows = checked.stdout;
  if (checked.status !== 0 || checked.stdout.trim()) report.errors.push('HTTP listener cleanup not proven');
} catch (error) { report.errors.push(String(error)); }
fs.writeFileSync(path.join(root, 'process-cleanup.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (report.errors.length) process.exitCode = 1;
