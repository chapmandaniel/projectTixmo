"use strict";
// Task612 fixed aggregate receipt only. Never print raw JSON, rows or errors.
const fs = require("node:fs");
const path = require("node:path");
const receiptPath = path.resolve(
  __dirname,
  "../runtime/task612-native-recovery.json",
);
const numeric = [
  "firstPassMs",
  "recoveryMs",
  "backoffElapsedMs",
  "schedulerPasses",
  "replayWaitMs",
  "minTickIntervalMs",
  "syntheticEffects",
  "initialSold",
  "finalAvailable",
  "finalHeld",
  "finalSold",
  "unexpectedTransportAttempts",
  "remainingEligible",
  "leaseDelta",
];
const boolean = [
  "passed",
  "firstPassFailed",
  "persistedBackoff",
  "healthyRestored",
  "manualUnchanged",
  "foreignUnchanged",
  "replayUnchanged",
  "cleanupVerified",
  "lifetimeCleanupVerified",
];
function validate(value, env) {
  if (
    !/^[a-f0-9]{40}$/.test(env.TIXMO_RECOVERY_SOURCE_SHA || "") ||
    !/^\d{1,20}-\d{1,5}$/.test(env.TIXMO_RECOVERY_RUN_ID || "")
  )
    throw Error("Native recovery binding rejected");
  const fixed = {
    scope: "task612-native-scheduled-recovery",
    sourceSha: env.TIXMO_RECOVERY_SOURCE_SHA,
    runId: env.TIXMO_RECOVERY_RUN_ID,
  };
  const keys = [...Object.keys(fixed), ...numeric, ...boolean].sort();
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).sort().join() !== keys.join()
  )
    throw Error("Native recovery receipt fields rejected");
  for (const [key, expected] of Object.entries(fixed))
    if (value[key] !== expected)
      throw Error("Native recovery receipt binding rejected");
  for (const key of numeric)
    if (
      typeof value[key] !== "number" ||
      !Number.isFinite(value[key]) ||
      value[key] < (key === "leaseDelta" ? -1000000 : 0) ||
      value[key] > 3600000
    )
      throw Error("Native recovery metric rejected");
  for (const key of [
    "schedulerPasses",
    "syntheticEffects",
    "initialSold",
    "finalAvailable",
    "finalHeld",
    "finalSold",
    "unexpectedTransportAttempts",
    "remainingEligible",
    "leaseDelta",
  ])
    if (!Number.isSafeInteger(value[key]))
      throw Error("Native recovery count rejected");
  for (const key of boolean)
    if (typeof value[key] !== "boolean")
      throw Error("Native recovery flag rejected");
  if (
    value.passed &&
    (!boolean.every((key) => value[key]) ||
      value.firstPassMs > 10000 ||
      value.recoveryMs > 300000 ||
      value.backoffElapsedMs < 60000 ||
      value.minTickIntervalMs < 59900 ||
      value.schedulerPasses < 3 ||
      value.replayWaitMs > 70000 ||
      value.syntheticEffects !== 1 ||
      value.initialSold !== 2 ||
      value.finalAvailable !== 1 ||
      value.finalHeld !== 0 ||
      value.finalSold !== 1 ||
      value.unexpectedTransportAttempts ||
      value.remainingEligible ||
      value.leaseDelta)
  )
    throw Error("Native recovery completion rejected");
  return value;
}
function run(action, env = process.env, log = console.log) {
  if (!["clear", "report"].includes(action))
    throw Error("Native recovery action rejected");
  if (action === "clear") {
    if (fs.existsSync(receiptPath)) {
      const stat = fs.lstatSync(receiptPath);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw Error("Native recovery stale file rejected");
      fs.unlinkSync(receiptPath);
    }
    return;
  }
  const stat = fs.lstatSync(receiptPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192)
    throw Error("Native recovery file rejected");
  const value = validate(JSON.parse(fs.readFileSync(receiptPath, "utf8")), env);
  log(JSON.stringify(value));
  if (!value.passed) throw Error("Native recovery qualification failed");
}
if (require.main === module) {
  try {
    run(process.argv[2]);
  } catch {
    console.error(
      "Native recovery receipt missing or rejected (raw data suppressed)",
    );
    process.exitCode = 1;
  }
}
module.exports = { validate, run, numeric, boolean };
