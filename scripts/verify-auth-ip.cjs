"use strict";
// Hosted configured-image measurement only. No inherited target credentials.
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  guard: imageGuard,
  PG_IMAGE,
  REDIS_IMAGE,
} = require("./verify-image-restore.cjs");
const SCOPE = "task611-production-auth-shared-ip";
function guard(env) {
  assert.equal(env.TIXMO_AUTH_IP, "synthetic-only");
  const db = imageGuard({ ...env, TIXMO_IMAGE_RESTORE: "synthetic-only" });
  const redis = new URL(env.REDIS_URL);
  assert.equal(redis.protocol, "redis:");
  assert.equal(redis.hostname, "127.0.0.1");
  assert.ok(Number(redis.port) > 1024 && Number(redis.port) <= 65535);
  assert.equal(redis.username + redis.password + redis.search + redis.hash, "");
  assert.equal(redis.pathname, "/8");
  assert.match(env.TIXMO_AUTH_IP_SOURCE_SHA || "", /^[a-f0-9]{40}$/);
  assert.match(env.TIXMO_AUTH_IP_RUN_ID || "", /^[0-9]{1,20}-[0-9]{1,8}$/);
  return db;
}
function childEnv(env) {
  guard(env);
  return {
    NODE_ENV: "production",
    GITHUB_ACTIONS: "true",
    TIXMO_AUTH_IP: "synthetic-only",
    PG_CONTAINER: env.PG_CONTAINER,
    REDIS_CONTAINER: env.REDIS_CONTAINER,
    DATABASE_URL: env.DATABASE_URL,
    REDIS_URL: env.REDIS_URL,
    REDIS_DB: "8",
    JWT_SECRET: "synthetic-task611-access",
    JWT_REFRESH_SECRET: "synthetic-task611-refresh",
    SESSION_SECRET: "synthetic-task611-session",
    PAYMENT_CURRENCY: "cad",
    TIXMO_AUTH_IP_SOURCE_SHA: env.TIXMO_AUTH_IP_SOURCE_SHA,
    TIXMO_AUTH_IP_RUN_ID: env.TIXMO_AUTH_IP_RUN_ID,
  };
}
// Shared with offline abort/continuation tests; a timeout permanently forbids cleanup.
function createLifetime() {
  const pending = new Set();
  let unsafe = false;
  const track = (promise) => {
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      () => pending.delete(promise),
    );
    return promise;
  };
  const check = () => {
    if (unsafe) throw Error("Unjoined work");
  };
  const drain = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };
  const bounded = async (promise, ms = 10000) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            unsafe = true;
            reject(Error("Deadline"));
          }, ms);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  return { track, check, drain, bounded, isUnsafe: () => unsafe };
}
function observeMiddleware(module, names, track) {
  for (const name of names) {
    const original = module[name];
    assert.equal(typeof original, "function");
    module[name] = function (...args) {
      return track(Promise.resolve(Reflect.apply(original, this, args)));
    };
  }
}
function observeValidation(module, track) {
  const original = module.validate;
  module.validate = function (...args) {
    const handler = Reflect.apply(original, this, args);
    return function (...requestArgs) {
      return track(Promise.resolve(Reflect.apply(handler, this, requestArgs)));
    };
  };
}
async function command(args, timeout = 30000, allowWorkerFailure = false) {
  const child = spawn("docker", args, {
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let output = "",
    bytes = 0,
    failed = false;
  const kill = () => {
    failed = true;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  };
  const timer = setTimeout(kill, timeout);
  child.stdout.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > 1048576) kill();
    else output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > 1048576) kill();
  });
  try {
    const result = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    if (failed || (result.code !== 0 && !allowWorkerFailure) || result.signal)
      throw Error("Owned command failed");
    return output.trim();
  } finally {
    clearTimeout(timer);
  }
}
function project(output, env, emit = () => {}) {
  guard(env);
  const records = output.split("\n").flatMap((line) => {
    try {
      const row = JSON.parse(line);
      return row.scope === SCOPE ? [row] : [];
    } catch {
      return [];
    }
  });
  assert.equal(records.length, 1);
  const row = records[0];
  const phases = [
    "guard",
    "connect",
    "mounted",
    "shared",
    "separate",
    "assertions",
    "cleanup",
  ];
  const fixed = {
    scope: SCOPE + "-stage",
    sourceSha: env.TIXMO_AUTH_IP_SOURCE_SHA,
    runId: env.TIXMO_AUTH_IP_RUN_ID,
    phase: phases.includes(row.phase) ? row.phase : "unclassified",
  };
  for (const key of [
    "sharedAdmitted401",
    "sharedRejected429",
    "separateAdmitted401",
    "providerAttempts",
  ])
    fixed[key] =
      Number.isSafeInteger(row[key]) && row[key] >= 0 && row[key] <= 22
        ? row[key]
        : null;
  for (const key of [
    "ok",
    "noDatabaseWrites",
    "dotenvReadDisabled",
    "cleanupVerified",
    "lifetimeCleanupVerified",
  ])
    fixed[key] = row[key] === true;
  fixed.sourceMatches =
    row.sourceSha === env.TIXMO_AUTH_IP_SOURCE_SHA &&
    row.runId === env.TIXMO_AUTH_IP_RUN_ID;
  emit(fixed); // Safe failure evidence precedes any success assertions.
  assert.equal(row.sourceSha, env.TIXMO_AUTH_IP_SOURCE_SHA);
  assert.equal(row.runId, env.TIXMO_AUTH_IP_RUN_ID);
  for (const key of [
    "ok",
    "cleanupVerified",
    "lifetimeCleanupVerified",
    "noDatabaseWrites",
    "dotenvReadDisabled",
  ])
    assert.equal(row[key], true);
  for (const [key, value] of Object.entries({
    sharedAdmitted401: 20,
    sharedRejected429: 1,
    separateAdmitted401: 1,
    providerAttempts: 0,
    authLimit: 20,
    windowSeconds: 60,
  }))
    assert.equal(row[key], value);
  return {
    scope: SCOPE,
    sourceSha: row.sourceSha,
    runId: row.runId,
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
    deployedTrafficQualified: false,
  };
}
async function verify(env = process.env, dependencies = {}) {
  const db = guard(env),
    run = dependencies.command || command;
  let owned;
  try {
    for (const [id, image, port, expectedPort] of [
      [env.PG_CONTAINER, PG_IMAGE, "5432/tcp", db.port],
      [
        env.REDIS_CONTAINER,
        REDIS_IMAGE,
        "6379/tcp",
        new URL(env.REDIS_URL).port,
      ],
    ]) {
      const [row] = JSON.parse(await run(["inspect", id]));
      assert.equal(row.Id, id);
      assert.equal(row.Config.Image, image);
      assert.equal(row.State.Running, true);
      assert.equal(row.State.Health.Status, "healthy");
      assert.deepEqual(row.NetworkSettings.Ports[port], [
        { HostIp: "127.0.0.1", HostPort: expectedPort },
      ]);
    }
    const args = [
      "create",
      "--network",
      "host",
      "--mount",
      `type=bind,src=${path.join(__dirname, "auth-ip-worker.cjs")},dst=/task611-worker.cjs,readonly`,
      "--mount",
      `type=bind,src=${__filename},dst=/task611-driver.cjs,readonly`,
      "--mount",
      `type=bind,src=${path.join(__dirname, "verify-image-restore.cjs")},dst=/verify-image-restore.cjs,readonly`,
      ...Object.entries(childEnv(env)).flatMap(([key, value]) => [
        "--env",
        key + "=" + value,
      ]),
      "--entrypoint",
      "node",
      "tixmo-task603-production:ci",
      "/task611-worker.cjs",
    ];
    owned = await run(args);
    assert.match(owned, /^[a-f0-9]{64}$/);
    const receipt = project(
      await run(["start", "--attach", owned], 90000, true),
      env,
      (value) => {
        if (!dependencies.silent) console.log(JSON.stringify(value));
      },
    );
    await run(["rm", owned]);
    assert.equal(
      await run(["ps", "-aq", "--no-trunc", "--filter", "id=" + owned]),
      "",
    );
    owned = undefined;
    if (!dependencies.silent) console.log(JSON.stringify(receipt));
    return receipt;
  } finally {
    if (owned && /^[a-f0-9]{64}$/.test(owned))
      await run(["rm", "--force", owned]);
  }
}
if (require.main === module)
  void verify().catch(() => {
    console.error(
      "Synthetic shared-IP qualification failed; child details suppressed.",
    );
    process.exitCode = 1;
  });
module.exports = {
  guard,
  childEnv,
  project,
  verify,
  SCOPE,
  createLifetime,
  observeMiddleware,
  observeValidation,
};
