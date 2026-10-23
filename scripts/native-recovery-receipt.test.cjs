"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { validate, numeric, boolean } = require("./native-recovery-receipt.cjs");
const env = {
  TIXMO_RECOVERY_SOURCE_SHA: "a".repeat(40),
  TIXMO_RECOVERY_RUN_ID: "12345-1",
};
function fixture() {
  return {
    scope: "task612-native-scheduled-recovery",
    sourceSha: env.TIXMO_RECOVERY_SOURCE_SHA,
    runId: env.TIXMO_RECOVERY_RUN_ID,
    ...Object.fromEntries(numeric.map((key) => [key, 0])),
    ...Object.fromEntries(boolean.map((key) => [key, true])),
    firstPassMs: 10,
    recoveryMs: 120010,
    backoffElapsedMs: 120000,
    schedulerPasses: 4,
    replayWaitMs: 59990,
    minTickIntervalMs: 60000,
    syntheticEffects: 1,
    initialSold: 2,
    finalAvailable: 1,
    finalHeld: 0,
    finalSold: 1,
  };
}
test("only current source/run-bound complete numeric receipt qualifies", () => {
  assert.deepEqual(validate(fixture(), env), fixture());
});
for (const [name, mutate] of Object.entries({
  late: (v) => (v.recoveryMs = 300001),
  backoff: (v) => (v.backoffElapsedMs = 59999),
  cadence: (v) => (v.minTickIntervalMs = 59900 - 1),
  noReplay: (v) => (v.schedulerPasses = 2),
  duplicate: (v) => (v.syntheticEffects = 2),
  stock: (v) => (v.finalHeld = 1),
  fractionalPasses: (v) => (v.schedulerPasses = 3.5),
  unexpectedTransport: (v) => (v.unexpectedTransportAttempts = 1),
  backlog: (v) => (v.remainingEligible = 1),
  leases: (v) => (v.leaseDelta = 1),
  manual: (v) => (v.manualUnchanged = false),
  foreign: (v) => (v.foreignUnchanged = false),
  replay: (v) => (v.replayUnchanged = false),
  cleanup: (v) => (v.cleanupVerified = false),
  lifetime: (v) => (v.lifetimeCleanupVerified = false),
  notFailed: (v) => (v.firstPassFailed = false),
  noBackoff: (v) => (v.persistedBackoff = false),
  notRestored: (v) => (v.healthyRestored = false),
}))
  test(`cannot claim completion with ${name}`, () => {
    const v = fixture();
    mutate(v);
    assert.throws(() => validate(v, env));
  });
for (const [name, mutate] of Object.entries({
  secret: (v) => (v.error = "private-canary"),
  url: (v) => (v.url = "https://private-canary.test"),
  row: (v) => (v.orderId = "private-canary"),
  nan: (v) => (v.recoveryMs = NaN),
  infinite: (v) => (v.recoveryMs = Infinity),
  tooLarge: (v) => (v.recoveryMs = 1e20),
  string: (v) => (v.recoveryMs = "private-canary"),
  stale: (v) => (v.runId = "999-1"),
  source: (v) => (v.sourceSha = "b".repeat(40)),
  missing: (v) => delete v.minTickIntervalMs,
}))
  test(`reject ${name} without exposing its contents`, () => {
    const v = fixture();
    v.passed = false;
    mutate(v);
    assert.throws(
      () => validate(v, env),
      (error) => !error.message.includes("private-canary"),
    );
  });
test("failed assertion receipt can report safe metrics but remains failed", () => {
  const v = fixture();
  v.passed = false;
  v.cleanupVerified = false;
  assert.equal(validate(v, env).passed, false);
});
test("collected case delegates only actual scheduler and keeps real clocks plus joined cleanup", () => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "../tixmoapi2/tests/integration/payment-native-recovery.test.ts",
    ),
    "utf8",
  );
  assert.match(source, /job\.startPaymentRecoveryJob\(\)/);
  assert.match(source, /job\.stopPaymentRecoveryJob\(\)/);
  assert.match(source, /actualRecover\(\)/);
  assert.doesNotMatch(
    source,
    /useFakeTimers|advanceTimers|recoverRefunds\(|data:\s*\{\s*updatedAt:/,
  );
  assert.ok(
    source.indexOf("job.stopPaymentRecoveryJob()") <
      source.indexOf("prisma.paymentRefund.deleteMany"),
  );
  assert.ok(
    source.indexOf(
      "await bounded(drain())",
      source.indexOf("job.stopPaymentRecoveryJob()"),
    ) < source.indexOf("prisma.paymentRefund.deleteMany"),
  );
  assert.match(source, /300000/);
  assert.match(source, /59900/);
  assert.match(source, /mockHealthy = true/);
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "../.github/workflows/market-readiness-local.yml"),
    "utf8",
  );
  assert.match(
    workflow,
    /node --test scripts\/native-recovery-receipt.test.cjs/,
  );
  assert.match(workflow, /node scripts\/native-recovery-receipt.cjs clear/);
  assert.match(workflow, /node scripts\/native-recovery-receipt.cjs report/);
  assert.match(workflow, /TIXMO_RECOVERY_SOURCE_SHA:/);
  assert.match(workflow, /TIXMO_RECOVERY_RUN_ID:/);
});
