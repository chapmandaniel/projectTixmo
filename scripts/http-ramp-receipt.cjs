'use strict';
const fs = require('node:fs');
const path = require('node:path');
const fixed = {
  scope: 'task609-authenticated-http-actor-ramp',
  actorModel: 'authenticated-http-actors-not-browsers',
  resourceScope: 'combined-api-and-driver-process-owned-ci-services',
  stageDurationMs: 20000,
  browseCycles: 10,
  cadenceMs: 2000,
  checkoutStartMs: 4000,
  checkoutEndMs: 16000,
  syntheticReadMax: 10000,
  syntheticWriteMax: 4000,
  syntheticAdmissionMax: 4000,
  limitsQualified: false,
};
const integers = [
  'actors',
  'plannedPublicReads',
  'plannedReservations',
  'plannedRequests',
  'startedRequests',
  'completedRequests',
  'publicRead200',
  'reservation201',
  'recovery200',
  'http429',
  'http503',
  'http5xx',
  'networkErrors',
  'otherStatus',
  'malformedSuccess',
  'maxActiveActors',
  'remainingActors',
  'maxHttpInFlight',
  'remainingHttpInFlight',
  'startedWithinWindow',
  'missedCadence',
  'sampleCount',
  'maxPgConnections',
  'maxPgActive',
  'maxPgLockWaiters',
  'maxRedisMemoryBytes',
  'maxRedisClients',
  'maxRssBytes',
  'maxHeapBytes',
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
const durations = [
  'publicReadP95Ms',
  'reservationP95Ms',
  'recoveryReadP95Ms',
  'unexpected5xxFraction',
  'fullActorOverlapMs',
  'elapsedMs',
  'plannedOfferedRps',
  'actualOfferedRps',
  'completionRps',
  'scheduleLatenessP95Ms',
  'scheduleLatenessMaxMs',
  'cpuUserMs',
  'cpuSystemMs',
  'eventLoopP95Ms',
  'eventLoopMaxMs',
];
const booleans = ['testAssertionsPassed', 'cleanupVerified', 'lifetimeCleanupVerified'];
function reject() {
  throw Error('Ramp evidence rejected');
}
function stagePlan(actors, actor) {
  if (![100, 250, 500].includes(actors) || !Number.isInteger(actor) || actor < 0 || actor >= actors)
    reject();
  const offset = (actor / actors) * 2000;
  return [
    ...Array.from({ length: 10 }, (_, cycle) => ({
      kind: 'public',
      target: offset + cycle * 2000,
    })),
    { kind: 'reservation', target: 4000 + (actor / actors) * 12000 },
  ].sort((a, b) => a.target - b.target);
}
function numericInfo(text, name) {
  if (
    !['used_memory', 'connected_clients'].includes(name) ||
    typeof text !== 'string' ||
    text.length > 65536
  )
    reject();
  const matched = new RegExp('(?:^|\\r?\\n)' + name + ':([0-9]+)(?:\\r?\\n|$)').exec(text);
  const value = matched ? Number(matched[1]) : -1;
  if (!Number.isSafeInteger(value) || value < 0) reject();
  return value;
}
function validate(value, env) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject();
  const keys = [...Object.keys(fixed), 'sourceSha', 'runId', 'stages'].sort();
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys)) reject();
  for (const [key, expected] of Object.entries(fixed)) if (value[key] !== expected) reject();
  if (
    !/^[a-f0-9]{40}$/.test(env.TIXMO_RAMP_SOURCE_SHA || '') ||
    !/^[0-9]{1,20}-[0-9]{1,8}$/.test(env.TIXMO_RAMP_RUN_ID || '') ||
    value.sourceSha !== env.TIXMO_RAMP_SOURCE_SHA ||
    value.runId !== env.TIXMO_RAMP_RUN_ID
  )
    reject();
  if (!Array.isArray(value.stages) || value.stages.length > 3) reject();
  const stageKeys = [...integers, ...durations, ...booleans].sort();
  for (const [index, stage] of value.stages.entries()) {
    if (
      !stage ||
      typeof stage !== 'object' ||
      Array.isArray(stage) ||
      JSON.stringify(Object.keys(stage).sort()) !== JSON.stringify(stageKeys) ||
      stage.actors !== [100, 250, 500][index]
    )
      reject();
    for (const key of [...integers, ...durations])
      if (
        typeof stage[key] !== 'number' ||
        !Number.isFinite(stage[key]) ||
        stage[key] < (key === 'leaseDelta' ? -1000000 : 0) ||
        stage[key] > 2 ** 40
      )
        reject();
    for (const key of integers) if (!Number.isSafeInteger(stage[key])) reject();
    for (const key of booleans) if (typeof stage[key] !== 'boolean') reject();
    if (
      stage.testAssertionsPassed &&
      (stage.publicReadP95Ms > 500 ||
        stage.reservationP95Ms > 2000 ||
        stage.unexpected5xxFraction >= 0.005 ||
        stage.http429 ||
        stage.http503 ||
        stage.networkErrors ||
        stage.otherStatus ||
        stage.malformedSuccess ||
        !stage.cleanupVerified ||
        !stage.lifetimeCleanupVerified ||
        stage.maxActiveActors !== stage.actors ||
        stage.fullActorOverlapMs < 14000 ||
        stage.reservation201 !== stage.actors ||
        stage.recovery200 !== stage.actors ||
        stage.remainingActors ||
        stage.remainingHttpInFlight ||
        stage.leaseDelta)
    )
      reject();
  }
  // Reconstruct only the fixed, validated schema; never print arbitrary objects/strings.
  return {
    ...fixed,
    sourceSha: value.sourceSha,
    runId: value.runId,
    stages: value.stages.map((stage) =>
      Object.fromEntries(stageKeys.map((key) => [key, stage[key]]))
    ),
  };
}
function run(mode, env = process.env, root = path.resolve(__dirname, '..')) {
  const directory = path.join(root, 'runtime');
  fs.mkdirSync(directory, { recursive: true });
  const parent = fs.lstatSync(directory);
  if (!parent.isDirectory() || parent.isSymbolicLink()) reject();
  const file = path.join(directory, 'task609-http-ramp.json');
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536)) reject();
  if (mode === 'clear') {
    if (stat) fs.unlinkSync(file);
    return;
  }
  if (mode !== 'report' || !stat) reject();
  return validate(JSON.parse(fs.readFileSync(file, 'utf8')), env);
}
if (require.main === module) {
  try {
    if (process.argv.length !== 3) reject();
    const result = run(process.argv[2]);
    if (result) console.log(JSON.stringify(result));
  } catch {
    console.error('HTTP ramp evidence unavailable or invalid; raw contents suppressed.');
    process.exitCode = 1;
  }
}
module.exports = { fixed, integers, durations, booleans, stagePlan, numericInfo, validate, run };
