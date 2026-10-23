// Pure protocol checks; no Docker, application, TCP, Redis or SQL execution.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  guard,
  childEnv,
  project,
  verify,
  SCOPE,
} = require("./verify-auth-ip.cjs");
const env = {
  GITHUB_ACTIONS: "true",
  TIXMO_AUTH_IP: "synthetic-only",
  PG_CONTAINER: "a".repeat(64),
  REDIS_CONTAINER: "b".repeat(64),
  DATABASE_URL:
    "postgresql://tixmo_restore_ci:synthetic_restore_password@127.0.0.1:49152/tixmo_disposable_restore_source?schema=public",
  REDIS_URL: "redis://127.0.0.1:49153/8",
  TIXMO_AUTH_IP_SOURCE_SHA: "c".repeat(40),
  TIXMO_AUTH_IP_RUN_ID: "123-1",
};
const receipt = () => ({
  scope: SCOPE,
  sourceSha: env.TIXMO_AUTH_IP_SOURCE_SHA,
  runId: env.TIXMO_AUTH_IP_RUN_ID,
  ok: true,
  sharedAdmitted401: 20,
  sharedRejected429: 1,
  separateAdmitted401: 1,
  authLimit: 20,
  windowSeconds: 60,
  providerAttempts: 0,
  noDatabaseWrites: true,
  dotenvReadDisabled: true,
  cleanupVerified: true,
  lifetimeCleanupVerified: true,
});
test("fixed synthetic identity and production child environment, no inheritedcredentials", () => {
  assert.doesNotThrow(() => guard(env));
  const child = childEnv({
    ...env,
    STRIPE_SECRET_KEY: "private-canary",
    POSTMARK_SERVER_TOKEN: "private-canary",
    RATE_LIMIT_MAX: "1",
  });
  assert.equal(child.NODE_ENV, "production");
  assert.equal(child.REDIS_DB, "8");
  assert.doesNotMatch(
    JSON.stringify(child),
    /private-canary|STRIPE|POSTMARK|RATE_LIMIT/,
  );
});
for (const [name, patch] of [
  ["opt-in", { TIXMO_AUTH_IP: "true" }],
  ["CI", { GITHUB_ACTIONS: "false" }],
  [
    "remoteDB",
    { DATABASE_URL: env.DATABASE_URL.replace("127.0.0.1", "foreign.invalid") },
  ],
  [
    "wrongDB",
    {
      DATABASE_URL: env.DATABASE_URL.replace(
        "tixmo_disposable_restore_source",
        "railway",
      ),
    },
  ],
  ["wrongRedisDB", { REDIS_URL: env.REDIS_URL.replace("/8", "/0") }],
  [
    "remoteRedis",
    { REDIS_URL: env.REDIS_URL.replace("127.0.0.1", "foreign.invalid") },
  ],
  [
    "RedisCredentials",
    {
      REDIS_URL: env.REDIS_URL.replace("redis://", "redis://foreign:foreign@"),
    },
  ],
  ["sameContainers", { REDIS_CONTAINER: env.PG_CONTAINER }],
  ["source", { TIXMO_AUTH_IP_SOURCE_SHA: "private-canary" }],
  ["run", { TIXMO_AUTH_IP_RUN_ID: "private-canary" }],
])
  test("reject " + name + " before any subprocess", async () => {
    let called = false;
    await assert.rejects(
      verify(
        { ...env, ...patch },
        {
          command: async () => {
            called = true;
          },
        },
      ),
    );
    assert.equal(called, false);
  });
test("projection binds current source/run and strips unknown worker fields", () => {
  const value = project(
    "private-canary\n" +
      JSON.stringify({
        ...receipt(),
        error: "private-canary",
        token: "private-canary",
      }),
    env,
  );
  assert.equal(value.deployedTrafficQualified, false);
  assert.doesNotMatch(JSON.stringify(value), /private-canary|token|error/);
  for (const patch of [
    { sourceSha: "d".repeat(40) },
    { runId: "123-2" },
    { sharedAdmitted401: 19 },
    { sharedRejected429: 0 },
    { separateAdmitted401: 0 },
    { authLimit: 100 },
    { providerAttempts: 1 },
    { noDatabaseWrites: false },
    { cleanupVerified: false },
    { lifetimeCleanupVerified: false },
    { dotenvReadDisabled: false },
    { ok: false },
  ])
    assert.throws(() =>
      project(JSON.stringify({ ...receipt(), ...patch }), env),
    );
  assert.throws(() =>
    project(JSON.stringify(receipt()) + "\n" + JSON.stringify(receipt()), env),
  );
});
test("owned container joins then removes; failed receipt never passes and forces owned cleanup", async () => {
  for (const fail of [false, true]) {
    const calls = [];
    const command = async (args, timeout, allowWorkerFailure) => {
      assert.equal(allowWorkerFailure === true, args[0] === "start");
      calls.push(args);
      if (args[0] === "inspect") {
        const pg = args[1] === env.PG_CONTAINER;
        return JSON.stringify([
          {
            Id: args[1],
            Config: {
              Image: pg
                ? "ghcr.io/railwayapp-templates/postgres-ssl:18"
                : "redis:8.2.9",
            },
            State: { Running: true, Health: { Status: "healthy" } },
            NetworkSettings: {
              Ports: {
                [pg ? "5432/tcp" : "6379/tcp"]: [
                  { HostIp: "127.0.0.1", HostPort: pg ? "49152" : "49153" },
                ],
              },
            },
          },
        ]);
      }
      if (args[0] === "create") {
        assert.ok(args.includes("NODE_ENV=production"));
        assert.ok(
          args.some((value) =>
            value.endsWith("dst=/verify-image-restore.cjs,readonly"),
          ),
        );
        assert.ok(args.includes("tixmo-task603-production:ci"));
        return "e".repeat(64);
      }
      if (args[0] === "start")
        return JSON.stringify({ ...receipt(), ok: !fail });
      if (args[0] === "ps") return "";
      assert.equal(args[0], "rm");
      return "";
    };
    const work = verify(env, { command, silent: true });
    if (fail) {
      await assert.rejects(work);
      assert.ok(calls.at(-1).includes("--force"));
    } else {
      assert.equal((await work).ok, true);
      assert.equal(calls.at(-1)[0], "ps");
    }
    assert.ok(
      calls.findIndex((args) => args[0] === "start") <
        calls.findIndex((args) => args[0] === "rm"),
    );
  }
});
test("actual worker and workflow retain production limit/no writes/no transport/join constraints", () => {
  const worker = fs.readFileSync(
    path.join(__dirname, "auth-ip-worker.cjs"),
    "utf8",
  );
  assert.match(worker, /require\(["']\/app\/dist\/app["']\)/);
  assert.match(worker, /dotenv["']\)\.config =/);
  assert.match(worker, /counts.sharedAdmitted401\+\+/);
  assert.match(worker, /redis.mGet\(keys\)/);
  assert.match(worker, /redis.del\(keys\)/);
  assert.doesNotMatch(
    worker,
    /flushDb|flushAll|replaceProperty|RATE_LIMIT_MAX|dist\/index|startPaymentRecovery/,
  );
  const workflow = fs.readFileSync(
    path.join(__dirname, "../.github/workflows/market-readiness-local.yml"),
    "utf8",
  );
  assert.match(workflow, /run: node scripts\/verify-auth-ip.cjs/);
  assert.match(workflow, /TIXMO_AUTH_IP: synthetic-only/);
  assert.match(workflow, /scripts\/auth-ip.test.cjs/);
});

test("failed worker emits only bounded fixed phase projection before rejection", () => {
  const seen = [];
  assert.throws(() =>
    project(
      JSON.stringify({
        ...receipt(),
        ok: false,
        phase: "shared",
        sharedAdmitted401: 7,
        token: "private-canary",
      }),
      env,
      (value) => seen.push(value),
    ),
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0].phase, "shared");
  assert.equal(seen[0].sharedAdmitted401, 7);
  assert.equal(seen[0].ok, false);
  assert.equal(seen[0].sourceMatches, true);
  assert.doesNotMatch(JSON.stringify(seen), /private-canary|token/);
  const malformed = [];
  assert.throws(() =>
    project(
      JSON.stringify({
        ...receipt(),
        ok: false,
        phase: "private-canary",
        providerAttempts: "private-canary",
      }),
      env,
      (value) => malformed.push(value),
    ),
  );
  assert.equal(malformed[0].phase, "unclassified");
  assert.equal(malformed[0].providerAttempts, null);
  assert.doesNotMatch(JSON.stringify(malformed), /private-canary/);
});
