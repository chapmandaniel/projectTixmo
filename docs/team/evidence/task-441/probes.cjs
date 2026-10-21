'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('/home/daniel/projects/projectTixmo/worktrees/task-434/tixmoapi2/node_modules/typescript');
const { cleanupSteps } = require('../task-426/cleanup.cjs');
const source = fs.readFileSync('tixmoapi2/tests/qualification/orders-http-abort.local.ts', 'utf8');
const finallyBody = source.slice(source.indexOf('  } finally {') + '  } finally {'.length, source.lastIndexOf('\n  }\n}),'));
function run({ failWrite = false, original = false, hang = false } = {}) {
  const calls = [];
  const context = {
    require: () => ({ cleanupSteps: steps => cleanupSteps(steps, 10) }),
    gate: { resolve() { calls.push('unblock'); } }, socket: { destroy() { calls.push('client destroy'); } },
    ownedSockets: [{ destroy() { calls.push('server socket destroy'); } }],
    server: { listening: true, close(done) { calls.push('server close'); if (!hang) done(); } },
    evalSpy: { mockRestore() { calls.push('eval restore'); } }, controllerSpy: undefined,
    removal: { mockRestore() { calls.push('removal restore'); } },
    revoke() { calls.push('revoke'); }, disconnectRedis() { calls.push('redis disconnect'); },
    prisma: { $disconnect() { calls.push('prisma disconnect'); } },
    fs: { writeFileSync(name, json, opts) { calls.push('write'); assert.equal(opts.flag, 'wx'); context.receipt = JSON.parse(json); if (failWrite) throw new Error('ENOSPC'); } },
    path: require('node:path'), crypto: { randomUUID: () => 'synthetic-id' }, artifact: '/offline-only',
    rows: [], requested: 1, aborted: 1, settled: 0, started: 0, performance: { now: () => 1 }, original,
  };
  const input = `(async () => { try { if (original) throw new Error('ORIGINAL'); } finally { ${finallyBody} } })()`;
  const code = ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return { context, calls, promise: vm.runInNewContext(code, context) };
}
(async () => {
  let r = run({ failWrite: true });
  await assert.rejects(r.promise, /ENOSPC/);
  assert.deepEqual(r.calls.slice(-3), ['redis disconnect', 'prisma disconnect', 'write']);
  console.log('PASS extracted finally: ENOSPC occurs after both disconnect attempts');
  r = run({ hang: true });
  await assert.rejects(r.promise, /Owned cleanup incomplete/);
  assert.equal(r.context.receipt.cleanup[1].ok, false);
  assert(r.calls.includes('redis disconnect') && r.calls.includes('prisma disconnect'));
  console.log('PASS extracted finally: hanging server close gets failed receipt and later cleanup continues');
  r = run({ failWrite: true, original: true });
  await assert.rejects(r.promise, /ENOSPC/);
  console.log('REPRO remaining gap: ENOSPC replaces ORIGINAL failure');
  r = run({ original: true });
  await assert.rejects(r.promise, /ORIGINAL/);
  assert(!('sourceSha' in r.context.receipt) && !('error' in r.context.receipt) && !('status' in r.context.receipt));
  console.log('REPRO remaining gap: failure receipt has no source SHA or original error/status');
  const phase = source.slice(source.indexOf('socket.destroy(); aborted++'), source.indexOf('      gate.resolve();') + '      gate.resolve();'.length);
  assert(phase.indexOf('terminal.promise') < phase.indexOf('gate.resolve()'));
  assert.match(source, /req\.once\('aborted', ack.resolve\); res\.once\('close', ack.resolve\)/);
  assert(source.indexOf('redis = await connectRedis()') > source.indexOf('  try {'));
  assert(source.indexOf("await import('../../src/app')") > source.indexOf('  try {'));
  console.log('PASS source ordering: server ACK wait precedes release; Redis/app initialization inside try (not HTTP verification)');
  const stableText = source.match(/const stable = (.*);\n    expect\(stable/)[1];
  const stable = vm.runInNewContext(ts.transpileModule('const stable = ' + stableText + '; stable;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
  assert.equal(JSON.stringify(stable({ id: 1, quantityAvailable: 2, updatedAt: 'new' })), JSON.stringify(stable({ id: 1, quantityAvailable: 2, updatedAt: 'old' })));
  assert.notEqual(JSON.stringify(stable({ id: 1, quantityAvailable: 1 })), JSON.stringify(stable({ id: 1, quantityAvailable: 2 })));
  console.log('PASS extracted stable comparison: only timestamp ignored; inventory drift remains visible');
  let release;
  const calls = [];
  await cleanupSteps([['admitted work', () => new Promise(resolve => { release = () => { calls.push('late work'); resolve(); }; })], ['disconnect', () => calls.push('disconnect')]], 10);
  release(); await Promise.resolve();
  assert.deepEqual(calls, ['disconnect', 'late work']);
  console.log('REPRO remaining gap: timed-out work can execute after disconnect; timeout is not joining/cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });
