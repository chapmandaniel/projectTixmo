'use strict';
// Inert source/fake-JS checks only. Never loads app, Jest or ownership helper.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const file = 'tixmoapi2/tests/qualification/orders-http-last-ten.local.ts';
const helper = 'tixmoapi2/tests/qualification/task499/ownership.cjs';
const base = 'd4fd52c1637c24d9f1bb003685029e915745bf6e';
const previous = name => execFileSync('git', ['show', `${base}:${name}`], { cwd: root, encoding: 'utf8' });
let normalized = fs.readFileSync(path.join(root, file), 'utf8');
for (const [module, key, saved] of [
  ['auth', 'authenticate', 'realAuthenticate'],
  ['auth', 'optionalAuthenticate', 'realOptionalAuthenticate'],
  ['waitingRoom', 'waitingRoom', 'realWaitingRoom'],
]) {
  const old = `    spies.push(jest.spyOn(${module}, '${key}').mockImplementation(promiseMiddleware(${module}.${key}, work)));`;
  const fixed = `    const ${saved} = ${module}.${key};\n    spies.push(jest.spyOn(${module}, '${key}').mockImplementation(promiseMiddleware(${saved}, work)));`;
  assert.equal(normalized.split(fixed).length - 1, 1, `${key}: actual pre-capture immediately before spy`);
  normalized = normalized.replace(fixed, old);
  // Minimal JS spy semantics, NOT Jest or the real ownership adapter.
  // Guard reentry synchronously, without allowing recursion to consume stack.
  function fixture() {
    let calls = 0;
    const receiver = { marker: key };
    function original(arg) { calls++; assert.equal(this, receiver); return arg; }
    const target = { [key]: original };
    const spyOn = (object, name) => {
      let implementation = object[name], entered = false;
      function spy(...args) {
        if (entered) throw new Error('recursive spy reentry');
        entered = true;
        try { return implementation.apply(this, args); } finally { entered = false; }
      }
      object[name] = spy;
      spy.mockImplementation = fn => { implementation = fn; return spy; };
      return spy;
    };
    const adapt = captured => function (...args) { return captured.apply(this, args); };
    return { target, receiver, original, spyOn, adapt, calls: () => calls };
  }
  const unsafe = fixture();
  unsafe.spyOn(unsafe.target, key).mockImplementation(unsafe.adapt(unsafe.target[key]));
  assert.throws(() => unsafe.target[key].call(unsafe.receiver, 7), /recursive spy reentry/);
  assert.equal(unsafe.calls(), 0, 'negative control never reaches original');
  const safe = fixture();
  const captured = safe.target[key];
  safe.spyOn(safe.target, key).mockImplementation(safe.adapt(captured));
  assert.equal(safe.target[key].call(safe.receiver, 7), 7);
  assert.equal(safe.calls(), 1, 'pre-capture reaches original once with receiver/argument');
  console.log(`PASS ${key}: source capture + unsafe reentry + saved-original control`);
}
// Exact normalization proves every other source byte (including all assertions,
// checked bindings and ownership/teardown statements) remains unchanged.
assert.equal(normalized, previous(file));
assert.equal(fs.readFileSync(path.join(root, helper), 'utf8'), previous(helper));
console.log('PASS exact source normalization and unchanged helper bytes');
