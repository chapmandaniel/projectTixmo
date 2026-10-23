"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const receiptPath = path.resolve(
  __dirname,
  "../runtime/task616-payment-http.json",
);
const numeric = [
  "samples",
  "concurrency",
  "maxHttpInFlight",
  "httpCalls",
  "paidToQrP95Ms",
  "intentToQrP95Ms",
  "paidToQrMaxMs",
  "intentToQrMaxMs",
  "intentCreates",
  "receipts",
  "duplicateCallbacks",
  "processedEvents",
  "sold",
  "held",
  "available",
  "unexpectedTransport",
  "leaseDelta",
  "signatureDenials",
];
const booleans = [
  "passed",
  "firstQrMeasured",
  "financialReplayUnchanged",
  "foreignUnchanged",
  "cleanupVerified",
  "lifetimeCleanupVerified",
  "externalProviderQualified",
];
function validate(value, env) {
  if (
    !/^[a-f0-9]{40}$/.test(env.TIXMO_PAID_SOURCE_SHA || "") ||
    !/^\d{1,20}-\d{1,5}$/.test(env.TIXMO_PAID_RUN_ID || "")
  )
    throw Error("Payment HTTP receipt binding rejected");
  const fixed = {
    scope: "task616-synthetic-http-paid-to-ticket",
    syntheticReadMax: 10000,
    syntheticWriteMax: 4000,
    syntheticAdmissionMax: 4000,
    limitsQualified: false,
    sourceSha: env.TIXMO_PAID_SOURCE_SHA,
    runId: env.TIXMO_PAID_RUN_ID,
  };
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).sort().join() !==
      [...Object.keys(fixed), ...numeric, ...booleans].sort().join()
  )
    throw Error("Payment HTTP receipt fields rejected");
  for (const [key, expected] of Object.entries(fixed))
    if (value[key] !== expected)
      throw Error("Payment HTTP receipt binding rejected");
  for (const key of numeric)
    if (
      typeof value[key] !== "number" ||
      !Number.isFinite(value[key]) ||
      value[key] < (key === "leaseDelta" ? -1000000 : 0) ||
      value[key] > 10000000
    )
      throw Error("Payment HTTP metric rejected");
  for (const key of numeric.filter((key) => !key.endsWith("Ms")))
    if (!Number.isSafeInteger(value[key]))
      throw Error("Payment HTTP count rejected");
  for (const key of booleans)
    if (typeof value[key] !== "boolean")
      throw Error("Payment HTTP flag rejected");
  if (value.externalProviderQualified !== false)
    throw Error("External provider qualification forbidden");
  if (
    value.passed &&
    (!booleans
      .filter((key) => key !== "externalProviderQualified")
      .every((key) => value[key]) ||
      value.samples !== 20 ||
      value.concurrency !== 4 ||
      value.maxHttpInFlight > 4 ||
      value.maxHttpInFlight < 1 ||
      value.httpCalls !== 145 ||
      value.paidToQrP95Ms > 30000 ||
      value.intentToQrP95Ms > 30000 ||
      value.paidToQrMaxMs < value.paidToQrP95Ms ||
      value.intentToQrMaxMs < value.intentToQrP95Ms ||
      value.intentCreates !== 20 ||
      value.receipts !== 20 ||
      value.duplicateCallbacks !== 40 ||
      value.processedEvents !== 40 ||
      value.sold !== 20 ||
      value.held ||
      value.available ||
      value.unexpectedTransport ||
      value.leaseDelta ||
      value.signatureDenials !== 2)
  )
    throw Error("Payment HTTP completion rejected");
  return value;
}
function run(action, env = process.env, log = console.log) {
  if (!["clear", "report"].includes(action))
    throw Error("Payment HTTP action rejected");
  if (action === "clear") {
    if (fs.existsSync(receiptPath)) {
      const stat = fs.lstatSync(receiptPath);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw Error("Stale payment receipt rejected");
      fs.unlinkSync(receiptPath);
    }
    return;
  }
  const stat = fs.lstatSync(receiptPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192)
    throw Error("Payment receipt file rejected");
  const value = validate(JSON.parse(fs.readFileSync(receiptPath, "utf8")), env);
  log(JSON.stringify(value));
  if (!value.passed) throw Error("Payment HTTP qualification failed");
}
if (require.main === module) {
  try {
    run(process.argv[2]);
  } catch {
    console.error(
      "Payment HTTP receipt missing or rejected (raw data suppressed)",
    );
    process.exitCode = 1;
  }
}
module.exports = { validate, run, numeric, booleans };
