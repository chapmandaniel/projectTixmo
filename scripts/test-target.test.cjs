const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertDisposableTestTarget } = require('./test-target.cjs');

const valid = { NODE_ENV: 'test', TIXMO_ALLOW_TEST_RESET: 'true', TIXMO_TEST_DATABASE_URL: 'postgresql://local:disposable@127.0.0.1:55445/tixmo_test_security' };
test('requires explicit authorization and an isolated target before reset', () => {
  assert.equal(assertDisposableTestTarget(valid), valid.TIXMO_TEST_DATABASE_URL);
  for (const patch of [
    { NODE_ENV: 'production' }, { TIXMO_ALLOW_TEST_RESET: '' }, { TIXMO_TEST_DATABASE_URL: '' },
    { TIXMO_TEST_DATABASE_URL: 'postgresql://local:disposable@prod.example/tixmo_test_security' },
    { TIXMO_TEST_DATABASE_URL: 'postgresql://local:disposable@127.0.0.1/app' },
    { DATABASE_URL: 'postgresql://private:private@production.example/app' },
    { TIXMO_TEST_DATABASE_URL: 'not a URL' },
  ]) assert.throws(() => assertDisposableTestTarget({ ...valid, ...patch }));
});
