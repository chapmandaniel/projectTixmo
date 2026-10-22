import {
  AssetShareValidationError,
  AssetShareValidationSummary,
} from '../../src/services/asset-share-crypto';
const assert = require('node:assert/strict');
const { options } = require('../../prisma/rekey-asset-shares');
const env = {
  TIXMO_ASSET_REKEY_DATABASE_URL: 'postgresql://synthetic@127.0.0.1:5432/tixmo_disposable_rekey',
};
test('default is bounded audit and apply requires explicit runtime opt-in', () => {
  assert.deepEqual(options([], env), {
    apply: false,
    preserveHashOnly: false,
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
  ])
    assert.equal(failureReason(new Error(message)), expected);
  for (const code of [
    'P1000',
    'P1001',
    'P1002',
    'P1010',
    'P2010',
    'P2021',
    'P2022',
    'P2024',
    'P2028',
  ]) {
    assert.equal(
      failureReason(Object.assign(new Error('synthetic-private-canary'), { code })),
      'database'
    );
  }
});
test('unknown errors, canaries and malformed properties never enter diagnostic output', () => {
  const malformed = new Error();
  Object.defineProperty(malformed, 'message', {
    get() {
      throw new Error('synthetic-private-canary');
    },
  });
  for (const error of [
    null,
    'synthetic-private-canary',
    {},
    new Error('synthetic-private-canary'),
    Object.assign(new Error('synthetic-private-canary'), { code: 'synthetic-private-canary' }),
    malformed,
  ]) {
    assert.equal(failureReason(error), 'generic');
    assert.equal(
      JSON.stringify({ reason: failureReason(error) }).includes('synthetic-private-canary'),
      false
    );
  }
});

const { validationCounts } = require('../../prisma/rekey-asset-shares');
const validation: AssetShareValidationSummary = {
  scanned: 8,
  scope: 'all',
  hashOnly: 0,
  missingCipher: 1,
  unknownFormat: 1,
  malformedEnvelope: 1,
  decryptFailed: 1,
  invalidHash: 1,
  hashMismatch: 1,
  validLegacy: 1,
  validCurrent: 1,
};
test('trusted verification errors expose only fixed complete bounded aggregate counts', () => {
  const error = new AssetShareValidationError(validation);
  assert.deepEqual(validationCounts(error, AssetShareValidationError), validation);
  assert.equal(JSON.stringify(error), '{}');
  assert.equal(Object.isFrozen(error.summary), true);
  const maximum = {
    ...validation,
    scanned: 10000,
    missingCipher: 9993,
    scope: 'organization' as const,
  };
  assert.deepEqual(
    validationCounts(new AssetShareValidationError(maximum), AssetShareValidationError),
    maximum
  );
});
test('count projection rejects forged, partial, out-of-bound or secret-bearing summaries', () => {
  const malformed = [
    { ...validation, scanned: 10001 },
    { ...validation, scanned: -1 },
    { ...validation, scope: 'private-canary' },
    { ...validation, missingCipher: -1 },
    { ...validation, missingCipher: 0.5 },
    { ...validation, missingCipher: NaN },
    { ...validation, missingCipher: 9 },
    { ...validation, validCurrent: 2 },
    { ...validation, missingCipher: 'private-canary' },
    { ...validation, token: 'private-canary' },
    { ...validation, missingCipher: undefined },
    {
      ...validation,
      scanned: 2,
      missingCipher: 0,
      unknownFormat: 0,
      malformedEnvelope: 0,
      decryptFailed: 0,
      invalidHash: 0,
      hashMismatch: 0,
    },
  ];
  for (const value of malformed)
    assert.equal(
      validationCounts(new AssetShareValidationError(value as any), AssetShareValidationError),
      undefined
    );
  const forged = Object.assign(new Error('Asset share rekey verification failed'), {
    summary: validation,
    token: 'private-canary',
  });
  const prototypeForgery = Object.setPrototypeOf(
    new Error('private-canary'),
    AssetShareValidationError.prototype
  );
  for (const value of [null, {}, forged, prototypeForgery, new Error('private-canary')]) {
    assert.equal(validationCounts(value, AssetShareValidationError), undefined);
    assert.equal(
      JSON.stringify({ validation: validationCounts(value, AssetShareValidationError) }).includes(
        'private-canary'
      ),
      false
    );
  }
  assert.equal(validationCounts(new AssetShareValidationError(validation), undefined), undefined);
});

test('hash-only policy requires the dedicated flag AND exact runtime opt-in for audit and apply', () => {
  const allowed = { ...env, TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION: 'true' };
  assert.equal(options([], allowed).preserveHashOnly, false);
  for (const value of [undefined, '', 'TRUE', ' true', '1'])
    assert.throws(() =>
      options(['--preserve-hash-only'], { ...env, TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION: value })
    );
  assert.equal(options(['--preserve-hash-only'], allowed).preserveHashOnly, true);
  assert.throws(() => options(['--preserve-hash-only', '--apply'], allowed));
  assert.equal(
    options(['--preserve-hash-only', '--apply'], {
      ...allowed,
      TIXMO_ALLOW_ASSET_SHARE_REKEY: 'true',
    }).apply,
    true
  );
  assert.throws(() => options(['--preserve-hash-only', '--preserve-hash-only'], allowed));
});
test('aggregate hash-only counts remain bounded and cannot mask an invalid selected row', () => {
  const counts = { ...validation, scanned: 9, hashOnly: 1 };
  assert.deepEqual(
    validationCounts(new AssetShareValidationError(counts), AssetShareValidationError),
    counts
  );
  for (const hashOnly of [-1, 1.5, NaN, 10001, 'private-canary'])
    assert.equal(
      validationCounts(
        new AssetShareValidationError({ ...counts, hashOnly } as any),
        AssetShareValidationError
      ),
      undefined
    );
  const noFailures = {
    ...validation,
    scanned: 3,
    hashOnly: 1,
    missingCipher: 0,
    unknownFormat: 0,
    malformedEnvelope: 0,
    decryptFailed: 0,
    invalidHash: 0,
    hashMismatch: 0,
  };
  assert.equal(
    validationCounts(new AssetShareValidationError(noFailures), AssetShareValidationError),
    undefined
  );
});
