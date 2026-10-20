'use strict';

// One fail-closed policy for the verifier and Jest, with no config imports or I/O.
function validateVerificationTargets(env) {
  const reject = () => { throw new Error('Unsafe verification configuration: require TIXMO_ALLOW_DESTRUCTIVE_TESTS=1, a loopback PostgreSQL database named tixmo_disposable_<name>, and an explicitly disposable Redis database /1 through /15. Provision isolated services first.'); };
  if (env.TIXMO_ALLOW_DESTRUCTIVE_TESTS !== '1') reject();
  const parse = (value, protocols) => {
    if (typeof value !== 'string' || !value || value !== value.trim()) reject();
    let url;
    try {
      decodeURIComponent(value);
      url = new URL(value);
    } catch { reject(); }
    if (!protocols.includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hash) reject();
    return url;
  };
  const database = parse(env.DATABASE_URL, ['postgresql:', 'postgres:']);
  if (!/^\/tixmo_disposable_[a-z0-9_]+$/.test(database.pathname)) reject();
  // Disallow libpq connection overrides (host, service, options, etc.).
  if ([...database.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public') || [...database.searchParams].length > 1) reject();
  const redis = parse(env.REDIS_URL, ['redis:']);
  if (!/^\/(?:[1-9]|1[0-5])$/.test(redis.pathname) || redis.search) reject();
  return { database, redis };
}

function redactConnectionUrl(value) {
  // Never retain userinfo, query values, paths or malformed input in logs.
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:', 'redis:', 'rediss:'].includes(url.protocol)) return '<redacted connection>';
    return `${url.protocol}//<redacted>`;
  } catch { return '<invalid connection>'; }
}

function bootstrapTestDatabase(env, execute, cwd) {
  validateVerificationTargets(env);
  try {
    execute('npx prisma db push --accept-data-loss --skip-generate', { cwd, env, stdio: 'ignore' });
  } catch {
    // Child errors can contain credentials, so do not expose the original error.
    throw new Error('Disposable test database schema bootstrap failed.');
  }
}

module.exports = { validateVerificationTargets, redactConnectionUrl, bootstrapTestDatabase };
