"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { validate, numeric, booleans } = require("./payment-http-receipt.cjs");
const env = {
  TIXMO_PAID_SOURCE_SHA: "a".repeat(40),
  TIXMO_PAID_RUN_ID: "12345-1",
};
function fixture() {
  return {
    scope: "task616-synthetic-http-paid-to-ticket",
    syntheticReadMax: 10000,
    syntheticWriteMax: 4000,
    syntheticAdmissionMax: 4000,
    limitsQualified: false,
    sourceSha: env.TIXMO_PAID_SOURCE_SHA,
    runId: env.TIXMO_PAID_RUN_ID,
    ...Object.fromEntries(numeric.map((k) => [k, 0])),
    ...Object.fromEntries(booleans.map((k) => [k, true])),
    externalProviderQualified: false,
    samples: 20,
    concurrency: 4,
    maxHttpInFlight: 4,
    httpCalls: 145,
    paidToQrP95Ms: 20,
    intentToQrP95Ms: 100,
    paidToQrMaxMs: 30,
    intentToQrMaxMs: 120,
    intentCreates: 20,
    receipts: 20,
    duplicateCallbacks: 40,
    processedEvents: 40,
    sold: 20,
    signatureDenials: 2,
  };
}
test("complete source/run-bound synthetic application receipt qualifies", () =>
  assert.deepEqual(validate(fixture(), env), fixture()));
for (const [name, mutate] of Object.entries({
  paidLatency: (v) => (v.paidToQrP95Ms = 30001),
  intentLatency: (v) => (v.intentToQrP95Ms = 30001),
  samples: (v) => (v.samples = 19),
  concurrency: (v) => (v.maxHttpInFlight = 5),
  path: (v) => (v.httpCalls = 144),
  duplicateIntent: (v) => (v.intentCreates = 21),
  duplicateReceipt: (v) => (v.receipts = 21),
  duplicateFulfillment: (v) => (v.sold = 21),
  held: (v) => (v.held = 1),
  callback: (v) => (v.processedEvents = 39),
  replay: (v) => (v.financialReplayUnchanged = false),
  foreign: (v) => (v.foreignUnchanged = false),
  signature: (v) => (v.signatureDenials = 1),
  prewarmed: (v) => (v.firstQrMeasured = false),
  cleanup: (v) => (v.cleanupVerified = false),
  lifetime: (v) => (v.lifetimeCleanupVerified = false),
  lease: (v) => (v.leaseDelta = 1),
  provider: (v) => (v.externalProviderQualified = true),
  transport: (v) => (v.unexpectedTransport = 1),
}))
  test(`completion rejects ${name}`, () => {
    const v = fixture();
    mutate(v);
    assert.throws(() => validate(v, env));
  });
for (const [name, mutate] of Object.entries({
  token: (v) => (v.token = "private-canary"),
  url: (v) => (v.url = "https://private-canary.test"),
  body: (v) => (v.body = "private-canary"),
  nan: (v) => (v.paidToQrMaxMs = NaN),
  infinite: (v) => (v.intentToQrP95Ms = Infinity),
  fractional: (v) => (v.samples = 20.5),
  stale: (v) => (v.runId = "99-1"),
  sha: (v) => (v.sourceSha = "b".repeat(40)),
  missing: (v) => delete v.signatureDenials,
}))
  test(`reject ${name} without printing raw input`, () => {
    const v = fixture();
    v.passed = false;
    mutate(v);
    assert.throws(
      () => validate(v, env),
      (e) => !e.message.includes("private-canary"),
    );
  });
test("actual collected path retains real local signing and raw route, firstQR timing and late baseline", () => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "../tixmoapi2/tests/integration/payment-http-visibility.test.ts",
    ),
    "utf8",
  );
  assert.match(source, /webhooks: RealStripe.webhooks/);
  assert.match(source, /RealStripe.webhooks.generateTestHeaderString/);
  assert.match(source, /\/api\/v1\/payments\/create-intent/);
  assert.match(source, /\/api\/v1\/payments\/webhook/);
  assert.match(source, /paidMs.push\(visibleAt - paidAt\)/);
  assert.match(source, /intentMs.push\(visibleAt - p.intentAt\)/);
  assert.doesNotMatch(
    source,
    /confirmOrder\(|handleWebhook\(|processEvent\(|useFakeTimers|generateTicketQRCode\(/,
  );
  assert.ok(
    source.indexOf("const settled = await financial()") >
      source.indexOf("const qr = await http("),
  );
  assert.ok(
    source.indexOf("const duplicateValues") >
      source.indexOf("const settled = await financial()"),
  );
  assert.match(source, /await financial\(\)\)\.toEqual\(pendingBefore\)/);
  assert.match(source, /await financial\(\)\)\.toEqual\(settled\)/);
  assert.match(source, /await foreign\(\)\)\.toEqual\(foreignBefore\)/);
  assert.match(source, /response: 5000, deadline: 8000/);
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "../.github/workflows/market-readiness-local.yml"),
    "utf8",
  );
  assert.match(workflow, /node --test scripts\/payment-http-receipt.test.cjs/);
  assert.match(workflow, /node scripts\/payment-http-receipt.cjs clear/);
  assert.match(workflow, /node scripts\/payment-http-receipt.cjs report/);
});

test("installed SDK verifies exact synthetic raw bytes locally and rejects tampering", () => {
  const Stripe = require("../tixmoapi2/node_modules/stripe");
  const secret = "whsec_unit_synthetic";
  const payload = JSON.stringify({
    id: "evt_synthetic",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_synthetic" } },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(
    Stripe.webhooks.constructEvent(Buffer.from(payload), header, secret).id,
    "evt_synthetic",
  );
  assert.throws(() =>
    Stripe.webhooks.constructEvent(Buffer.from(payload + " "), header, secret),
  );
  assert.throws(() =>
    Stripe.webhooks.constructEvent(
      Buffer.from(payload),
      header,
      "whsec_other_synthetic",
    ),
  );
});
test("synthetic limiter controls cannot be relabelled as deployed limits", () => {
  for (const mutate of [
    (v) => (v.limitsQualified = true),
    (v) => (v.syntheticReadMax = 10001),
    (v) => (v.syntheticWriteMax = 4001),
    (v) => (v.syntheticAdmissionMax = 4001),
  ]) {
    const v = fixture();
    mutate(v);
    assert.throws(() => validate(v, env));
  }
});
