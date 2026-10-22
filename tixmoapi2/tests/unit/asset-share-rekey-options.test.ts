const assert = require('node:assert/strict');
const { options } = require('../../prisma/rekey-asset-shares');
const env = {
  TIXMO_ASSET_REKEY_DATABASE_URL: 'postgresql://synthetic@127.0.0.1:5432/tixmo_disposable_rekey',
};
test('default is bounded audit and apply requires explicit runtime opt-in', () => {
  assert.deepEqual(options([], env), {
    apply: false,
    limit: 1000,
    organizationId: undefined,
    url: env.TIXMO_ASSET_REKEY_DATABASE_URL,
  });
  assert.throws(() => options(['--apply'], env));
  assert.equal(options(['--apply'], { ...env, TIXMO_ALLOW_ASSET_SHARE_REKEY: 'true' }).apply, true);
});
for (const args of [
  ['--limit', '0'],
  ['--limit', '10001'],
  ['--limit', '1.5'],
  ['--limit', '1', '--limit', '2'],
  ['--organization-id', 'bad'],
  ['--unknown'],
  ['--apply', '--apply'],
])
  test('rejects malformed operator arguments ' + JSON.stringify(args), () =>
    assert.throws(() => options(args, env))
  );
for (const mutation of [
  { TIXMO_ASSET_REKEY_DATABASE_URL: '' },
  { DATABASE_URL: 'postgresql://other/other' },
  { TIXMO_ASSET_REKEY_DATABASE_URL: 'https://invalid/db' },
  { TIXMO_ASSET_REKEY_DATABASE_URL: env.TIXMO_ASSET_REKEY_DATABASE_URL + '?schema=private' },
])
  test('rejects ambiguous target', () => assert.throws(() => options([], { ...env, ...mutation })));
test('CLI does not load .env, print raw failures or include record contents', () => {
  const source = require('node:fs').readFileSync(
    require.resolve('../../prisma/rekey-asset-shares'),
    'utf8'
  );
  assert.doesNotMatch(
    source,
    /require\(['"]dotenv|console\.(log|error)\([^)]*(token|ciphertext|secret|error\.message|error\.stack)/i
  );
  assert.match(source, /log: \[\]/);
});


const { failureReason } = require('../../prisma/rekey-asset-shares');
test('failure diagnostics map only fixed source reasons and allowlisted database codes', () => {
  for (const [message, expected] of [
    ['Asset share rekey configuration rejected', 'configuration'],
    ['Asset share rekey bound exceeded', 'bound'],
    ['Asset share rekey verification failed', 'verification'],
    ['Asset share rekey conflict', 'conflict'],
  ]) assert.equal(failureReason(new Error(message)), expected);
  for (const code of ['P1000', 'P1001', 'P1002', 'P1010', 'P2010', 'P2021', 'P2022', 'P2024', 'P2028']) {
    assert.equal(failureReason(Object.assign(new Error('synthetic-private-canary'), { code })), 'database');
  }
});
test('unknown errors, canaries and malformed properties never enter diagnostic output', () => {
  const malformed = new Error();
  Object.defineProperty(malformed, 'message', { get() { throw new Error('synthetic-private-canary'); } });
  for (const error of [null, 'synthetic-private-canary', {}, new Error('synthetic-private-canary'), Object.assign(new Error('synthetic-private-canary'), {code: 'synthetic-private-canary'}), malformed]) {
    assert.equal(failureReason(error), 'generic');
    assert.equal(JSON.stringify({reason: failureReason(error)}).includes('synthetic-private-canary'), false);
  }
});
