"use strict";
// No app imports: fixed synthetic CI admission, scheduling and aggregate projection.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const DURATION = 1800000;
const ACTORS = 200;
const receiptPath = path.resolve(
  __dirname,
  "../runtime/task610-http-soak.json",
);
const kinds = [
  "public",
  "wallet",
  "reservation",
  "recovery",
  "cancel",
  "refresh",
  "expired",
];
function guard(env) {
  require("./verification-safety.cjs").validateVerificationTargets(env);
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.TIXMO_HTTP_SOAK !== "synthetic-only" ||
    env.TIXMO_SOAK_BRANCH !== "codex/http-soak-qualification" ||
    env.NODE_ENV !== "test" ||
    !/^[a-f0-9]{40}$/.test(env.TIXMO_SOAK_SOURCE_SHA || "") ||
    !/^\d{1,20}-\d{1,5}$/.test(env.TIXMO_SOAK_RUN_ID || "")
  )
    throw Error("Soak admission rejected");
  const db = new URL(env.DATABASE_URL),
    redis = new URL(env.REDIS_URL);
  if (
    db.hostname !== "127.0.0.1" ||
    db.pathname !== "/tixmo_disposable_soak" ||
    db.username !== "tixmo_soak_ci" ||
    db.password !== "synthetic_soak_password" ||
    redis.hostname !== "127.0.0.1" ||
    redis.pathname !== "/9" ||
    redis.username ||
    redis.password
  )
    throw Error("Soak services rejected");
  return true;
}
function plan(actor) {
  if (!Number.isInteger(actor) || actor < 0 || actor >= ACTORS)
    throw Error("Actor rejected");
  const actions = [];
  for (let cycle = 0; cycle < 180; cycle++)
    actions.push({
      kind: "browse",
      target: cycle * 10000 + actor * 50,
      cadence: 10000,
    });
  // Last checkout starts before 29m50s; deadline-bound cycle must release within10s.
  for (let cycle = 0; cycle < 30; cycle++)
    actions.push({
      kind: "checkout",
      target: cycle * 60000 + actor * 250,
      cadence: 10000,
    });
  return actions.sort(
    (a, b) => a.target - b.target || a.kind.localeCompare(b.kind),
  );
}
function admitSlot(action, elapsed) {
  return elapsed < DURATION && elapsed - action.target < action.cadence;
}
function refreshDue(expiry, now) {
  if (!Number.isFinite(expiry) || !Number.isFinite(now))
    throw Error("Expiry rejected");
  return now >= expiry - 60000;
}
function percentile(values, fraction = 0.95) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}
function bucket(rows, index, samples = []) {
  const selected = rows.filter(
    (row) => Math.floor(row.started / 300000) === index,
  );
  const endpoints = {};
  for (const kind of kinds) {
    const all = selected.filter((row) => row.kind === kind);
    const expected =
      kind === "reservation" ? 201 : kind === "expired" ? 401 : 200;
    const good = all.filter((row) => row.status === expected && row.valid);
    endpoints[kind] = {
      requests: all.length,
      expected: good.length,
      p95Ms: percentile(good.map((row) => row.settled - row.started)),
      http429: all.filter((row) => row.status === 429).length,
      http503: all.filter((row) => row.status === 503).length,
      http5xx: all.filter((row) => row.status >= 500).length,
      networkErrors: all.filter((row) => row.status === 0).length,
      unexpected: all.length - good.length,
    };
  }
  const selectedSamples = samples.filter(
    (sample) => Math.floor(sample.at / 300000) === index,
  );
  return {
    index,
    endpoints,
    resources: {
      samples: selectedSamples.length,
      maxRssBytes: Math.max(0, ...selectedSamples.map((sample) => sample.rss)),
      maxHeapBytes: Math.max(
        0,
        ...selectedSamples.map((sample) => sample.heap),
      ),
    },
  };
}
function assertBuckets(buckets) {
  if (buckets.length !== 6) throw Error("Soak buckets missing");
  for (const b of buckets) {
    for (const kind of kinds) {
      const e = b.endpoints[kind];
      if (
        e.unexpected ||
        e.http429 ||
        e.http503 ||
        e.networkErrors ||
        (kind === "reservation" && e.p95Ms > 2000) ||
        (["public", "wallet", "recovery"].includes(kind) && e.p95Ms > 500)
      )
        throw Error("Soak endpoint gate failed");
      if (!["expired", "refresh"].includes(kind) && e.requests === 0)
        throw Error("Soak endpoint absent");
    }
  }
}
function validate(value, env) {
  const fixed = {
    scope: "task610-http-soak",
    harnessVersion: 2,
    sourceSha: env.TIXMO_SOAK_SOURCE_SHA,
    runId: env.TIXMO_SOAK_RUN_ID,
    actorModel: "authenticated-http-actors-not-browsers",
    resourceScope: "combined-api-and-driver-process-owned-ci-services",
    durationMs: DURATION,
    actors: ACTORS,
    accessJwtSeconds: 900,
    refreshJwtSeconds: 2700,
    syntheticReadMax: 10000,
    syntheticWriteMax: 4000,
    syntheticAdmissionMax: 4000,
    limitsQualified: false,
  };
  if (!value || typeof value !== "object") throw Error("Soak receipt missing");
  for (const [key, expected] of Object.entries(fixed))
    if (value[key] !== expected) throw Error("Soak receipt binding failed");
  // This numeric/boolean-only tree rejects URLs, IDs, errors and extra fields at every level.
  const shape = {
    ...fixed,
    passed: false,
    cleanupVerified: false,
    lifetimeCleanupVerified: false,
    metrics: {},
    buckets: [],
  };
  if (Object.keys(value).sort().join() !== Object.keys(shape).sort().join())
    throw Error("Soak receipt fields rejected");
  const names = [
    "elapsedMs",
    "fullActorOverlapMs",
    "maxActiveActors",
    "remainingActors",
    "maxHttpInFlight",
    "remainingHttpInFlight",
    "scheduledActions",
    "executedActions",
    "missedSlots",
    "latenessP95Ms",
    "latenessMaxMs",
    "plannedOfferedRps",
    "actualOfferedRps",
    "completionRps",
    "orders",
    "tickets",
    "paidBaselines",
    "cancelledOrders",
    "paymentAttempts",
    "refunds",
    "receiptQueued",
    "queueOldestAgeMs",
    "leaseDelta",
    "refreshes",
    "expired401",
    "maxHoldMs",
    "allRequests",
    "drainRequests",
    "unexpectedRequests",
    "maxPendingQueued",
    "sampleCount",
    "maxPgConnections",
    "maxPgActive",
    "maxPgLockWaiters",
    "maxRedisMemoryBytes",
    "maxRedisClients",
    "maxRssBytes",
    "maxHeapBytes",
    "cpuUserMs",
    "cpuSystemMs",
    "eventLoopP95Ms",
    "eventLoopMaxMs",
    "gaAvailable",
    "gaHeld",
    "gaSold",
  ];
  if (
    !value.metrics ||
    Object.keys(value.metrics).sort().join() !== names.sort().join()
  )
    throw Error("Soak metrics rejected");
  for (const number of Object.values(value.metrics))
    if (
      typeof number !== "number" ||
      !Number.isFinite(number) ||
      number < 0 ||
      number > 1e13
    )
      throw Error("Soak metric bounds rejected");
  for (const flag of ["passed", "cleanupVerified", "lifetimeCleanupVerified"])
    if (typeof value[flag] !== "boolean") throw Error("Soak flag rejected");
  if (!Array.isArray(value.buckets) || value.buckets.length !== 6)
    throw Error("Soak buckets rejected");
  for (let i = 0; i < 6; i++) {
    const b = value.buckets[i];
    if (
      !b ||
      Object.keys(b).sort().join() !== "endpoints,index,resources" ||
      b.index !== i ||
      Object.keys(b.endpoints || {})
        .sort()
        .join() !== [...kinds].sort().join()
    )
      throw Error("Soak bucket fields rejected");
    if (
      !b.resources ||
      Object.keys(b.resources).sort().join() !==
        "maxHeapBytes,maxRssBytes,samples"
    )
      throw Error("Soak bucket resources rejected");
    for (const n of Object.values(b.resources))
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1e13)
        throw Error("Soak bucket resource bounds rejected");
    if (!Number.isSafeInteger(b.resources.samples))
      throw Error("Soak resource sample count rejected");
    for (const e of Object.values(b.endpoints)) {
      if (
        !e ||
        Object.keys(e).sort().join() !==
          [
            "requests",
            "expected",
            "p95Ms",
            "http429",
            "http503",
            "http5xx",
            "networkErrors",
            "unexpected",
          ]
            .sort()
            .join()
      )
        throw Error("Soak endpoint fields rejected");
      for (const n of Object.values(e))
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1e9)
          throw Error("Soak endpoint bounds rejected");
      if (e.expected + e.unexpected !== e.requests)
        throw Error("Soak endpoint counts rejected");
    }
  }
  if (value.passed) {
    const m = value.metrics;
    if (
      value.buckets.some(
        (b) =>
          b.resources.samples === 0 ||
          b.resources.maxRssBytes > m.maxRssBytes ||
          b.resources.maxHeapBytes > m.maxHeapBytes,
      ) ||
      value.buckets.reduce((sum, b) => sum + b.resources.samples, 0) >
        m.sampleCount
    )
      throw Error("Soak resource consistency rejected");

    assertBuckets(value.buckets);
    const total = (kind, field = "requests") =>
      value.buckets.reduce((sum, b) => sum + b.endpoints[kind][field], 0);
    const bucketRequests = kinds.reduce((sum, k) => sum + total(k), 0);
    if (
      m.allRequests !== bucketRequests + m.drainRequests ||
      m.allRequests !== 90000 + m.refreshes + m.expired401 ||
      total("reservation", "expected") !== 6000 ||
      total("recovery", "expected") !== 6000 ||
      total("cancel", "expected") !== 6000 ||
      total("public", "expected") +
        total("wallet", "expected") +
        m.drainRequests !==
        72000 ||
      total("refresh", "expected") !== m.refreshes ||
      total("expired", "expected") !== 200
    )
      throw Error("Soak aggregate consistency rejected");

    if (
      !value.cleanupVerified ||
      !value.lifetimeCleanupVerified ||
      m.elapsedMs < DURATION ||
      m.elapsedMs > DURATION + 30000 ||
      m.fullActorOverlapMs < DURATION - 15000 ||
      m.maxActiveActors !== ACTORS ||
      m.remainingActors ||
      m.remainingHttpInFlight ||
      m.unexpectedRequests ||
      m.allRequests < 90600 ||
      m.missedSlots ||
      m.executedActions !== 42000 ||
      m.scheduledActions !== 42000 ||
      m.expired401 !== ACTORS ||
      m.refreshes < ACTORS * 2 ||
      m.cancelledOrders !== 6000 ||
      m.orders !== 6200 ||
      m.tickets !== 6200 ||
      m.paidBaselines !== ACTORS ||
      m.paymentAttempts ||
      m.refunds ||
      m.receiptQueued ||
      m.leaseDelta ||
      m.maxHoldMs > 10000 ||
      m.gaHeld ||
      m.gaAvailable !== 400 ||
      m.gaSold !== ACTORS ||
      m.sampleCount < 300
    )
      throw Error("Soak completion gate rejected");
  }
  return value;
}
// Fixed suite and numeric lines only; never test names, messages, tokens or URLs.
function failureSummary(report) {
  const lines = [];
  const suites = Array.isArray(report?.testResults)
    ? report.testResults.slice(0, 20)
    : [];
  let failedSuite = false;
  for (const suite of suites) {
    if (
      typeof suite?.name !== "string" ||
      suite.name.length > 4096 ||
      !/[\\/]orders-http\.soak\.ts$/.test(suite.name) ||
      suite.status !== "failed"
    )
      continue;
    failedSuite = true;
    const cases = Array.isArray(suite.assertionResults)
      ? suite.assertionResults.slice(0, 10)
      : [];
    for (const item of cases) {
      if (item?.status !== "failed") continue;
      const messages = Array.isArray(item.failureMessages)
        ? item.failureMessages.slice(0, 3)
        : [];
      for (const message of messages) {
        if (typeof message !== "string") continue;
        for (const frame of message.slice(0, 20000).split("\n").slice(0, 100)) {
          if (
            lines.length >= 3 ||
            frame.length > 4096 ||
            frame.includes("://") ||
            !/^\s*at\s/.test(frame)
          )
            continue;
          const match =
            /[\\/]orders-http\.soak\.ts:(\d{1,6}):(\d{1,6})\)?\s*$/.exec(frame);
          const line = match ? Number(match[1]) : 0,
            column = match ? Number(match[2]) : 0;
          if (
            line >= 1 &&
            line <= 100000 &&
            column >= 1 &&
            column <= 100000 &&
            !lines.includes(line)
          )
            lines.push(line);
        }
      }
    }
  }
  const count = report?.numFailedTests;
  return {
    scope: "task610-safe-failure",
    failedSuite,
    failedTests:
      Number.isInteger(count) && count >= 0 && count <= 100000 ? count : null,
    lines,
  };
}
function syntheticEnv(env) {
  return {
    PATH: env.PATH,
    HOME: env.HOME,
    TMPDIR: env.TMPDIR,
    NODE_ENV: "test",
    GITHUB_ACTIONS: "true",
    TIXMO_ALLOW_DESTRUCTIVE_TESTS: "1",
    TIXMO_HTTP_SOAK: "synthetic-only",
    TIXMO_SOAK_BRANCH: env.TIXMO_SOAK_BRANCH,
    TIXMO_SOAK_SOURCE_SHA: env.TIXMO_SOAK_SOURCE_SHA,
    TIXMO_SOAK_RUN_ID: env.TIXMO_SOAK_RUN_ID,
    DATABASE_URL: env.DATABASE_URL,
    TIXMO_TEST_DATABASE_URL: env.DATABASE_URL,
    TIXMO_ALLOW_TEST_RESET: "true",
    REDIS_URL: env.REDIS_URL,
    REDIS_DB: "9",
    JWT_SECRET: "ci_soak_jwt_secret_32_chars_minimum",
    JWT_REFRESH_SECRET: "ci_soak_refresh_secret_32_minimum",
    SESSION_SECRET: "ci_soak_session_secret_32_minimum",
    JWT_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_IN: "45m",
    STRIPE_SECRET_KEY: ["sk", "test", "soak_synthetic"].join("_"),
    STRIPE_WEBHOOK_SECRET: "whsec_soak_synthetic",
    PAYMENT_CURRENCY: "cad",
  };
}
// Only the detached group returned by our own spawn may be signalled.
// Output is counted and discarded; neither child bytes nor errors are retained.
function ownedCommand(args, options, io = {}) {
  const launch = io.spawn || spawn,
    signal = io.kill || process.kill.bind(process);
  const joinMs = io.joinMs || 5000,
    pollMs = io.pollMs || 20;
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = launch(process.execPath, args, {
        cwd: options.cwd,
        env: options.env,
        detached: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      reject(Error("Soak child could not start"));
      return;
    }
    const pid = child.pid;
    if (
      pid !== undefined &&
      (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid)
    ) {
      reject(Error("Soak child ownership rejected"));
      return;
    }
    let closed = false,
      failed = false,
      joining = false,
      settled = false,
      code = null,
      exitSignal = null,
      bytes = 0;
    let deadline, joinDeadline, poll;
    const clear = () => {
      clearTimeout(deadline);
      clearTimeout(joinDeadline);
      clearInterval(poll);
    };
    const failJoin = () => {
      if (settled) return;
      settled = true;
      clear();
      reject(Error("Soak child group could not join; context retained"));
    };
    const exists = () => {
      if (pid === undefined) return false;
      try {
        signal(-pid, 0);
        return true;
      } catch (error) {
        if (error?.code === "ESRCH") return false;
        throw Error("Group state unavailable");
      }
    };
    const inspect = () => {
      if (settled) return;
      try {
        if (exists()) {
          try {
            signal(-pid, "SIGKILL");
          } catch (error) {
            if (error?.code !== "ESRCH") throw error;
          }
        }
        if (closed && !exists()) {
          settled = true;
          clear();
          resolve({
            ok:
              pid !== undefined && !failed && code === 0 && exitSignal === null,
            cleanupVerified: true,
          });
        }
      } catch {
        failJoin();
      }
    };
    const join = () => {
      if (joining) return;
      joining = true;
      clearTimeout(deadline);
      joinDeadline = setTimeout(failJoin, joinMs);
      poll = setInterval(inspect, pollMs);
      inspect();
    };
    const discard = (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 1000000) {
        failed = true;
        join();
      }
    };
    child.stdout?.on("data", discard);
    child.stderr?.on("data", discard);
    child.once("error", () => {
      failed = true;
      join();
    });
    child.once("exit", () => join());
    child.once("close", (status, why) => {
      closed = true;
      code = status;
      exitSignal = why;
      join();
      inspect();
    });
    deadline = setTimeout(() => {
      failed = true;
      join();
    }, options.timeout);
  });
}
async function run(env = process.env, launch = spawn, log = console.log) {
  guard(env);
  const repo = path.resolve(__dirname, ".."),
    api = path.join(repo, "tixmoapi2");
  if (fs.existsSync(receiptPath)) {
    const stat = fs.lstatSync(receiptPath);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error("Soak stale receipt rejected");
    fs.unlinkSync(receiptPath);
  }
  const childEnv = syntheticEnv(env);
  let commands = 0;
  const lifetime = (verified) =>
    log(
      JSON.stringify({
        scope: "task610-driver-lifetime",
        sourceSha: env.TIXMO_SOAK_SOURCE_SHA,
        runId: env.TIXMO_SOAK_RUN_ID,
        commands,
        processCleanupVerified: verified,
      }),
    );
  const execute = async (args, timeout) => {
    let result;
    try {
      result = await ownedCommand(
        args,
        { cwd: api, env: childEnv, timeout },
        { spawn: launch },
      );
    } catch {
      lifetime(false);
      throw Error("Soak child unjoined; reports retained");
    }
    commands++;
    return result.ok;
  };
  if (
    !(await execute(
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      120000,
    ))
  ) {
    lifetime(true);
    throw Error("Soak schema preparation failed");
  }
  const report = path.join(repo, "runtime/task610-jest.json");
  fs.mkdirSync(path.dirname(report), { recursive: true });
  if (fs.existsSync(report)) {
    const stat = fs.lstatSync(report);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error("Stale report rejected");
    fs.unlinkSync(report);
  }

  let failed = false;
  try {
    failed = !(await execute(
      [
        "node_modules/jest/bin/jest.js",
        "--config",
        "jest.soak.config.cjs",
        "--runInBand",
        "--json",
        "--outputFile",
        report,
      ],
      2100000,
    ));
  } catch {
    throw Error("Soak child unjoined; reports retained");
  }
  lifetime(true);
  if (failed) {
    let reportValue;
    try {
      const stat = fs.lstatSync(report);
      if (stat.isFile() && !stat.isSymbolicLink() && stat.size <= 5000000)
        reportValue = JSON.parse(fs.readFileSync(report, "utf8"));
    } catch {
      /* Fixed missing-report summary only. */
    }
    log(JSON.stringify(failureSummary(reportValue)));
  }
  // Never output raw Jest diagnostics, even on init failure.
  let value;
  try {
    const stat = fs.lstatSync(receiptPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536)
      throw Error("Receipt rejected");
    value = validate(JSON.parse(fs.readFileSync(receiptPath, "utf8")), env);
    log(JSON.stringify(value));
  } catch {
    throw Error("Soak aggregate receipt missing or rejected");
  } finally {
    if (fs.existsSync(report)) fs.unlinkSync(report);
  }
  if (failed || !value.passed) throw Error("Soak qualification failed");
}
if (require.main === module) {
  void run().catch(() => {
    const watchdog = setTimeout(() => process.exit(1), 1000);
    process.stderr.write(
      "HTTP soak qualification failed (raw output suppressed)\n",
      () => {
        clearTimeout(watchdog);
        process.exit(1);
      },
    );
  });
}
module.exports = {
  guard,
  plan,
  admitSlot,
  refreshDue,
  percentile,
  bucket,
  assertBuckets,
  validate,
  run,
  failureSummary,
  syntheticEnv,
  ownedCommand,
  DURATION,
  ACTORS,
  kinds,
};
