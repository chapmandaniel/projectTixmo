'use strict';
const fs = require('node:fs');
const path = require('node:path');
const scope = 'task608-http-reservation-pressure';
const numeric = [
  'syntheticMaxima',
  'scheduledAttempts',
  'startedAttempts',
  'completedAttempts',
  'windowMs',
  'elapsedMs',
  'maxInFlight',
  'remainingActive',
  'http201',
  'soldOut400',
  'http429',
  'http503',
  'otherStatus',
  'networkErrors',
  'latencyP50Ms',
  'latencyP95Ms',
  'latencyP99Ms',
  'latencyMaxMs',
  'latenessP95Ms',
  'latenessMaxMs',
  'lateStarts',
  'firstStartMs',
  'lastStartMs',
  'finishAfterWindowMs',
  'gaAvailable',
  'gaHeld',
  'gaSold',
  'vipAvailable',
  'vipHeld',
  'vipSold',
  'orders',
  'tickets',
  'paymentAttempts',
  'leaseDelta',
];
const booleans = [
  'testAssertionsPassed',
  'cleanupVerified',
  'lifetimeCleanupVerified',
  'limitsQualified',
];
function rejected() {
  throw Error('Pressure receipt rejected');
}
function validate(value, env) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) rejected();
  const keys = ['scope', 'sourceSha', 'runId', ...numeric, ...booleans].sort();
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys)) rejected();
  if (
    !/^[a-f0-9]{40}$/.test(env.TIXMO_PRESSURE_SOURCE_SHA || '') ||
    !/^[0-9]{1,20}-[0-9]{1,8}$/.test(env.TIXMO_PRESSURE_RUN_ID || '')
  )
    rejected();
  if (
    value.scope !== scope ||
    value.sourceSha !== env.TIXMO_PRESSURE_SOURCE_SHA ||
    value.runId !== env.TIXMO_PRESSURE_RUN_ID
  )
    rejected();
  for (const key of numeric)
    if (
      typeof value[key] !== 'number' ||
      !Number.isFinite(value[key]) ||
      value[key] < (key === 'leaseDelta' ? -1000000 : 0) ||
      value[key] > 1000000
    )
      rejected();
  for (const key of numeric)
    if (!key.endsWith('Ms') && !Number.isSafeInteger(value[key])) rejected();
  for (const key of booleans) if (typeof value[key] !== 'boolean') rejected();
  if (value.syntheticMaxima !== 4000 || value.limitsQualified !== false) rejected();
  if (value.testAssertionsPassed && value.latencyP95Ms > 2000) rejected();
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}
function run(mode, env = process.env, root = path.resolve(__dirname, '..')) {
  const directory = path.join(root, 'runtime');
  fs.mkdirSync(directory, { recursive: true });
  const dir = fs.lstatSync(directory);
  if (!dir.isDirectory() || dir.isSymbolicLink()) rejected();
  const file = path.join(directory, 'task608-http-pressure.json');
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536)) rejected();
  if (mode === 'clear') {
    if (stat) fs.unlinkSync(file);
    return;
  }
  if (mode !== 'report' || !stat) rejected();
  return validate(JSON.parse(fs.readFileSync(file, 'utf8')), env);
}
if (require.main === module) {
  try {
    if (process.argv.length !== 3) rejected();
    const result = run(process.argv[2]);
    if (result) console.log(JSON.stringify(result));
  } catch {
    console.error('HTTP pressure receipt unavailable or invalid; raw contents suppressed.');
    process.exitCode = 1;
  }
}
module.exports = { numeric, booleans, validate, run };
