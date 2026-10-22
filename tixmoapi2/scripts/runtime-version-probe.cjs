'use strict';
// Runtime-only read-only version observation. Never load app/config/.env or print endpoints.
const SCOPE = 'runtime-postgresql-redis-versions-only';
const SQL = "SELECT current_setting('server_version_num') AS version";
function guard(args, env) {
  if (args.length || env.NODE_ENV !== 'production' || env.TIXMO_RUNTIME_VERSION_PROBE !== 'true')
    throw new Error('Rejected');
  for (const [name, protocols] of [
    ['DATABASE_URL', ['postgres:', 'postgresql:']],
    ['REDIS_URL', ['redis:', 'rediss:']],
  ]) {
    const value = env[name];
    if (
      typeof value !== 'string' ||
      !value.length ||
      value.length > 4096 ||
      /[\s\x00-\x1f\x7f]/.test(value)
    )
      throw new Error('Rejected');
    const url = new URL(value);
    if (
      !protocols.includes(url.protocol) ||
      !url.hostname ||
      url.hash ||
      (name === 'DATABASE_URL' && url.pathname.length < 2)
    )
      throw new Error('Rejected');
  }
  return { databaseUrl: env.DATABASE_URL, redisUrl: env.REDIS_URL };
}
function versions(rows, info) {
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    Object.keys(rows[0] || {}).length !== 1 ||
    typeof rows[0].version !== 'string' ||
    !/^[1-9][0-9]{4,5}$/.test(rows[0].version)
  )
    throw new Error('Rejected');
  if (typeof info !== 'string' || info.length > 65536 || Buffer.byteLength(info) > 65536)
    throw new Error('Rejected');
  const lines = info.split(/\r?\n/).filter((line) => line.startsWith('redis_version:'));
  if (
    lines.length !== 1 ||
    !/^redis_version:[1-9][0-9]{0,2}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(lines[0])
  )
    throw new Error('Rejected');
  return {
    postgresqlVersionNum: Number(rows[0].version),
    redisVersion: lines[0].slice('redis_version:'.length),
  };
}
async function bounded(work, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Rejected')), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function observe(args, env, dependencies = {}) {
  let db;
  let redis;
  let phase = 'guard';
  let result;
  let redisError = false;
  try {
    const plan = guard(args, env);
    phase = 'load';
    const PrismaClient = dependencies.PrismaClient || require('@prisma/client').PrismaClient;
    const createClient = dependencies.createClient || require('redis').createClient;
    db = new PrismaClient({ datasources: { db: { url: plan.databaseUrl } }, log: [] });
    redis = createClient({
      url: plan.redisUrl,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 1,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });
    redis.on('error', () => {
      redisError = true;
    });
    phase = 'postgres-connect';
    await bounded(db.$connect(), 3000);
    phase = 'postgres-version';
    const rows = await bounded(db.$queryRawUnsafe(SQL), 3000);
    phase = 'redis-connect';
    await bounded(redis.connect(), 3000);
    phase = 'redis-version';
    const info = await bounded(redis.info('server'), 3000);
    phase = 'validate';
    const numeric = versions(rows, info);
    if (redisError) throw new Error('Rejected');
    result = { ok: true, scope: SCOPE, ...numeric };
  } catch {
    result = { ok: false, scope: SCOPE, phase };
  }
  let cleaned = true;
  // Both owned clients get cleanup even if the other cleanup fails. No retry.
  if (redis && redis.isOpen) {
    try {
      await bounded(Promise.resolve(redis.disconnect()), 2000);
    } catch {
      cleaned = false;
    }
  }
  if (db) {
    try {
      await bounded(db.$disconnect(), 2000);
    } catch {
      cleaned = false;
    }
  }
  if (!cleaned || (redisError && result.ok)) return { ok: false, scope: SCOPE, phase: 'cleanup' };
  return result;
}
async function main(args = process.argv.slice(2), env = process.env, dependencies = {}) {
  let reported = false;
  const timer = setTimeout(() => {
    if (!reported) {
      reported = true;
      process.stdout.write(JSON.stringify({ ok: false, scope: SCOPE, phase: 'deadline' }) + '\n');
    }
    process.exit(1);
  }, 20000);
  const result = await observe(args, env, dependencies);
  if (reported) return;
  reported = true;
  // Cleanup was attempted above. Timed-out client work may still own handles;
  // the executable must terminate after its single fixed receipt, not hang.
  process.stdout.write(JSON.stringify(result) + '\n', (error) => {
    clearTimeout(timer);
    process.exit(error || !result.ok ? 1 : 0);
  });
}

if (require.main === module) void main();
module.exports = { guard, versions, observe, main };
