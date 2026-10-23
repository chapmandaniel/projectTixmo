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
    {
      stage: 4,
      category: "assertion",
      detail: 0,
      reason: 0,
      rejected: 0,
      entryType: 0,
    },
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
  assert.match(worker, /keyAbsent\(browsers\[0\].profile\)/);
  assert.match(worker, /keyAbsent\(browsers\[1\].profile\)/);
  assert.match(
    worker,
    /stat.isSymbolicLink\(\)\) throw new FixedFailure\(4, 1\)/,
  );
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

test("granular failure fields are fixed numeric only and cannot qualify a failed proof", () => {
  const projected = diagnostic({
    stage: 8,
    category: "assertion",
    detail: 5,
    reason: 7,
    rejected: 1,
    message: "private-canary",
  });
  assert.deepEqual(projected, {
    stage: 8,
    category: "assertion",
    detail: 5,
    reason: 7,
    rejected: 1,
    entryType: 0,
  });
  assert.doesNotMatch(JSON.stringify(projected), /private-canary|message/);
  for (const patch of [
    { detail: 6 },
    { reason: 8 },
    { rejected: 101 },
    { reason: "private-canary" },
    { entryType: 4 },
    { rejected: NaN },
  ])
    assert.equal(diagnostic({ stage: 8, category: "other", ...patch }), null);
  assert.throws(() =>
    validate(
      {
        ...receipt(),
        diagnosticDetail: 5,
        diagnosticReason: 7,
        unexpectedBrowserRequests: 1,
      },
      env,
    ),
  );
  assert.equal(
    validate(
      {
        ...receipt(),
        passed: false,
        diagnosticStage: 8,
        diagnosticDetail: 5,
        diagnosticReason: 7,
        unexpectedBrowserRequests: 1,
      },
      env,
    ).passed,
    false,
  );
});
test("actual CDP close rejects pending continuation; closing before handler join can increment old rejection counter", async () => {
  const vm = require("node:vm");
  const source = fs.readFileSync(
    path.join(__dirname, "browser/scanner-sessions.mjs"),
    "utf8",
  );
  const start = source.indexOf("  const rejectAll =");
  const end = source.indexOf('  ws.addEventListener("close"', start);
  assert.ok(start >= 0 && end > start);
  for (const closeFirst of [true, false]) {
    const commands = new Map();
    let resolve,
      reject,
      rejected = 0;
    const pending = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    commands.set(1, { resolve, reject, method: "Fetch.continueRequest" });
    const close = vm.runInNewContext(
      source.slice(start, end) + "; rejectAll;",
      { commands, Error, record: { closingRequested: false } },
    );
    const handler = pending.catch(() => {
      rejected++;
    });
    if (closeFirst) close(true);
    else {
      resolve();
      await handler;
      close();
    }
    await handler;
    assert.equal(rejected, closeFirst ? 1 : 0);
  }
});

test("owned shutdown joins actual paused handlers before WebSocket close without relaxing counters", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "browser/scanner-sessions.mjs"),
    "utf8",
  );
  const start = source.indexOf("async function stopped(record)");
  assert.ok(
    source.indexOf("await bounded(drainHandlers(), 5000)", start) <
      source.indexOf("record.ws?.close()", start),
  );
  assert.match(source, /while \(handlers.size\) await Promise.allSettled/);
  assert.match(source, /if \(rejected !== 0\) throw new FixedFailure\(7\)/);
});

test("actual profile proof still rejects UTF8/UTF16 keys and symlinks with fixed reasons", async () => {
  const vm = require("node:vm"),
    os = require("node:os"),
    fsp = require("node:fs/promises");
  const source = fs.readFileSync(
    path.join(__dirname, "browser/scanner-sessions.mjs"),
    "utf8",
  );
  const classSource = source.slice(
    source.indexOf("class FixedFailure extends Error"),
    source.indexOf("let detail = 0;"),
  );
  const proofSource = source.slice(
    source.indexOf("async function keyAbsent(profile)"),
    source.indexOf("async function open(index)"),
  );
  const key = "synthetic-profile-canary";
  const proof = vm.runInNewContext(
    classSource + "\n" + proofSource + "\nkeyAbsent;",
    {
      lstat: fsp.lstat,
      readdir: fsp.readdir,
      readFile: fsp.readFile,
      join: path.join,
      fixture: { keys: [key] },
      Buffer,
    },
  );
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "task615-profile-proof-"));
  try {
    const profile = path.join(base, "profile"),
      file = path.join(profile, "ordinary");
    fs.mkdirSync(profile);
    fs.writeFileSync(file, "safe");
    await proof(profile);
    for (const encoding of ["utf8", "utf16le"]) {
      fs.writeFileSync(file, Buffer.from(key, encoding));
      await assert.rejects(
        proof(profile),
        (error) =>
          error.reason === 6 && error.message === "Scanner proof failed",
      );
    }
    fs.unlinkSync(file);
    const outside = path.join(base, "outside");
    fs.writeFileSync(outside, "preserve");
    fs.symlinkSync(outside, file);
    await assert.rejects(
      proof(profile),
      (error) => error.reason === 4 && error.entryType === 1,
    );
    assert.equal(fs.readFileSync(outside, "utf8"), "preserve");
    fs.unlinkSync(file);
    fs.writeFileSync(file, "");
    fs.truncateSync(file, 268435457);
    await assert.rejects(proof(profile), (error) => error.reason === 5);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("graceful Browser.close accepts only typed owned socket-close ack loss", async () => {
  const {
    OwnedBrowserClosed,
    requestBrowserClose,
  } = require("./scanner-browser-guard.cjs");
  const calls = [];
  await requestBrowserClose(async (method) => {
    calls.push(method);
  });
  assert.deepEqual(calls, ["Browser.close"]);
  await requestBrowserClose(async () => {
    throw new OwnedBrowserClosed();
  });
  for (const error of [
    Error("CDP closed"),
    Error("CDP rejected"),
    Error("deadline"),
    { message: "Browser.close" },
  ])
    await assert.rejects(
      requestBrowserClose(async () => {
        throw error;
      }),
      (value) => value === error,
    );
});
test("actual CDP rejection classifier brands only requested Browser.close on close event", async () => {
  const { OwnedBrowserClosed } = require("./scanner-browser-guard.cjs"),
    vm = require("node:vm");
  const source = fs.readFileSync(
    path.join(__dirname, "browser/scanner-sessions.mjs"),
    "utf8",
  );
  const start = source.indexOf("  const rejectAll ="),
    end = source.indexOf('  ws.addEventListener("close"', start);
  assert.ok(start > 0 && end > start);
  for (const [method, requested, closed, expected] of [
    ["Browser.close", true, true, true],
    ["Browser.close", true, false, false],
    ["Browser.close", false, true, false],
    ["Fetch.continueRequest", true, true, false],
  ]) {
    const commands = new Map();
    let reject;
    const pending = new Promise((_, fail) => {
      reject = fail;
    });
    commands.set(1, { reject, method });
    const close = vm.runInNewContext(source.slice(start, end) + ";rejectAll;", {
      commands,
      record: { closingRequested: requested },
      OwnedBrowserClosed,
      Error,
    });
    close(closed);
    await assert.rejects(
      pending,
      (error) => error instanceof OwnedBrowserClosed === expected,
    );
  }
  const stop = source.indexOf("async function stopped(record)");
  assert.ok(
    source.indexOf("await requestBrowserClose(record.send)", stop) <
      source.indexOf("process.kill(-record.child.pid, signal)", stop),
  );
  assert.ok(
    source.indexOf("await bounded(record.closed, 5000)", stop) <
      source.indexOf("process.kill(-record.child.pid, signal)", stop),
  );
  assert.match(source, /if \(gracefulFailure\) throw gracefulFailure/);
});

test("actual stop protocol requests graceful Chrome exit before socket close or forced fallback", async () => {
  const vm = require("node:vm");
  const {
    OwnedBrowserClosed,
    requestBrowserClose,
  } = require("./scanner-browser-guard.cjs");
  const source = fs.readFileSync(
    path.join(__dirname, "browser/scanner-sessions.mjs"),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("async function stopped(record)"),
    source.indexOf("async function keyAbsent(profile)"),
  );
  for (const outcome of ["ack", "owned-close", "rejected"]) {
    const trace = [];
    let alive = true,
      resolve;
    const record = {
      child: { pid: 12345, exitCode: null, signalCode: null },
      ws: {
        readyState: 1,
        close() {
          trace.push("socket-close");
        },
      },
      closed: new Promise((done) => {
        resolve = done;
      }),
      debugOrigin: "http://127.0.0.1:49155",
    };
    const failure = Error("CDP rejected");
    record.send = async (method) => {
      assert.equal(method, "Browser.close");
      trace.push(method);
      if (outcome === "rejected") throw failure;
      alive = false;
      record.child.exitCode = 0;
      resolve();
      if (outcome === "owned-close") throw new OwnedBrowserClosed();
    };
    const stop = vm.runInNewContext(body + "; stopped;", {
      drainHandlers: async () => {
        trace.push("drain");
      },
      bounded: async (promise) => promise,
      requestBrowserClose,
      WebSocket: { OPEN: 1 },
      process: {
        kill(_pid, signal) {
          assert.equal(_pid, -record.child.pid);
          if (signal === 0) {
            if (!alive) throw Object.assign(Error("absent"), { code: "ESRCH" });
            return;
          }
          trace.push("forced");
          alive = false;
          record.child.signalCode = signal;
          resolve();
        },
      },
      assert,
      FixedFailure: class extends Error {},
      fetch: async () => {
        throw Error("closed");
      },
      AbortSignal,
    });
    if (outcome === "rejected")
      await assert.rejects(stop(record), (error) => error === failure);
    else await stop(record);
    assert.equal(alive, false);
    assert.ok(trace.indexOf("drain") < trace.indexOf("Browser.close"));
    assert.ok(trace.indexOf("Browser.close") < trace.indexOf("socket-close"));
    assert.equal(trace.includes("forced"), outcome === "rejected");
  }
});
