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

test('captured email opens a new document instead of only changing the request-form fragment', () => {
  const source = fs.readFileSync('scripts/browser/wallet-continuity.mjs', 'utf8');
  const emailNavigation = source.slice(source.indexOf('  mark(13);'), source.indexOf('  mark(14);'));
  const departure = emailNavigation.indexOf('url: origin + "/wallet"');
  const email = emailNavigation.indexOf('const resetNavigation =');
  assert.ok(departure >= 0 && email > departure);
  assert.ok(emailNavigation.includes('sameDocumentNavigation.loaderId, undefined'));
  assert.ok(worker.includes('sameDocumentRecovered,'));
  assert.ok(suite.includes('sameDocumentRecovered: true'));
  assert.ok(emailNavigation.indexOf('const sameDocumentNavigation =') < departure);
  assert.ok(emailNavigation.includes('typeof resetNavigation.loaderId, "string"'));
  assert.ok(emailNavigation.includes('resetNavigation.loaderId.length > 0'));
  for (const invariant of ['location.hash', '__TIXMO_RESET_CAPTURE_EARLY__', 'location.search', 'resetDocumentCsp, true']) assert.ok(emailNavigation.includes(invariant));
});


test('startup diagnostics project only bounded numeric phases without payload content', () => {
  for (let startupPhase = 0; startupPhase <= 9; startupPhase++) {
    const result = walletBrowserDiagnostic({stage: 4, category: 'other', startupPhase, message: 'synthetic-canary', url: 'synthetic-canary'});
    assert.deepEqual(result, {stage: 4, category: 'other', startupPhase});
    assert.equal(JSON.stringify(result).includes('synthetic-canary'), false);
  }
  for (const startupPhase of [-1, 10, 1.5, Infinity, NaN, '1', null, {}, 'synthetic-canary']) {
    assert.equal(walletBrowserDiagnostic({stage: 4, category: 'other', startupPhase}), null);
  }
  const parent = fs.readFileSync('tixmoapi2/tests/integration/wallet-browser-recovery.test.ts', 'utf8');
  const worker = fs.readFileSync('scripts/browser/wallet-continuity.mjs', 'utf8');
  for (let phase = 1; phase <= 9; phase++) {
    assert.ok(parent.includes(`assertStartupPhasePassed(${phase})`));
    assert.ok(worker.includes(`phase(${phase})`));
  }
  assert.ok(parent.indexOf('assertStartupPhasePassed(1)') < parent.indexOf('assertStagePassed(1)'));
  assert.ok(worker.includes('startupPhase = 0;'));
});

const { clearDevToolsActivePort, parseActivePort, readActivePort, discoverDevTools } = require('./browser/devtools-discovery.cjs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const browserPath = '/devtools/browser/11111111-1111-4111-8111-111111111111';
const endpoint = `ws://127.0.0.1:49152${browserPath}`;
function discoveryFixture(t) {
 const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-discovery-'));
 const file = path.join(profile,'DevToolsActivePort');
 const browser = new EventEmitter(); browser.stderr = new PassThrough(); browser.exitCode = null; browser.signalCode = null;
 t.after(() => {browser.stderr.destroy(); fs.rmSync(profile,{recursive:true,force:true});});
 return {profile,file,browser};
}
test('owned stale discovery file removal preserves wallet profile and all other files', t => {
 const {profile,file} = discoveryFixture(t);
 fs.mkdirSync(path.join(profile,'Default')); fs.writeFileSync(path.join(profile,'Default','Local Storage'),'synthetic-session');
 fs.writeFileSync(file,`49152\n${browserPath}`); clearDevToolsActivePort(profile);
 assert.equal(fs.existsSync(file),false); assert.equal(fs.readFileSync(path.join(profile,'Default','Local Storage'),'utf8'),'synthetic-session');
 clearDevToolsActivePort(profile);
 assert.ok(worker.indexOf('clearDevToolsActivePort(profile)') < worker.indexOf('browser = spawn('));
});
test('bounded current regular file yields canonical loopback endpoint without stderr', async t => {
 const {profile,file,browser} = discoveryFixture(t);
 clearDevToolsActivePort(profile);
 const pending=discoverDevTools(browser,profile,()=>new Error('deadline'),200);
 fs.writeFileSync(file,`49152\n${browserPath}\n`);
 assert.equal(await pending,endpoint); assert.equal(browser.listenerCount('exit'),0); assert.equal(browser.listenerCount('error'),0); assert.equal(browser.stderr.listenerCount('data'),0);
});
test('partial port write is not accepted until complete path appears', async t => {
 const {profile,file,browser}=discoveryFixture(t); fs.writeFileSync(file,'49152\n');
 assert.equal(readActivePort(profile),null);
 const pending=discoverDevTools(browser,profile,()=>new Error('deadline'),200);
 fs.writeFileSync(file,`49152\n${browserPath}`); assert.equal(await pending,endpoint);
});
for(const content of ['80\n'+browserPath,'65536\n'+browserPath,'49152\nws://remote.invalid/path','49152\n/devtools/page/secret','49152\n'+browserPath+'?token=secret','49152\n'+browserPath+'\nextra','x'.repeat(513),'49152\n/devtools/browser/../../secret']) test('rejects malformed discovery content '+JSON.stringify(content.slice(0,28)), () => assert.throws(()=>parseActivePort(content)));
test('discovery refuses symbolic links, directories and oversize files without following them', async t => {
 const {profile,file,browser}=discoveryFixture(t); const outside=path.join(profile,'unrelated'); fs.writeFileSync(outside,`49152\n${browserPath}`);
 fs.symlinkSync(outside,file); assert.throws(()=>readActivePort(profile)); assert.throws(()=>clearDevToolsActivePort(profile)); assert.equal(fs.readFileSync(outside,'utf8'),`49152\n${browserPath}`);
 fs.unlinkSync(file); fs.mkdirSync(file); assert.throws(()=>readActivePort(profile)); assert.throws(()=>clearDevToolsActivePort(profile)); fs.rmdirSync(file);
 fs.writeFileSync(file,'x'.repeat(513)); await assert.rejects(discoverDevTools(browser,profile,()=>new Error('deadline'),100));
 assert.equal(browser.listenerCount('exit'),0);
});
test('validated stderr announcement remains supported and raw output is drained', async t => {
 const {profile,browser}=discoveryFixture(t); const pending=discoverDevTools(browser,profile,()=>new Error('deadline'),200);
 browser.stderr.write(`unrelated synthetic-canary\nDevTools listening on ${endpoint}\n`); assert.equal(await pending,endpoint);
 browser.stderr.write('later synthetic-canary'); assert.equal(browser.stderr.listenerCount('data'),0);
});
test('file discovery survives absent or oversized stderr announcement chunks', async t => {
 const {profile,file,browser}=discoveryFixture(t); const pending=discoverDevTools(browser,profile,()=>new Error('deadline'),200);
 browser.stderr.write(`DevTools listening on ${endpoint}\n`+'x'.repeat(17000));
 fs.writeFileSync(file,`49152\n${browserPath}`); assert.equal(await pending,endpoint);
});
test('external stderr endpoint cannot enter CDP transport', async t => {
 const {profile,browser}=discoveryFixture(t); const pending=discoverDevTools(browser,profile,()=>new Error('deadline'),200);
 browser.stderr.write(`DevTools listening on ws://external.invalid:49152${browserPath}\n`); await assert.rejects(pending);
});
for(const event of ['error','exit']) test(`startup ${event} cancels discovery polling and listeners`,async t => {
 const {profile,browser}=discoveryFixture(t); const pending=discoverDevTools(browser,profile,()=>new Error('deadline'),200);
 browser.emit(event,new Error('synthetic-canary')); await assert.rejects(pending); assert.equal(browser.listenerCount('exit'),0); assert.equal(browser.listenerCount('error'),0); assert.equal(browser.stderr.listenerCount('data'),0);
});
test('discovery preserves deadline classification and stops polling after timeout', async t => {
 const {profile,browser}=discoveryFixture(t); class Deadline extends Error {}
 await assert.rejects(discoverDevTools(browser,profile,()=>new Deadline(),30),Deadline);
 assert.equal(browser.listenerCount('exit'),0); assert.equal(browser.stderr.listenerCount('data'),0);
 assert.match(worker, /discoverDevTools\(\s*browser,\s*profile,\s*\(\) => new BrowserDeadline\(\),?\s*\)/);
 assert.ok(fs.readFileSync('scripts/browser/devtools-discovery.cjs','utf8').includes('timeoutMs = 15000'));
 const collection=fs.readFileSync('scripts/verify-market-local.mjs','utf8').match(/name: 'Root verification safety checks',[\s\S]*?args: \[([^\]]+)\]/)?.[1];
 assert.ok(collection?.includes("'scripts/wallet-browser.test.cjs'"));
});

test('already exited browser never admits even a syntactically valid endpoint file', async t => {
 const {profile,file,browser}=discoveryFixture(t); fs.writeFileSync(file,`49152\n${browserPath}`); browser.exitCode=1;
 await assert.rejects(discoverDevTools(browser,profile,()=>new Error('deadline'),100));
 assert.equal(browser.listenerCount('exit'),0); assert.equal(browser.stderr.listenerCount('data'),0);
});
