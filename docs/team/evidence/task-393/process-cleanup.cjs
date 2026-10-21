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
  const expectedRun = process.env.TASK379_RUN_ID;
  if (typeof expectedRun !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRun)) throw new Error('Missing current invocation binding');
  function validateIdentity(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        !Number.isSafeInteger(value.pid) || value.pid < 1 ||
        !Number.isSafeInteger(value.ppid) || value.ppid < 1 || value.pid === value.ppid ||
        value.executable !== process.execPath || !path.isAbsolute(value.executable) ||
        value.runId !== expectedRun || value.runtimeRoot !== root || typeof value.startStat !== 'string') {
      throw new Error('Invalid process receipt schema or invocation');
    }
    // Linux /proc/PID/stat: comm may contain spaces/parentheses. Fields after
    // its final closing parenthesis begin with state, PPID; field 22 is starttime.
    const match = /^(\d+) \((.*)\) ([RSDZTWtXxKPI]) (.*)\n?$/.exec(value.startStat);
    const fields = match && match[4].trim().split(/\s+/);
    if (!match || Number(match[1]) !== value.pid || fields.length !== 49 ||
        fields.some(field => !/^-?\d+$/.test(field)) || Number(fields[0]) !== value.ppid ||
        !/^[1-9]\d*$/.test(fields[18])) throw new Error('Invalid process startStat');
  }
  validateIdentity(identity);
  report.identity = identity;
  report.pidAbsent = !fs.existsSync(`/proc/${identity.pid}`);
  if (!report.pidAbsent) report.errors.push('Recorded Jest PID still present; inspect exact startStat before any action');
  const listener = JSON.parse(fs.readFileSync(path.join(root, 'http-listener.json')));
  validateIdentity(listener);
  for (const key of ['pid', 'ppid', 'executable', 'startStat', 'runId', 'runtimeRoot']) {
    if (listener[key] !== identity[key]) throw new Error('Conflicting process receipts: ' + key);
  }
  const port = listener.address?.port;
  if (listener.pid !== identity.pid || !Number.isInteger(port) || port < 1 || port > 65535 || listener.address.address !== '127.0.0.1' || listener.address.family !== 'IPv4') throw new Error('Invalid listener provenance');
  const checked = spawnSync('ss', ['-H', '-ltnp', `sport = :${port}`], {encoding:'utf8'});
  report.httpPort = port;
  report.listenerRows = checked.stdout;
  if (checked.status !== 0 || checked.stdout.trim()) report.errors.push('HTTP listener cleanup not proven');
} catch (error) { report.errors.push(String(error)); }
fs.writeFileSync(path.join(root, 'process-cleanup.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (report.errors.length) process.exitCode = 1;
