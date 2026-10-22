// Pure source/guard contracts; never launch Chrome/Vite/API/SQL/Redis.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateWalletBrowser } = require('./wallet-browser-guard.cjs');
const fixture = { a: 'buyer-a@synthetic.test', b: 'buyer-b@synthetic.test', password: 'Synthetic-Wallet-Only!', newPassword: 'Synthetic-Recovered2!', orderId: '00000000-0000-4000-8000-000000000001', ticketId: '00000000-0000-4000-8000-000000000002', slug: 'wallet-00000000-0000-4000-8000-000000000003', orderNumber: 'WALLET-00000000-0000-4000-8000-000000000001' };
const env = { NODE_ENV: 'production', TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1', DATABASE_URL: 'postgresql://synthetic@127.0.0.1:49152/tixmo_disposable_browser', REDIS_URL: 'redis://127.0.0.1:49153/1', TIXMO_WALLET_API: 'http://127.0.0.1:49154', TIXMO_WALLET_PORT: '49155', TIXMO_WALLET_FIXTURE: JSON.stringify(fixture), TIXMO_BROWSER_PATH: '/usr/bin/google-chrome' };
test('synthetic loopback browser request is admitted without runtime imports', () => assert.equal(validateWalletBrowser(env).frontendPort, 49155));
for (const [name, mutation] of [
 ['missing destructive opt-in', { TIXMO_ALLOW_DESTRUCTIVE_TESTS: '' }], ['remoteSQL', { DATABASE_URL: env.DATABASE_URL.replace('127.0.0.1', 'remote.invalid') }], ['RedisDB0', { REDIS_URL: env.REDIS_URL.replace('/1', '/0') }],
 ['remoteAPI', { TIXMO_WALLET_API: 'http://remote.invalid:49154' }], ['API credentials', { TIXMO_WALLET_API: 'http://secret@127.0.0.1:49154' }], ['API query', { TIXMO_WALLET_API: 'http://127.0.0.1:49154/?token=secret' }], ['API privilegedport', { TIXMO_WALLET_API: 'http://127.0.0.1:80' }],
 ['same listener', { TIXMO_WALLET_PORT: '49154' }], ['invalid browserpath', { TIXMO_BROWSER_PATH: 'download-now' }], ['malformed fixture', { TIXMO_WALLET_FIXTURE: '{' }], ['unbounded fixture', { TIXMO_WALLET_FIXTURE: 'x'.repeat(4097) }],
 ...Object.entries({ recipient: { a: 'real@example.com' }, identicalOwner: { b: fixture.a }, foreignPassword: { password: 'foreign' }, invalidTicket: { ticketId: '../secret' } }).map(([name, values]) => [name, { TIXMO_WALLET_FIXTURE: JSON.stringify({ ...fixture, ...values }) }]),
]) test(`guard rejects ${name}`, () => assert.throws(() => validateWalletBrowser({ ...env, ...mutation })));
const workflow = fs.readFileSync('.github/workflows/market-readiness-local.yml','utf8');
const worker = fs.readFileSync('scripts/browser/wallet-continuity.mjs','utf8');
const suite = fs.readFileSync('tixmoapi2/tests/integration/wallet-browser-recovery.test.ts','utf8');
function workflowContract(source) {
 assert.match(source, /test -x \/usr\/bin\/google-chrome/);
 assert.match(source, /TIXMO_BROWSER_PATH: \/usr\/bin\/google-chrome/);
 assert.equal((source.match(/run: npm run verify:market/g)||[]).length,1);
 assert.doesNotMatch(source, /run:.*wallet-browser-recovery/);
 assert.doesNotMatch(source, /playwright install|apt-get.*chrom|download.*chrom/);
}
test('existing standard API discovery owns exactly one browser execution and requires installed Chrome', () => workflowContract(workflow));
for (const marker of ['test -x /usr/bin/google-chrome','TIXMO_BROWSER_PATH: /usr/bin/google-chrome','run: npm run verify:market']) test(`workflow rejects missing ${marker}`, () => assert.throws(() => workflowContract(workflow.replace(marker,'REMOVED'))));
test('worker guards before Vite/spawn and never fabricates API responses or logs protocol content', () => {
 assert.ok(worker.indexOf('validateWalletBrowser(process.env)') < worker.indexOf('await mkdtemp'));
 assert.ok(worker.indexOf('validateWalletBrowser(process.env)') < worker.indexOf('await import('));
 assert.doesNotMatch(worker, /Fetch\.fulfillRequest|console\.|HOME: profile|process\.stdout|process\.stderr/);
 assert.match(worker, /url\.origin !== origin/);
 assert.match(worker, /Fetch\.failRequest/);
 assert.match(worker, /Fetch\.continueRequest/);
 assert.match(worker, /groupExists\(\), false/);
 assert.match(worker, /cleanupProofs/);
 assert.match(worker, /issued\.exp - issued\.iat, 10/);
 assert.match(worker, /new Set\(pids\)\.size, 3/);
 assert.match(worker, /renewed\.userId, owner/);
});
test('suite retains real auth, transport-only receipt, full financial and cleanup boundaries', () => {
 for(const marker of ['jest.unmock(\'../../src/config/redis\')','jest.unmock(\'../../src/utils/notificationService\')',"['jwtExpiresIn', '10s']",'expect(await snapshot()).toEqual(before)','expect(financial(after)).toEqual(financial(before))','expect(transporter.sendMail).toHaveBeenCalledTimes(recoveryMailCount + 1)','requireSafeCleanup();']) assert.ok(suite.includes(marker), marker);
 assert.doesNotMatch(suite, /jest\.mock\(['"]\.\.\/\.\.\/src\/(middleware\/auth|utils\/jwt|api\/orders\/service|utils\/notificationService)/);
 assert.ok(suite.indexOf('requireSafeCleanup();') < suite.indexOf('prisma.ticket.deleteMany'));
 assert.ok(suite.indexOf('await bounded(cleanup)') < suite.indexOf('for (const spy of spies.reverse())'));
 assert.match(suite, /unsafe = true/);
 assert.match(suite, /stdio: \['ignore', 'ignore', 'ignore', 'ipc'\]/);
});

test('current browser lost-password extension uses production CSP and real captured-link UI without financial POSTs', () => {
 for (const marker of ["await build(buildConfig)", "await preview(", "tdash/nginx.security-headers.conf", "__TIXMO_RESET_CAPTURE_EARLY__", "await deadline(resetLink", "fixture.newPassword", "lostPasswordRecovered: true"]) assert.ok(worker.includes(marker), marker);
 assert.ok(worker.includes('/api/v1/auth/forgot-password')); assert.ok(worker.includes('/api/v1/auth/reset-password'));
 assert.ok(suite.includes("Reset your Tixmo buyer password")); assert.ok(suite.includes("Your Tixmo buyer password changed"));
 assert.ok(suite.includes('recoveryMailCount + 1'));
 const result = worker.slice(worker.indexOf('process.send?.({\n    ok: true'));
 assert.doesNotMatch(result, /capturedLink|resetLink:|token:|raw:/);
});

const { walletBrowserDiagnostic } = require('./wallet-browser-guard.cjs');
test('worker diagnostics project only bounded stages and fixed categories', () => {
  const secret = 'synthetic-token-canary';
  for (const category of ['progress', 'assertion', 'deadline', 'other']) {
    for (let stage = 1; stage <= 18; stage++) {
      const projected = walletBrowserDiagnostic({ stage, category, message: secret, stack: secret, url: secret, token: secret });
      assert.deepEqual(projected, { stage, category });
      assert.equal(JSON.stringify(projected).includes(secret), false);
    }
  }
});
test('worker diagnostics reject malformed/unbounded/free-text fields', () => {
  for (const value of [null, undefined, 'secret', {}, { stage: 1, category: 'secret' },
    ...[-1, 0, 19, 1.5, Infinity, NaN, '1', null].map(stage => ({ stage, category: 'other' })),
    { stage: 1, category: 'other'.repeat(10000) }]) assert.equal(walletBrowserDiagnostic(value), null);
});
test('worker failure diagnostics retain real failure and cleanup assertions', () => {
  const source = fs.readFileSync('scripts/browser/wallet-continuity.mjs', 'utf8');
  assert.match(source, /error instanceof assert.AssertionError/);
  assert.match(source, /error instanceof BrowserDeadline/);
  assert.doesNotMatch(source, /diagnose[^;]*error\.(message|stack)/s);
  assert.match(source, /process.exitCode = 1/);
  const parent = fs.readFileSync('tixmoapi2/tests/integration/wallet-browser-recovery.test.ts', 'utf8');
  for (let stage = 1; stage <= 18; stage++) assert.ok(parent.includes(`assertStagePassed(${stage})`));
  assert.ok(parent.includes('expect(workerExitCode).toBe(0)'));
  assert.ok(parent.includes('expect(workerCleanup).toBe(true)'));
});
