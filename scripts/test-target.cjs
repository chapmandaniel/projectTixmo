const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function assertDisposableTestTarget(env = process.env) {
  if (env.NODE_ENV !== 'test' || env.TIXMO_ALLOW_TEST_RESET !== 'true' || !env.TIXMO_TEST_DATABASE_URL) {
    throw new Error('Tests require NODE_ENV=test, TIXMO_ALLOW_TEST_RESET=true and an explicit TIXMO_TEST_DATABASE_URL.');
  }
  let target;
  try { target = new URL(env.TIXMO_TEST_DATABASE_URL); } catch { throw new Error('Invalid disposable test database target.'); }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !LOOPBACK.has(target.hostname) ||
      !/^\/(?:tixmo_test(?:_[a-zA-Z0-9_]+)?|tixmo_disposable_[a-z0-9_]+)$/.test(target.pathname) ||
      (env.DATABASE_URL && env.DATABASE_URL !== env.TIXMO_TEST_DATABASE_URL)) {
    throw new Error('Refusing database reset: use a matching loopback tixmo_test database, never an inherited application target.');
  }
  return target.toString();
}

module.exports = { assertDisposableTestTarget };
