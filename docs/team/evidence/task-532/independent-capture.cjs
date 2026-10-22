'use strict';
// Independent inert QA: execute only exact capture expressions against fake objects.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const candidate = '09dfb648a87eb4f006555f88a93147bf5c34d523';
const base = 'd4fd52c1637c24d9f1bb003685029e915745bf6e';
const file = 'tixmoapi2/tests/qualification/orders-http-last-ten.local.ts';
const helper = 'tixmoapi2/tests/qualification/task499/ownership.cjs';
const read = (sha, name) => execFileSync('git', ['show', `${sha}:${name}`], { encoding: 'utf8' });
const before = read(base, file), after = read(candidate, file);
let normalized = after;
for (const [object, key, local] of [['auth','authenticate','realAuthenticate'], ['auth','optionalAuthenticate','realOptionalAuthenticate'], ['waitingRoom','waitingRoom','realWaitingRoom']]) {
  const old = `    spies.push(jest.spyOn(${object}, '${key}').mockImplementation(promiseMiddleware(${object}.${key}, work)));`;
  const fixed = `    const ${local} = ${object}.${key};\n    spies.push(jest.spyOn(${object}, '${key}').mockImplementation(promiseMiddleware(${local}, work)));`;
  assert.equal(before.split(old).length, 2);
  assert.equal(after.split(fixed).length, 2);
  normalized = normalized.replace(fixed, old);
  for (const [label, expression] of [['negative', old], ['positive', fixed]]) {
    let originalCalls = 0, spyCalls = 0, captured;
    const receiver = {}, argument = {}, result = {};
    const original = function (arg) { originalCalls++; assert.equal(this, receiver); assert.equal(arg, argument); return result; };
    const target = { [key]: original };
    const spies = [];
    const context = {
      [object]: target, spies, work: {},
      jest: { spyOn(obj, name) {
        let impl = obj[name];
        function spy(...args) {
          if (++spyCalls > 1) throw new Error('INERT_REENTRY');
          return impl.apply(this, args);
        }
        obj[name] = spy;
        spy.mockImplementation = replacement => { impl = replacement; return spy; };
        return spy;
      } },
      promiseMiddleware(fn) { captured = fn; return function (...args) { return fn.apply(this, args); }; },
    };
    vm.runInNewContext(expression, context, { timeout: 100 });
    assert.equal(spies.length, 1);
    assert.equal(originalCalls, 0, 'capture must not invoke original');
    if (label === 'negative') {
      assert.equal(captured, target[key]);
      assert.throws(() => target[key].call(receiver, argument), /INERT_REENTRY/);
      assert.equal(originalCalls, 0);
    } else {
      assert.equal(captured, original);
      assert.notEqual(captured, target[key]);
      assert.equal(target[key].call(receiver, argument), result);
      assert.equal(originalCalls, 1);
      assert.equal(spyCalls, 1);
    }
    console.log(`PASS ${key} exact-source ${label}`);
  }
}
assert.equal(normalized, before, 'only three capture repairs; every other source byte unchanged');
assert.equal(read(base, helper), read(candidate, helper), 'helper bytes unchanged');
assert.equal((after.match(/\bexpect\(/g) || []).length, 23, '23 unchanged acceptance assertion calls');
assert.equal(fs.readFileSync(file, 'utf8'), after, 'isolated checkout matches candidate source');
console.log('PASS all other source bytes/helper unchanged; 23 acceptance assertions preserved');
