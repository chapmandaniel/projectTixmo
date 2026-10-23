// Pure admission/projection/source-contract checks; never launches browser/app/services.
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const {
  guard,
  diagnostic,
  browserResult,
  validate,
  flags,
  numbers,
  scope,
} = require("./scanner-browser-guard.cjs");
const uuid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const fixture = {
  keys: ["sk_scanner_" + "a".repeat(64), "sk_scanner_" + "b".repeat(64)],
  qr: `TICKET:${uuid}:TIX-${"c".repeat(24)}:${uuid}`,
  freshQr: `TICKET:${other}:TIX-${"d".repeat(24)}:${uuid}`,
};
const env = {
  NODE_ENV: "production",
  TIXMO_ALLOW_DESTRUCTIVE_TESTS: "1",
  DATABASE_URL:
    "postgresql://tixmo_ci:synthetic_ci_password@127.0.0.1:49152/tixmo_disposable_ci?schema=public",
  REDIS_URL: "redis://127.0.0.1:49153/1",
  TIXMO_BROWSER_PATH: "/usr/bin/google-chrome",
  TIXMO_SCANNER_API: "http://127.0.0.1:49154",
  TIXMO_SCANNER_PORT: "49155",
  TIXMO_SCANNER_FIXTURE: JSON.stringify(fixture),
  TIXMO_SCANNER_SOURCE_SHA: "a".repeat(40),
  TIXMO_SCANNER_RUN_ID: "123-1",
};
const receipt = () => ({
  scope,
  sourceSha: env.TIXMO_SCANNER_SOURCE_SHA,
  runId: env.TIXMO_SCANNER_RUN_ID,
  ...Object.fromEntries(flags.map((k) => [k, true])),
  ...Object.fromEntries(numbers.map((k) => [k, 0])),
  browserProcesses: 2,
  raceArrivals: 2,
  raceAdmissions: 1,
  raceRejections: 1,
  entrySuccesses: 1,
  raceAttempts: 2,
  allAttempts: 3,
});
test("exact disposable production-build browser fixture admitted", () =>
  assert.equal(guard(env).api.hostname, "127.0.0.1"));
for (const [name, patch] of [
  ["node-env", { NODE_ENV: "test" }],
  ["no-reset", { TIXMO_ALLOW_DESTRUCTIVE_TESTS: "0" }],
  [
    "remote-db",
    { DATABASE_URL: env.DATABASE_URL.replace("127.0.0.1", "foreign.invalid") },
  ],
  [
    "shared-db",
    {
      DATABASE_URL: env.DATABASE_URL.replace("tixmo_disposable_ci", "railway"),
    },
  ],
  ["remote-api", { TIXMO_SCANNER_API: "https://foreign.invalid" }],
  ["api-path", { TIXMO_SCANNER_API: env.TIXMO_SCANNER_API + "/private" }],
  [
    "api-credentials",
    {
      TIXMO_SCANNER_API: env.TIXMO_SCANNER_API.replace(
        "http://",
        "http://foreign:foreign@",
      ),
    },
  ],
  ["same-port", { TIXMO_SCANNER_PORT: "49154" }],
  ["privileged-port", { TIXMO_SCANNER_PORT: "80" }],
  [
    "browser-command",
    { TIXMO_BROWSER_PATH: "/usr/bin/chrome --remote-debugging-port=22" },
  ],
  [
    "same-key",
    {
      TIXMO_SCANNER_FIXTURE: JSON.stringify({
        ...fixture,
        keys: [fixture.keys[0], fixture.keys[0]],
      }),
    },
  ],
  [
    "extra-fixture",
    {
      TIXMO_SCANNER_FIXTURE: JSON.stringify({
        ...fixture,
        secret: "private-canary",
      }),
    },
  ],
  [
    "bad-qr",
    {
      TIXMO_SCANNER_FIXTURE: JSON.stringify({
        ...fixture,
        qr: "private-canary",
      }),
    },
  ],
  [
    "same-qr",
    {
      TIXMO_SCANNER_FIXTURE: JSON.stringify({
        ...fixture,
        freshQr: fixture.qr,
      }),
    },
  ],
])
  test("reject " + name, () =>
    assert.throws(() => guard({ ...env, ...patch })),
  );
test("IPC results project only expected booleans and bounded diagnostics", () => {
  const value = {
    ok: true,
    browserProcesses: 2,
    ...Object.fromEntries(
      [
        "raceDom",
        "duplicateDenied",
        "revokedDenied",
        "storageEmpty",
        "profileKeysAbsent",
        "sessionsIsolated",
      ].map((k) => [k, true]),
    ),
    error: "private-canary",
  };
  assert.doesNotMatch(
    JSON.stringify(browserResult(value)),
    /private-canary|error/,
  );
  assert.equal(browserResult({ ...value, revokedDenied: false }), null);
  assert.deepEqual(
    diagnostic({ stage: 4, category: "assertion", message: "private-canary" }),
    { stage: 4, category: "assertion" },
  );
  for (const v of [
    { stage: 0, category: "other" },
    { stage: 13, category: "other" },
    { stage: 1, category: "private-canary" },
  ])
    assert.equal(diagnostic(v), null);
});
test("complete current-run fixed receipt admits only exact counters and required cleanup", () =>
  assert.equal(validate(receipt(), env).passed, true));
for (const [name, patch] of [
  ["stale-source", { sourceSha: "b".repeat(40) }],
  ["stale-run", { runId: "123-2" }],
  ["extra", { error: "private-canary" }],
  ["duplicate-admission", { entrySuccesses: 2 }],
  ["missing-race", { raceArrivals: 1 }],
  ["missing-attempt", { raceAttempts: 1 }],
  ["provider", { providerAttempts: 1 }],
  ["cleanup", { cleanupVerified: false }],
  ["lifetime", { lifetimeCleanupVerified: false }],
  ["physical-claim", { physicalDevices: 2 }],
  ["fraction", { browserProcesses: 1.5 }],
  ["nan", { allAttempts: NaN }],
  ["failed-diagnostic-pass", { diagnosticStage: 4 }],
  ["unbounded-diagnostic", { passed: false, diagnosticStage: 13 }],
])
  test("receipt rejects " + name, () =>
    assert.throws(() => validate({ ...receipt(), ...patch }, env)),
  );
test("failed receipt remains false without allowing private fields", () => {
  assert.equal(
    validate({ ...receipt(), passed: false, cleanupVerified: false }, env)
      .passed,
    false,
  );
  assert.throws(() =>
    validate(
      { ...receipt(), passed: false, raceArrivals: "private-canary" },
      env,
    ),
  );
});
test("collected mounted test and worker keep real transport, barrier, isolation and fail-preserve joins", () => {
  const testSource = fs.readFileSync(
    path.join(
      __dirname,
      "../tixmoapi2/tests/integration/scanner-browser.test.ts",
    ),
    "utf8",
  );
  const worker = fs.readFileSync(
    path.join(__dirname, "browser/scanner-sessions.mjs"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(__dirname, "../.github/workflows/market-readiness-local.yml"),
    "utf8",
  );
  assert.match(testSource, /await releaseRace.promise/);
  assert.match(testSource, /await realScan\(data\)/);
  assert.match(testSource, /raceFinished.promise/);
  assert.ok(
    testSource.indexOf(
      "requireWorkerCleanup();",
      testSource.indexOf("} finally"),
    ) < testSource.indexOf("prisma.scanLog.deleteMany"),
  );
  assert.match(testSource, /await bounded\(drain\(\)\)/);
  assert.match(testSource, /await financial\(\)/);
  assert.match(testSource, /beforeFresh/);
  assert.match(worker, /--user-data-dir=/);
  assert.match(worker, /Promise.all\(\[\s*a.click/);
  assert.match(worker, /Fetch.continueRequest/);
  assert.doesNotMatch(
    worker,
    /Fetch.fulfillRequest|BarcodeDetector|getUserMedia/,
  );
  assert.match(worker, /keyAbsent\(record.profile\)/);
  assert.match(worker, /isSymbolicLink\(\), false/);
  assert.match(worker, /SIGKILL/);
  assert.match(workflow, /node scripts\/scanner-browser-guard.cjs report/);
});

test("actual origin validator snapshots configuration: late repair fails, early frontend origin works", () => {
  const ts = require("../tixmoapi2/node_modules/typescript");
  const vm = require("node:vm");
  const source = fs.readFileSync(
    path.join(__dirname, "../tixmoapi2/src/utils/clientOrigin.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const origin = "http://127.0.0.1:49155";
  const load = (config) => {
    const exports = {};
    vm.runInNewContext(compiled, {
      exports,
      URL,
      require: (name) => {
        assert.equal(name, "../config/environment");
        return { config };
      },
    });
    return exports.isTrustedClientOrigin;
  };
  const config = {
    clientUrl: "http://localhost:3001",
    corsOrigin: ["http://localhost:3001"],
  };
  const original = load(config);
  assert.equal(original(origin), false);
  config.clientUrl = origin;
  assert.equal(original(origin), false);
  assert.equal(load(config)(origin), true);
  assert.equal(load(config)("https://foreign.invalid"), false);
  const testSource = fs.readFileSync(
    path.join(
      __dirname,
      "../tixmoapi2/tests/integration/scanner-browser.test.ts",
    ),
    "utf8",
  );
  const wired = testSource.indexOf(
    "jest.replaceProperty(config, 'clientUrl', clientOrigin)",
  );
  assert.ok(wired > 0);
  for (const module of [
    "../../src/middleware/auth",
    "../../src/api/scanners/controller",
    "../../src/app",
  ])
    assert.ok(wired < testSource.indexOf("import('" + module + "')"));
  assert.ok(testSource.indexOf("clientUrl.restore()") > wired);
});
