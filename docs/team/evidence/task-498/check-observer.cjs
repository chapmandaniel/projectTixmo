// Independent inert helper-only probe: no application imports/module evaluation.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../../../tixmoapi2/tests/integration/event-sales-pause.sql.test.ts'), 'utf8');
const js = stripTypeScriptTypes(source, { mode: 'strip' });
const start = js.indexOf('function gate()');
const end = js.indexOf('async function fixture(');
assert.ok(start >= 0 && end > start);
const helpers = js.slice(start, end);
assert.ok(!helpers.includes('import '));
async function probe(mode) {
  const hooks = {}, timers = [];
  let sql = 0, disconnect = 0, restored = 0, resolveRaw, rejectRaw, rawSettled = false;
  const context = {
    Promise, Set, Error, JSON, console: { error() {} },
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    beforeEach(fn) { hooks.before = fn; }, afterEach(fn) { hooks.after = fn; }, afterAll(fn) { hooks.all = fn; },
    prisma: { $transaction() { sql++; return Promise.resolve(); }, $disconnect() { disconnect++; return Promise.resolve(); } },
  };
  vm.runInNewContext(helpers + '\nthis.api = { observe, owned, live, fixtures, restorers, latched: () => !!failClosed };', context);
  const api = context.api;
  api.fixtures.push({ orgId: 'owned-org', userId: 'owned-user', eventId: 'owned-event', typeId: 'owned-type' });
  api.restorers.add(() => restored++);
  const raw = new Promise((resolve, reject) => { resolveRaw = resolve; rejectRaw = reject; });
  void raw.then(() => { rawSettled = true; }, () => { rawSettled = true; });
  const body = api.owned(async () => {
    try { await api.observe(raw); }
    finally {
      assert.equal(api.live.size, 1, 'owned body has not left live');
      assert.equal(api.latched(), mode !== 'success', 'latch set before body finally/removal');
    }
  });
  if (mode === 'success') {
    resolveRaw(); await body;
    assert.equal(api.latched(), false);
    hooks.before(); await hooks.after(); await hooks.all();
    assert.equal(sql, 1); assert.equal(disconnect, 1); assert.equal(restored, 1);
  } else {
    const rejected = assert.rejects(body, /preserve fixture IDs/);
    if (mode === 'timeout') timers[0](); else rejectRaw(new Error('observer rejected'));
    await rejected;
    assert.equal(api.live.size, 0);
    assert.equal(rawSettled, mode === 'rejection');
    await assert.rejects(hooks.after(), /preserve fixture IDs/);
    await assert.rejects(hooks.all(), /preserve fixture IDs/);
    assert.throws(() => hooks.before(), /preserve fixture IDs/);
    assert.equal(sql, 0); assert.equal(disconnect, 0); assert.equal(restored, 1);
    assert.equal(api.fixtures.length, 1);
    if (mode === 'timeout') { resolveRaw(); await raw; }
    assert.equal(api.latched(), true);
    assert.throws(() => hooks.before(), /preserve fixture IDs/);
    await assert.rejects(hooks.after(), /preserve fixture IDs/);
    await assert.rejects(hooks.all(), /preserve fixture IDs/);
    assert.equal(sql, 0); assert.equal(disconnect, 0);
  }
  console.log('PASS independent extracted actual helper/hooks: ' + mode);
}
(async () => { for (const mode of ['timeout', 'rejection', 'success']) await probe(mode); })()
  .catch(error => { console.error(error); process.exitCode = 1; });
