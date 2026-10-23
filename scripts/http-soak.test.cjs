"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  guard,
  plan,
  admitSlot,
  refreshDue,
  bucket,
  validate,
  DURATION,
  ACTORS,
  kinds,
} = require("./http-soak.cjs");
const env = {
  NODE_ENV: "test",
  GITHUB_ACTIONS: "true",
  TIXMO_ALLOW_DESTRUCTIVE_TESTS: "1",
  TIXMO_HTTP_SOAK: "synthetic-only",
  TIXMO_SOAK_BRANCH: "codex/http-soak-qualification",
  TIXMO_SOAK_SOURCE_SHA: "a".repeat(40),
  TIXMO_SOAK_RUN_ID: "12345-1",
  DATABASE_URL:
    "postgresql://tixmo_soak_ci:synthetic_soak_password@127.0.0.1:54329/tixmo_disposable_soak?schema=public",
  REDIS_URL: "redis://127.0.0.1:63799/9",
};
const fixture = () => {
  const metrics = Object.fromEntries(
    [
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
    ].map((k) => [k, 0]),
  );
  Object.assign(metrics, {
    elapsedMs: DURATION,
    fullActorOverlapMs: DURATION - 10000,
    maxActiveActors: ACTORS,
    maxHttpInFlight: 100,
    scheduledActions: 42000,
    executedActions: 42000,
    orders: 6200,
    tickets: 6200,
    paidBaselines: 200,
    cancelledOrders: 6000,
    refreshes: 400,
    expired401: 200,
    maxHoldMs: 500,
    allRequests: 90600,
    sampleCount: 360,
    maxRssBytes: 100000000,
    maxHeapBytes: 50000000,
    gaAvailable: 400,
    gaSold: 200,
  });
  const buckets = Array.from({ length: 6 }, (_, index) => ({
    index,
    resources: { samples: 60, maxRssBytes: 100000000, maxHeapBytes: 50000000 },
    endpoints: Object.fromEntries(
      kinds.map((kind) => [
        kind,
        {
          requests:
            kind === "refresh"
              ? [2, 5].includes(index)
                ? 200
                : 0
              : kind === "expired"
                ? index === 3
                  ? 200
                  : 0
                : ["public", "wallet"].includes(kind)
                  ? 6000
                  : 1000,
          expected:
            kind === "refresh"
              ? [2, 5].includes(index)
                ? 200
                : 0
              : kind === "expired"
                ? index === 3
                  ? 200
                  : 0
                : ["public", "wallet"].includes(kind)
                  ? 6000
                  : 1000,
          p95Ms: 10,
          http429: 0,
          http503: 0,
          http5xx: 0,
          networkErrors: 0,
          unexpected: 0,
        },
      ]),
    ),
  }));
  return {
    scope: "task610-http-soak",
    harnessVersion: 2,
    sourceSha: env.TIXMO_SOAK_SOURCE_SHA,
    runId: env.TIXMO_SOAK_RUN_ID,
    actorModel: "authenticated-http-actors-not-browsers",
    resourceScope: "combined-api-and-driver-process-owned-ci-services",
    durationMs: DURATION,
    actors: 200,
    accessJwtSeconds: 900,
    refreshJwtSeconds: 2700,
    syntheticReadMax: 10000,
    syntheticWriteMax: 4000,
    syntheticAdmissionMax: 4000,
    limitsQualified: false,
    passed: true,
    cleanupVerified: true,
    lifetimeCleanupVerified: true,
    metrics,
    buckets,
  };
};
test("admission pins explicit disposable job, branch and synthetic services", () => {
  assert.equal(guard(env), true);
  for (const [key, value] of Object.entries({
    GITHUB_ACTIONS: "false",
    TIXMO_HTTP_SOAK: "true",
    TIXMO_SOAK_BRANCH: "main",
    NODE_ENV: "production",
    TIXMO_ALLOW_DESTRUCTIVE_TESTS: "0",
    TIXMO_SOAK_SOURCE_SHA: "canary",
    TIXMO_SOAK_RUN_ID: "canary",
    DATABASE_URL: env.DATABASE_URL.replace("127.0.0.1", "example.test"),
    REDIS_URL: "redis://127.0.0.1:63799/0",
  }))
    assert.throws(() => guard({ ...env, [key]: value }));
});
test("all200 actors have180 browse and30 checkout slots across actual30min", () => {
  assert.equal(DURATION, 1800000);
  let count = 0;
  for (let actor = 0; actor < 200; actor++) {
    const a = plan(actor);
    assert.equal(a.length, 210);
    assert.equal(a.filter((x) => x.kind === "browse").length, 180);
    assert.equal(a.filter((x) => x.kind === "checkout").length, 30);
    assert.ok(a.every((x) => x.target >= 0 && x.target < DURATION));
    assert.ok(a.every((x, i) => !i || x.target >= a[i - 1].target));
    count += a.length;
  }
  assert.equal(count, 42000);
  assert.throws(() => plan(200));
  assert.throws(() => plan(-1));
});
test("actor staggering is sustained rather than a checkout barrier", () => {
  assert.equal(plan(199).find((a) => a.kind === "checkout").target, 49750);
  assert.equal(
    plan(199)
      .filter((a) => a.kind === "browse")
      .at(-1).target,
    1799950,
  );
  assert.equal(
    plan(0)
      .filter((a) => a.kind === "checkout")
      .at(-1).target,
    1740000,
  );
});
test("late slots are skipped and cannot produce catchup bursts or shortened window", () => {
  const actions = plan(0);
  const stalled = actions.filter((a) => a.target < 40000);
  assert.ok(stalled.length > 3);
  assert.ok(stalled.every((a) => !admitSlot(a, 50000)));
  assert.equal(admitSlot({ target: 60000, cadence: 10000 }, 60020), true);
  assert.equal(admitSlot({ target: 60000, cadence: 10000 }, 70000), false);
  assert.equal(admitSlot({ target: 1799950, cadence: 10000 }, DURATION), false);
});
test("refresh follows actual expiry including login setup elapsed time", () => {
  const issued = 900000;
  assert.equal(refreshDue(issued, 839999), false);
  assert.equal(refreshDue(issued, 840000), true);
  assert.equal(refreshDue(issued, 860000), true);
  assert.equal(refreshDue(issued + 840000, 900000), false);
  assert.throws(() => refreshDue(NaN, 0));
});
test("five minute buckets isolate successful reservation tails from fast read traffic", () => {
  const rows = [
    ...Array.from({ length: 900 }, () => ({
      kind: "public",
      started: 1,
      settled: 11,
      status: 200,
      valid: true,
    })),
    ...Array.from({ length: 100 }, (_, i) => ({
      kind: "reservation",
      started: 1,
      settled: i < 90 ? 11 : 3001,
      status: 201,
      valid: true,
    })),
  ];
  const b = bucket(rows, 0);
  assert.equal(b.endpoints.public.p95Ms, 10);
  assert.equal(b.endpoints.reservation.p95Ms, 3000);
  const value = fixture();
  value.buckets[0].endpoints.reservation = b.endpoints.reservation;
  assert.throws(() => validate(value, env));
});
test("native expiry401 is separate expected traffic, other401 remains failure", () => {
  const b = bucket(
    [
      {
        kind: "expired",
        started: 900001,
        settled: 900010,
        status: 401,
        valid: true,
      },
      {
        kind: "wallet",
        started: 900001,
        settled: 900010,
        status: 401,
        valid: false,
      },
    ],
    3,
  );
  assert.equal(b.endpoints.expired.expected, 1);
  assert.equal(b.endpoints.expired.unexpected, 0);
  assert.equal(b.endpoints.wallet.unexpected, 1);
});
test("valid complete aggregate receipt passes and contains no fixture identifiers", () => {
  assert.deepEqual(validate(fixture(), env), fixture());
});
for (const [name, mutate] of Object.entries({
  shortened: (v) => (v.metrics.elapsedMs = 1799999),
  actors: (v) => (v.metrics.maxActiveActors = 199),
  overlap: (v) => (v.metrics.fullActorOverlapMs = 10000),
  missed: (v) => (v.metrics.missedSlots = 1),
  refresh: (v) => (v.metrics.refreshes = 399),
  expired: (v) => (v.metrics.expired401 = 199),
  holds: (v) => (v.metrics.maxHoldMs = 10001),
  inventory: (v) => (v.metrics.gaHeld = 1),
  paid: (v) => (v.metrics.gaSold = 199),
  providerAttempt: (v) => (v.metrics.paymentAttempts = 1),
  refund: (v) => (v.metrics.refunds = 1),
  cleanup: (v) => (v.cleanupVerified = false),
  lifetime: (v) => (v.lifetimeCleanupVerified = false),
  limits: (v) => (v.limitsQualified = true),
  tail: (v) => (v.metrics.unexpectedRequests = 1),
}))
  test(`completion rejects ${name}`, () => {
    const v = fixture();
    mutate(v);
    assert.throws(() => validate(v, env));
  });
for (const [name, mutate] of Object.entries({
  read: (v) => (v.buckets[1].endpoints.public.p95Ms = 501),
  wallet: (v) => (v.buckets[5].endpoints.wallet.p95Ms = 501),
  reservation: (v) => (v.buckets[2].endpoints.reservation.p95Ms = 2001),
  http429: (v) => (v.buckets[0].endpoints.cancel.http429 = 1),
  http503: (v) => (v.buckets[0].endpoints.public.http503 = 1),
  deadline: (v) => (v.buckets[0].endpoints.public.networkErrors = 1),
  bucket: (v) => v.buckets.pop(),
  hidden: (v) => (v.metrics.url = "https://private-canary.test/token"),
  extra: (v) => (v.buckets[0].endpoints.public.error = "private-canary"),
  stale: (v) => (v.runId = "11111-1"),
  nan: (v) => (v.metrics.maxRssBytes = NaN),
}))
  test(`projection and endpoint gate rejects ${name}`, () => {
    const v = fixture();
    mutate(v);
    assert.throws(() => validate(v, env));
  });
test("false receipt cannot smuggle strings or secrets and does not pass execution", () => {
  const v = fixture();
  v.passed = false;
  v.metrics.url = "private-canary";
  assert.throws(() => validate(v, env));
});
test("dedicated workflow and discovery retain true duration and actual guarded mounted paths", () => {
  const root = path.resolve(__dirname, "..");
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/http-soak-qualification.yml"),
    "utf8",
  );
  assert.match(workflow, /github.head_ref == 'codex\/http-soak-qualification'/);
  assert.match(workflow, /timeout-minutes: 50/);
  assert.match(workflow, /postgres-ssl:18/);
  assert.match(workflow, /redis:8\.2\.9/);
  assert.match(workflow, /node scripts\/http-soak.cjs/);
  const normal = require("../tixmoapi2/jest.config.js"),
    dedicated = require("../tixmoapi2/jest.soak.config.cjs");
  assert.ok(normal.testMatch.every((pattern) => !pattern.endsWith(".soak.ts")));
  assert.deepEqual(dedicated.testMatch, ["**/orders-http.soak.ts"]);
  const source = fs.readFileSync(
    path.join(root, "tixmoapi2/tests/qualification/orders-http.soak.ts"),
    "utf8",
  );
  assert.match(source, /await wait\(start \+ DURATION\)/);
  assert.match(
    source,
    /refreshDue\(sessions\[actor\]\.expires, Date.now\(\)\)/,
  );
  assert.match(source, /decodeExpiry\(tokens\?\.accessToken, 900\)/);
  assert.match(source, /await paidSnapshot\(\)\)\.toEqual\(paidBefore\)/);
  assert.match(source, /await foreignSnapshot\(\)\)\.toEqual\(foreignBefore\)/);
  assert.doesNotMatch(
    source,
    /generateAccessToken|generateTokens|jest\.useFakeTimers/,
  );
  assert.match(source, /response: 5000, deadline: 8000/);
  assert.match(source, /admitSlot\(action, performance.now\(\) - start\)/);
});

test("actual failure diagnostics project only fixed suite flag/count and numeric own-source lines", () => {
  const { failureSummary } = require("./http-soak.cjs");
  const canary = "private-token-secret";
  const result = failureSummary({
    numFailedTests: 1,
    testResults: [
      {
        name: "/tmp/owned/orders-http.soak.ts",
        status: "failed",
        assertionResults: [
          {
            status: "failed",
            title: canary,
            failureMessages: [
              canary +
                "\n    at run (/tmp/owned/orders-http.soak.ts:421:7)\n    at https://secret.test/orders-http.soak.ts:99:1\n    at run (/tmp/owned/foreign.ts:44:2)",
            ],
          },
        ],
      },
    ],
  });
  assert.deepEqual(result, {
    scope: "task610-safe-failure",
    failedSuite: true,
    failedTests: 1,
    lines: [421],
  });
  assert.doesNotMatch(JSON.stringify(result), /private|secret|https|token/);
  assert.deepEqual(failureSummary(null), {
    scope: "task610-safe-failure",
    failedSuite: false,
    failedTests: null,
    lines: [],
  });
});

test("runner refuses target before subprocess and scrubs inherited secrets/rate controls", async () => {
  const { run, syntheticEnv } = require("./http-soak.cjs");
  let calls = 0;
  await assert.rejects(
    run({ ...env, TIXMO_SOAK_BRANCH: "main" }, () => {
      calls++;
    }),
  );
  assert.equal(calls, 0);
  const child = syntheticEnv({
    ...env,
    POSTMARK_SERVER_TOKEN: "private-canary",
    SENTRY_DSN: "private-canary",
    JWT_EXPIRES_IN: "7d",
    JWT_SECRET: "private-canary",
    AWS_ACCESS_KEY_ID: "private-canary",
    RATE_LIMIT_READ_MAX: "999999",
  });
  assert.equal(child.JWT_EXPIRES_IN, "15m");
  assert.equal(child.JWT_REFRESH_EXPIRES_IN, "45m");
  assert.equal(child.REDIS_DB, "9");
  assert.equal(child.TIXMO_TEST_DATABASE_URL, env.DATABASE_URL);
  assert.equal(child.POSTMARK_SERVER_TOKEN, undefined);
  assert.equal(child.RATE_LIMIT_READ_MAX, undefined);
  assert.doesNotMatch(JSON.stringify(child), /private-canary/);
});
test("successful counts cannot be inflated or silently omit bucketed requests", () => {
  for (const mutate of [
    (v) => v.metrics.allRequests++,
    (v) => v.buckets[0].endpoints.public.requests++,
    (v) => v.metrics.drainRequests++,
    (v) => v.metrics.refreshes++,
    (v) => v.buckets[5].endpoints.reservation.expected--,
  ]) {
    const v = fixture();
    mutate(v);
    assert.throws(() => validate(v, env));
  }
});

// Inert child/group protocol; no process, socket, service or fake workload clock.
function protocol({ onKill, groupInitially = true, pid = 62010 } = {}) {
  const { EventEmitter } = require("node:events");
  const child = new EventEmitter();
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  let group = groupInitially;
  const signals = [];
  let options;
  return {
    child,
    signals,
    setGroup: (value) => {
      group = value;
    },
    options: () => options,
    io: {
      spawn: (_executable, _args, opts) => {
        options = opts;
        return child;
      },
      kill: (target, why) => {
        assert.equal(target, -pid);
        signals.push(why);
        if (!group) {
          const e = Error("inert");
          e.code = "ESRCH";
          throw e;
        }
        if (why === "SIGKILL")
          onKill?.(child, () => {
            group = false;
          });
      },
      joinMs: 60,
      pollMs: 1,
    },
  };
}
test("owned command waits for close AND delayed descendant group absence before cleanup", async () => {
  const { ownedCommand } = require("./http-soak.cjs");
  const events = [];
  const p = protocol({
    onKill: () => {
      events.push("kill-group");
    },
  });
  let done = false;
  const work = ownedCommand(
    ["inert"],
    { cwd: "/tmp", env: {}, timeout: 200 },
    p.io,
  ).then((value) => {
    done = true;
    events.push("report-cleanup");
    return value;
  });
  p.child.emit("exit", 0, null);
  p.child.emit("close", 0, null);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(done, false);
  p.setGroup(false);
  events.push("descendants-gone");
  assert.deepEqual(await work, { ok: true, cleanupVerified: true });
  assert.ok(
    events.indexOf("descendants-gone") < events.indexOf("report-cleanup"),
  );
  assert.equal(p.options().detached, true);
  assert.equal(p.options().shell, false);
  assert.deepEqual(p.options().stdio, ["ignore", "pipe", "pipe"]);
});
test("timeout kills only owned group and joins actual close before returning failed outcome", async () => {
  const { ownedCommand } = require("./http-soak.cjs");
  let released = false;
  const p = protocol({
    onKill: (child, absent) => {
      if (released) return;
      released = true;
      setTimeout(() => {
        absent();
        child.emit("exit", null, "SIGKILL");
        child.emit("close", null, "SIGKILL");
      }, 5);
    },
  });
  const result = await ownedCommand(
    ["inert"],
    { cwd: "/tmp", env: {}, timeout: 5 },
    p.io,
  );
  assert.deepEqual(result, { ok: false, cleanupVerified: true });
  assert.ok(p.signals.includes("SIGKILL"));
});
test("close cannot be inferred from group disappearance and join failure preserves report context", async () => {
  const { ownedCommand } = require("./http-soak.cjs");
  const p = protocol({ onKill: (_child, absent) => absent() });
  p.io.joinMs = 12;
  let cleanup = false;
  await assert.rejects(
    ownedCommand(["inert"], { cwd: "/tmp", env: {}, timeout: 3 }, p.io).then(
      () => {
        cleanup = true;
      },
    ),
    /context retained/,
  );
  assert.equal(cleanup, false); // No close event; report access/deletion is forbidden.
});
test("unjoined descendant despite direct close fails without report cleanup or success", async () => {
  const { ownedCommand } = require("./http-soak.cjs");
  const p = protocol();
  p.io.joinMs = 12;
  const work = ownedCommand(
    ["inert"],
    { cwd: "/tmp", env: {}, timeout: 100 },
    p.io,
  );
  p.child.emit("exit", 0, null);
  p.child.emit("close", 0, null);
  await assert.rejects(work, /context retained/);
  assert.ok(p.signals.includes("SIGKILL"));
});
test("overflow output is discarded, fails closed and still joins group and close", async () => {
  const { ownedCommand } = require("./http-soak.cjs");
  let stopped = false;
  const p = protocol({
    onKill: (child, absent) => {
      if (stopped) return;
      stopped = true;
      queueMicrotask(() => {
        absent();
        child.emit("close", 0, null);
      });
    },
  });
  const work = ownedCommand(
    ["inert"],
    { cwd: "/tmp", env: {}, timeout: 100 },
    p.io,
  );
  p.child.stderr.emit("data", Buffer.alloc(1000001, 97));
  assert.deepEqual(await work, { ok: false, cleanupVerified: true });
});
test("spawn failure is safely joined and cannot claim a successful command", async () => {
  const { ownedCommand } = require("./http-soak.cjs");
  const p = protocol({ groupInitially: false });
  p.child.pid = undefined;
  const work = ownedCommand(
    ["inert"],
    { cwd: "/tmp", env: {}, timeout: 100 },
    p.io,
  );
  p.child.emit("error", Error("private-canary"));
  p.child.emit("close", -2, null);
  assert.deepEqual(await work, { ok: false, cleanupVerified: true });
  assert.equal(p.signals.length, 0);
});

test("group disappearing between liveness check and kill is rechecked rather than falsely retained", async () => {
  const { ownedCommand } = require("./http-soak.cjs");
  const { EventEmitter } = require("node:events");
  const child = new EventEmitter();
  child.pid = 62011;
  let alive = true;
  const io = {
    spawn: () => child,
    kill: (pid, why) => {
      assert.equal(pid, -62011);
      if (why === "SIGKILL") alive = false;
      if (!alive) {
        const error = Error("inert");
        error.code = "ESRCH";
        throw error;
      }
    },
    joinMs: 30,
    pollMs: 1,
  };
  const work = ownedCommand(
    ["inert"],
    { cwd: "/tmp", env: {}, timeout: 100 },
    io,
  );
  child.emit("exit", 0, null);
  child.emit("close", 0, null);
  assert.deepEqual(await work, { ok: true, cleanupVerified: true });
});

test("five-minute memory samples are assigned by completion time without retaining raw samples in receipt", () => {
  const samples = [
    { at: 0, rss: 10, heap: 5 },
    { at: 299999, rss: 20, heap: 8 },
    { at: 300000, rss: 30, heap: 9 },
    { at: 1799999, rss: 40, heap: 10 },
    { at: 1800000, rss: 100, heap: 50 },
  ];
  assert.deepEqual(bucket([], 0, samples).resources, {
    samples: 2,
    maxRssBytes: 20,
    maxHeapBytes: 8,
  });
  assert.deepEqual(bucket([], 1, samples).resources, {
    samples: 1,
    maxRssBytes: 30,
    maxHeapBytes: 9,
  });
  assert.deepEqual(bucket([], 5, samples).resources, {
    samples: 1,
    maxRssBytes: 40,
    maxHeapBytes: 10,
  });
  assert.equal(
    JSON.stringify(bucket([], 0, samples)).includes("299999"),
    false,
  );
});
test("version2 refuses silently upgrading historical610 receipts and rejects memory-field smuggling", () => {
  const old = fixture();
  delete old.harnessVersion;
  assert.throws(() => validate(old, env));
  for (const mutate of [
    (v) => (v.buckets[0].resources.url = "private-canary"),
    (v) => (v.buckets[0].resources.samples = 0),
    (v) => (v.buckets[0].resources.samples = 0.5),
    (v) => (v.buckets[0].resources.maxRssBytes = Infinity),
    (v) => (v.buckets[0].resources.maxHeapBytes = NaN),
    (v) => (v.buckets[0].resources.maxRssBytes = 100000001),
    (v) => (v.buckets[0].resources.samples = 361),
  ]) {
    const v = fixture();
    mutate(v);
    assert.throws(() => validate(v, env));
  }
});
test("soak installs plain observers and no-history logger while preserving actual workload and unsafe restore gates", () => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "../tixmoapi2/tests/qualification/orders-http.soak.ts",
    ),
    "utf8",
  );
  assert.match(source, /observeFunction\(redis, name, track\)/);
  assert.match(source, /observeFunction\(module, name, track\)/);
  assert.match(source, /spyOn\(validation, 'validate'\)/);
  assert.doesNotMatch(source, /spyOn\(target, name\)|spyOn\(module, name\)/);
  const logger = source.slice(
    source.indexOf("jest.mock('../../src/config/logger'"),
    source.indexOf("jest.unmock"),
  );
  assert.doesNotMatch(logger, /jest.fn|mock.calls|push\(/);
  assert.match(logger, /http\(\)/);
  assert.match(source, /bucket\(rows, i, samples\)/);
  assert.match(source, /at: performance.now\(\) - start/);
  assert.ok(
    source.indexOf(
      "await bounded(drain())",
      source.indexOf("const cleanup ="),
    ) < source.indexOf("for (const spy of spies.reverse())"),
  );
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "../.github/workflows/http-soak-qualification.yml"),
    "utf8",
  );
  assert.match(
    workflow,
    /node --test scripts\/http-soak.test.cjs scripts\/soak-lifetime.test.cjs/,
  );
  assert.match(workflow, /scripts\/soak-lifetime\*/);
});
