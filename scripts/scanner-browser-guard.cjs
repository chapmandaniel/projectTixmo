"use strict";
// Pure fixture admission and fixed receipt projection; no app/provider imports.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateVerificationTargets } = require("./verification-safety.cjs");
const scope = "task615-emulated-scanner-browser";
const flags = [
  "passed",
  "raceDom",
  "duplicateDenied",
  "revokedDenied",
  "storageEmpty",
  "profileKeysAbsent",
  "sessionsIsolated",
  "financialUnchanged",
  "foreignUnchanged",
  "cleanupVerified",
  "lifetimeCleanupVerified",
];
const numbers = [
  "diagnosticStage",
  "browserProcesses",
  "raceArrivals",
  "raceAdmissions",
  "raceRejections",
  "entrySuccesses",
  "raceAttempts",
  "allAttempts",
  "providerAttempts",
];
function loopback(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.ok(Number(url.port) > 1024 && Number(url.port) <= 65535);
  assert.equal(url.pathname, "/");
  assert.equal(url.username + url.password + url.search + url.hash, "");
  return url;
}
function guard(env) {
  validateVerificationTargets(env);
  assert.equal(env.NODE_ENV, "production");
  const api = loopback(env.TIXMO_SCANNER_API);
  const frontendPort = Number(env.TIXMO_SCANNER_PORT);
  assert.ok(
    Number.isInteger(frontendPort) &&
      frontendPort > 1024 &&
      frontendPort <= 65535,
  );
  assert.notEqual(frontendPort, Number(api.port));
  assert.match(env.TIXMO_BROWSER_PATH || "", /^\/[a-zA-Z0-9_./-]+$/);
  assert.ok(
    typeof env.TIXMO_SCANNER_FIXTURE === "string" &&
      env.TIXMO_SCANNER_FIXTURE.length < 4096,
  );
  const fixture = JSON.parse(env.TIXMO_SCANNER_FIXTURE);
  assert.deepEqual(Object.keys(fixture).sort(), ["freshQr", "keys", "qr"]);
  assert.ok(
    Array.isArray(fixture.keys) &&
      fixture.keys.length === 2 &&
      fixture.keys[0] !== fixture.keys[1],
  );
  for (const key of fixture.keys)
    assert.match(key, /^sk_scanner_[a-f0-9]{64}$/);
  for (const key of ["qr", "freshQr"])
    assert.match(
      fixture[key],
      /^TICKET:[a-f0-9-]{36}:TIX-[a-f0-9]{24}:[a-f0-9-]{36}$/,
    );
  assert.notEqual(fixture.qr, fixture.freshQr);
  return { api, frontendPort, fixture };
}
function diagnostic(value) {
  if (
    !value ||
    !Number.isInteger(value.stage) ||
    value.stage < 1 ||
    value.stage > 12 ||
    !["progress", "assertion", "deadline", "other"].includes(value.category)
  )
    return null;
  return { stage: value.stage, category: value.category };
}
function browserResult(value) {
  if (!value || value.ok !== true || value.browserProcesses !== 2) return null;
  const fields = [
    "raceDom",
    "duplicateDenied",
    "revokedDenied",
    "storageEmpty",
    "profileKeysAbsent",
    "sessionsIsolated",
  ];
  if (fields.some((key) => value[key] !== true)) return null;
  return {
    ok: true,
    browserProcesses: 2,
    ...Object.fromEntries(fields.map((key) => [key, true])),
  };
}
function validate(value, env) {
  assert.match(env.TIXMO_SCANNER_SOURCE_SHA || "", /^[a-f0-9]{40}$/);
  assert.match(env.TIXMO_SCANNER_RUN_ID || "", /^[0-9]{1,20}-[0-9]{1,8}$/);
  const fixed = {
    scope,
    sourceSha: env.TIXMO_SCANNER_SOURCE_SHA,
    runId: env.TIXMO_SCANNER_RUN_ID,
  };
  assert.deepEqual(
    Object.keys(value).sort(),
    [...Object.keys(fixed), ...flags, ...numbers].sort(),
  );
  for (const [key, expected] of Object.entries(fixed))
    assert.equal(value[key], expected);
  for (const key of flags) assert.equal(typeof value[key], "boolean");
  for (const key of numbers)
    assert.ok(
      Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 100,
    );
  assert.ok(value.diagnosticStage <= 12);
  if (value.passed) {
    for (const key of flags) assert.equal(value[key], true);
    for (const [key, expected] of Object.entries({
      diagnosticStage: 0,
      browserProcesses: 2,
      raceArrivals: 2,
      raceAdmissions: 1,
      raceRejections: 1,
      entrySuccesses: 1,
      raceAttempts: 2,
      allAttempts: 3,
      providerAttempts: 0,
    }))
      assert.equal(value[key], expected);
  }
  return {
    ...fixed,
    ...Object.fromEntries(
      [...flags, ...numbers].map((key) => [key, value[key]]),
    ),
  };
}
const receipt = path.resolve(
  __dirname,
  "../runtime/task615-scanner-browser.json",
);
function run(action, env = process.env) {
  assert.ok(["clear", "report"].includes(action));
  if (action === "clear" && !fs.existsSync(receipt)) return;
  const stat = fs.lstatSync(receipt);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 8192);
  if (action === "clear") {
    fs.unlinkSync(receipt);
    return;
  }
  const value = validate(JSON.parse(fs.readFileSync(receipt, "utf8")), env);
  console.log(JSON.stringify(value));
  assert.equal(value.passed, true);
}
if (require.main === module) {
  try {
    run(process.argv[2]);
  } catch {
    console.error(
      "Scanner browser evidence missing or invalid; raw data suppressed.",
    );
    process.exitCode = 1;
  }
}
module.exports = {
  guard,
  loopback,
  diagnostic,
  browserResult,
  validate,
  flags,
  numbers,
  scope,
};
