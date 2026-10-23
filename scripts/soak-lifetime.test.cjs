"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { ModuleMocker } = require("../tixmoapi2/node_modules/jest-mock");
const { createClient } = require("../tixmoapi2/node_modules/redis");
const { createLifetime } = require("./verify-auth-ip.cjs");
const { observeFunction } = require("./soak-lifetime.cjs");
const gate = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
test("installed Jest spy retains request arguments and return histories while plain observer has no such history", async () => {
  const mocker = new ModuleMocker(globalThis),
    old = { run: () => Promise.resolve() };
  const spy = mocker.spyOn(old, "run");
  const request = { body: { synthetic: true } },
    response = { socket: { synthetic: true } };
  await old.run(request, response);
  assert.equal(spy.mock.calls[0][0], request);
  assert.equal(spy.mock.calls[0][1], response);
  assert.equal(spy.mock.results[0].type, "return");
  spy.mockRestore();
  const life = createLifetime(),
    target = { run: () => Promise.resolve() };
  const restore = observeFunction(target, "run", life.track);
  for (let i = 0; i < 10000; i++)
    target.run({ body: { synthetic: i } }, { socket: { synthetic: i } });
  await life.drain();
  assert.equal(target.run.mock, undefined);
  assert.deepEqual(Object.keys(target.run), []);
  life.check();
  restore.mockRestore();
});
test("function observer preserves receiver, arguments, exact sync and Promise returns and throws", async () => {
  const life = createLifetime(),
    promise = Promise.resolve("synthetic"),
    first = {},
    second = {},
    receiver = {};
  let mode = "sync",
    calls = 0;
  const failure = Error("synthetic");
  const target = {
    run: function (a, b) {
      assert.equal(this, receiver);
      assert.equal(a, first);
      assert.equal(b, second);
      calls++;
      if (mode === "throw") throw failure;
      return mode === "promise"
        ? promise
        : mode === "undefined"
          ? undefined
          : 42;
    },
  };
  const original = target.run,
    descriptor = Object.getOwnPropertyDescriptor(target, "run");
  const restore = observeFunction(target, "run", life.track);
  assert.equal(target.run.call(receiver, first, second), 42);
  mode = "undefined";
  assert.equal(target.run.call(receiver, first, second), undefined);
  mode = "promise";
  assert.equal(target.run.call(receiver, first, second), promise);
  mode = "throw";
  assert.throws(
    () => target.run.call(receiver, first, second),
    (error) => error === failure,
  );
  await life.drain();
  assert.equal(calls, 4);
  restore.mockRestore();
  assert.equal(target.run, original);
  assert.deepEqual(Object.getOwnPropertyDescriptor(target, "run"), descriptor);
});
test("aborted-client observation waits for real delayed middleware then validation then SQL", async () => {
  const life = createLifetime(),
    middleware = gate(),
    validation = gate(),
    sql = gate();
  const events = [];
  let cleaned = false;
  const target = {
    auth: async function (_req, _res, next) {
      await middleware.promise;
      events.push("middleware");
      next();
    },
  };
  const factory = {
    validate: () =>
      async function (_req, _res, next) {
        await validation.promise;
        events.push("validation");
        next();
      },
  };
  const restore = observeFunction(target, "auth", life.track);
  const validationTarget = { run: factory.validate() };
  const restoreValidation = observeFunction(
    validationTarget,
    "run",
    life.track,
  );
  const validate = validationTarget.run;
  target.auth({}, {}, () =>
    validate({}, {}, () => {
      life.track(
        sql.promise.then(() => {
          assert.equal(cleaned, false);
          events.push("sql");
        }),
      );
    }),
  );
  events.push("aborted-client");
  const cleanup = life.drain().then(() => {
    life.check();
    cleaned = true;
    events.push("cleanup");
  });
  await Promise.resolve();
  assert.equal(cleaned, false);
  middleware.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cleaned, false);
  validation.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cleaned, false);
  sql.resolve();
  await cleanup;
  assert.deepEqual(events, [
    "aborted-client",
    "middleware",
    "validation",
    "sql",
    "cleanup",
  ]);
  restoreValidation.mockRestore();
  restore.mockRestore();
});
test("rejection identity and permanent unsafe fence survive late completion without restoring early", async () => {
  const life = createLifetime(),
    delayed = gate(),
    error = Error("synthetic"),
    target = { run: () => delayed.promise };
  const original = target.run;
  const restore = observeFunction(target, "run", life.track);
  const result = target.run({ synthetic: true });
  assert.equal(result, delayed.promise);
  await assert.rejects(life.bounded(life.drain(), 5));
  assert.equal(life.isUnsafe(), true);
  assert.throws(life.check);
  delayed.reject(error);
  await assert.rejects(result, (value) => value === error);
  await life.drain();
  assert.throws(life.check);
  assert.notEqual(target.run, original);
  // Test disposes only its inert object; production fixture restore remains guarded by check().
  restore.mockRestore();
});
test("real installed Redis inherited methods are shadowed only on owned disconnected client and restored", async () => {
  const life = createLifetime(),
    client = createClient({
      url: "redis://127.0.0.1:1/9",
      socket: { reconnectStrategy: false },
    });
  for (const name of ["zRem", "eval", "sendCommand"]) {
    assert.equal(Object.hasOwn(client, name), false);
    const original = client[name];
    const restore = observeFunction(client, name, life.track);
    assert.equal(Object.hasOwn(client, name), true);
    assert.equal(client[name].mock, undefined);
    if (name === "sendCommand") {
      const result = client.sendCommand(["PING"]);
      await assert.rejects(result);
      await life.drain();
    }
    restore.mockRestore();
    assert.equal(Object.hasOwn(client, name), false);
    assert.equal(client[name], original);
  }
  assert.equal(client.isOpen, false); // Never connects, sends TCP or starts a service.
});
test("restore rejects foreign replacement and getters are never invoked during admission", () => {
  const life = createLifetime(),
    target = { run: () => 0 };
  const restore = observeFunction(target, "run", life.track);
  target.run = () => 1;
  assert.throws(() => restore.mockRestore());
  let gets = 0;
  const accessor = {};
  Object.defineProperty(accessor, "run", {
    get() {
      gets++;
      return () => 0;
    },
    configurable: true,
  });
  assert.throws(() => observeFunction(accessor, "run", life.track));
  assert.equal(gets, 0);
});
