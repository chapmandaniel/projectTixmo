// Inert module parse + extracted helper probe only. No app imports or Jest.
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const file = 'tixmoapi2/tests/integration/event-sales-pause.sql.test.ts';
const source = fs.readFileSync(path.join(root, file), 'utf8');
const javascript = stripTypeScriptTypes(source, { mode: 'strip' });
new vm.SourceTextModule(javascript, { identifier: file }); // deliberately never link/evaluate
const required = [
  "['PUBLISHED', 'ON_SALE']", "['lifecycle', 'window', 'stock']",
  "['pause', 'create']", 'pg_blocking_pids(pid)', "code: 'P2003'",
  "code: 'SALES_PAUSE_REQUEST_CONFLICT'", 'replayed: true',
  'noop.changed', 'stale.event.salesPaused', 'Promise.allSettled(requests)',
  'fixtures.push(ids)', 'live.add(work)', 'beforeEach(() => { if (failClosed)',
  'await bounded(Promise.allSettled([...live]))',
  'finally { spy.mockRestore(); }', 'eventSalesControl.deleteMany',
  'if (failClosed) throw failClosed;',
];
for (const fragment of required) {
  if (!source.includes(fragment)) throw new Error('Missing source contract: ' + fragment);
}
console.log('PASS: TypeScript stripped and parsed without evaluation; ' + required.length + ' static coverage markers (NOT SQL/runtime proof)');

// Inert regression: evaluate ONLY extracted helpers/hooks with fake Prisma and
// hook registrars. Never link/evaluate the test module or import application code.
const assert = require('node:assert/strict');
const helperSource = javascript.slice(javascript.indexOf('function gate()'), javascript.indexOf('async function fixture('));
assert.match(helperSource, /async function observe\s*\(/);
assert.ok(source.includes('await observe((async () => {\n      const deadline'));
const hooks = {};
const timers = [];
let cleanupCalls = 0, disconnectCalls = 0, restoreCalls = 0;
const context = {
  Promise, Set, Error, JSON,
  console: { error() {} },
  setTimeout(callback) { timers.push(callback); return timers.length; },
  clearTimeout() {},
  beforeEach(fn) { hooks.before = fn; },
  afterEach(fn) { hooks.after = fn; },
  afterAll(fn) { hooks.all = fn; },
  prisma: {
    $transaction() { cleanupCalls++; return Promise.resolve(); },
    $disconnect() { disconnectCalls++; return Promise.resolve(); },
  },
};
vm.runInNewContext(helperSource + '\nthis.probe = { observe, owned, live, restorers };', context);
(async () => {
  let resolveObserver, observerSettled = false;
  const observer = new Promise(resolve => { resolveObserver = resolve; });
  void observer.then(() => { observerSettled = true; });
  context.probe.restorers.add(() => { restoreCalls++; });
  // Like the reported path, the body/request wrappers can already be settled.
  assert.equal(context.probe.live.size, 0);
  const failed = context.probe.owned(() => context.probe.observe(observer));
  assert.equal(context.probe.live.size, 1);
  const rejection = assert.rejects(failed, /preserve fixture IDs/);
  assert.equal(timers.length, 1);
  timers.shift()(); // deterministically fire bounded's deadline, no wall-clock wait
  await rejection;
  assert.equal(context.probe.live.size, 0, 'body settled but raw observer is still live');
  assert.equal(observerSettled, false, 'timeout must not pretend observer settled');
  await assert.rejects(hooks.after(), /preserve fixture IDs/);
  await assert.rejects(hooks.all(), /preserve fixture IDs/);
  assert.throws(() => hooks.before(), /preserve fixture IDs/);
  assert.equal(cleanupCalls, 0, 'no teardown SQL against live observer');
  assert.equal(disconnectCalls, 0, 'no disconnect against live observer');
  assert.equal(restoreCalls, 1, 'fallback spy restoration still runs');
  resolveObserver();
  await observer;
  assert.equal(observerSettled, true);
  assert.throws(() => hooks.before(), /preserve fixture IDs/, 'late settlement does not clear latch');
  console.log('PASS: extracted observer timeout blocks cleanup/disconnect/SQL admission while raw observer remains live; late settlement remains fail-closed (NOT SQL proof)');
})().catch(error => { console.error(error); process.exitCode = 1; });
