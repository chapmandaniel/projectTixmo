"use strict";
// Runs only inside the existing production image against guarded job-owned services.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const {
  guard,
  SCOPE,
  createLifetime,
  observeMiddleware,
  observeValidation,
} = require("/task611-driver.cjs");
const { track, bounded, drain, check, isUnsafe } = createLifetime();
let server, prisma, redisModule, redis;
let providerAttempts = 0,
  writes = 0,
  dotenvCalls = 0;
const keys = ["rl:auth:198.18.61.1", "rl:auth:198.18.61.2"];
let namespaceOwned = false;
let phase = "guard",
  failedPhase;
const counts = {
  sharedAdmitted401: 0,
  sharedRejected429: 0,
  separateAdmitted401: 0,
};
async function body() {
  guard(process.env);
  assert.equal(process.env.NODE_ENV, "production");
  assert.equal(process.env.REDIS_DB, "8");
  // Production config reads actual supplied env; fixture disables dotenv I/O only.
  require("/app/node_modules/dotenv").config = () => {
    dotenvCalls++;
    return { parsed: {} };
  };
  const localFetch = global.fetch;
  const forbidden = () => {
    providerAttempts++;
    throw Error("Transport refused");
  };
  global.fetch = forbidden;
  for (const name of ["node:http", "node:https"]) {
    const module = require(name);
    module.request = forbidden;
    module.get = forbidden;
  }
  const { config } = require("/app/dist/config/environment");
  assert.equal(config.nodeEnv, "production");
  phase = "connect";
  prisma = require("/app/dist/config/prisma").default;
  prisma.$use(async (params, next) => {
    if (/^(?:create|update|upsert|delete)/i.test(params.action)) {
      writes++;
      throw Error("No fixture writes");
    }
    return next(params);
  });
  await bounded(track(prisma.$connect()));
  const before = await bounded(track(prisma.user.count()));
  redisModule = require("/app/dist/config/redis");
  redis = await bounded(track(redisModule.connectRedis()));
  assert.equal(await bounded(track(redis.dbSize())), 0);
  namespaceOwned = true;
  const send = redis.sendCommand.bind(redis);
  redis.sendCommand = (...args) => track(send(...args));
  // Observe actual controller promises before app imports/captures the exports.
  const asyncModule = require("/app/dist/utils/catchAsync");
  const original = asyncModule.catchAsync;
  asyncModule.catchAsync = (fn) =>
    original((...args) => track(Promise.resolve(fn(...args))));
  // Capture ALL async pre-controller continuations before app/router import.
  observeMiddleware(
    require("/app/dist/middleware/auth"),
    ["authenticate", "optionalAuthenticate"],
    track,
  );
  observeMiddleware(
    require("/app/dist/middleware/rateLimiter"),
    ["authRateLimiter", "apiReadRateLimiter", "apiWriteRateLimiter"],
    track,
  );
  observeValidation(require("/app/dist/middleware/validate"), track);
  phase = "mounted";
  const app = require("/app/dist/app").default;
  server = await bounded(
    track(
      new Promise((resolve, reject) => {
        const active = app.listen(0, "127.0.0.1", () => resolve(active));
        active.once("error", reject);
      }),
    ),
  );
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/v1/auth/login";
  const nonce = randomUUID();
  const emails = Array.from(
    { length: 22 },
    (_, i) => `task611-${nonce}-${i}@example.test`,
  );
  assert.equal(
    await bounded(
      track(prisma.user.count({ where: { email: { in: emails } } })),
    ),
    0,
  );
  const start = performance.now();
  for (let i = 0; i < 22; i++) {
    phase = i === 21 ? "separate" : "shared";
    check();
    const response = await bounded(
      track(
        localFetch(url, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(5000),
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": i === 21 ? "198.18.61.2" : "198.18.61.1",
          },
          body: JSON.stringify({
            email: emails[i],
            password: "Synthetic611Password!",
          }),
        }),
      ),
    );
    assert.equal(response.headers.get("ratelimit-limit"), "20");
    const data = await bounded(track(response.json()));
    assert.equal(data.success, false);
    assert.equal(data.data?.accessToken, undefined);
    if (i < 20) {
      assert.equal(response.status, 401);
      counts.sharedAdmitted401++;
    } else if (i === 20) {
      assert.equal(response.status, 429);
      counts.sharedRejected429++;
    } else {
      assert.equal(response.status, 401);
      counts.separateAdmitted401++;
    }
  }
  phase = "assertions";
  assert.ok(performance.now() - start < 45000); // Keep all attempts inside one actual60s window.
  await bounded(drain());
  assert.equal(await bounded(track(prisma.user.count())), before);
  assert.equal(writes, 0);
  assert.equal(providerAttempts, 0);
  assert.equal(dotenvCalls, 1);
  assert.deepEqual(
    (await bounded(track(redis.keys("rl:auth:*")))).sort(),
    keys,
  );
  assert.deepEqual(await bounded(track(redis.mGet(keys))), ["21", "1"]);
}
async function main() {
  const watchdog = setTimeout(() => process.exit(1), 75000);
  let ok = false,
    cleanupVerified = false,
    lifetimeCleanupVerified = false;
  try {
    await body();
    ok = true;
  } catch {
    failedPhase = phase;
    /* No error/body/token/config values enter receipts. */
  }
  phase = "cleanup";
  try {
    await bounded(drain());
    if (server)
      await bounded(
        track(
          new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
        ),
      );
    await bounded(drain());
    check();
    if (namespaceOwned) {
      // Exact two syntheticIP keys only, never FLUSHDB/SCAN-wide removal.
      await bounded(track(redis.del(keys)));
      check();
      assert.equal(await bounded(track(redis.exists(keys))), 0);
      cleanupVerified = true;
    }
    check();
    if (redisModule) await bounded(track(redisModule.disconnectRedis()));
    check();
    if (prisma) await bounded(track(prisma.$disconnect()));
    check();
    lifetimeCleanupVerified = true;
  } catch {
    ok = false;
  }
  clearTimeout(watchdog);
  const result = {
    scope: SCOPE,
    phase: failedPhase || phase,
    sourceSha: process.env.TIXMO_AUTH_IP_SOURCE_SHA,
    runId: process.env.TIXMO_AUTH_IP_RUN_ID,
    ok: ok && !isUnsafe(),
    ...counts,
    authLimit: 20,
    windowSeconds: 60,
    providerAttempts,
    noDatabaseWrites: writes === 0,
    dotenvReadDisabled: dotenvCalls === 1,
    cleanupVerified,
    lifetimeCleanupVerified,
  };
  process.stdout.write(JSON.stringify(result) + "\n", () =>
    process.exit(result.ok ? 0 : 1),
  );
}
if (require.main === module) void main();
