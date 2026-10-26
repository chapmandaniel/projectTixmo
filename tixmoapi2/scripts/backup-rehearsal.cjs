'use strict';
// Logical roundtrip only. No source DDL/DML, credentials in arguments, or raw receipts.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const SCOPE = 'task603-snapshot-logical-roundtrip';
const children = new Set();
async function bounded(work, ms) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Operation deadline')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function guard(args, env) {
  if (
    args.length ||
    env.NODE_ENV !== 'production' ||
    env.TIXMO_BACKUP_REHEARSAL !== 'true' ||
    typeof env.DATABASE_URL !== 'string' ||
    env.DATABASE_URL.length > 4096 ||
    /[\r\n\x00]/.test(env.DATABASE_URL)
  )
    throw new Error('Rejected');
  const url = new URL(env.DATABASE_URL);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.hash ||
    new Set([...url.searchParams.keys()]).size !== [...url.searchParams.keys()].length ||
    !url.username ||
    !url.password ||
    !/^[a-zA-Z0-9_-]{1,63}$/.test(databaseName) ||
    [...url.searchParams].some(
      ([name, value]) =>
        !['schema', 'sslmode'].includes(name) ||
        (name === 'schema' && value !== 'public') ||
        (name === 'sslmode' &&
          !['require', 'verify-full', 'verify-ca', 'prefer', 'disable'].includes(value))
    )
  )
    throw new Error('Rejected');
  if (env.TIXMO_BACKUP_CI === 'synthetic-only') {
    if (
      env.GITHUB_ACTIONS !== 'true' ||
      url.hostname !== '127.0.0.1' ||
      Number(url.port) < 1024 ||
      Number(url.port) > 65535 ||
      url.username !== 'tixmo_restore_ci' ||
      url.password !== 'synthetic_restore_password' ||
      url.pathname !== '/tixmo_disposable_restore_source'
    )
      throw new Error('Rejected');
  } else if (
    env.TIXMO_BACKUP_CI ||
    env.RAILWAY_PROJECT_ID !== 'c1c17660-3110-4fa8-a0bd-aca06d13a3ed' ||
    env.RAILWAY_ENVIRONMENT_ID !== 'dd8e0541-0e1d-478d-bec1-1f6bb7be1e2d' ||
    env.RAILWAY_SERVICE_ID !== '13efc131-9ae3-4305-9628-55c783286990' ||
    env.TIXMO_BACKUP_EXPECTED_DATABASE_HOST !== url.hostname ||
    env.TIXMO_BACKUP_EXPECTED_DATABASE_NAME !== databaseName
  )
    throw new Error('Rejected');
  return { url, source: databaseName };
}
function pgEnv(url, database) {
  return {
    PATH: '/usr/bin:/bin',
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
    PGCONNECT_TIMEOUT: '5',
    PGPASSFILE: '/dev/null',
    PGSERVICEFILE: '/dev/null',
    PGAPPNAME: 'tixmo-task603',
    PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=2000',
  };
}
async function native(program, args, options) {
  const child = spawn(program, args, {
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true,
  });
  children.add(child);
  let out = '',
    err = '',
    failed = false;
  const stop = () => {
    failed = true;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {}
  };
  child.stdout.on('data', (chunk) => {
    out += chunk;
    if (Buffer.byteLength(out) > 65536) stop();
  });
  child.stderr.on('data', (chunk) => {
    err += chunk;
    if (Buffer.byteLength(err) > 16384) stop();
  });
  child.stdin.on('error', () => {});
  child.stdin.end(options.input || '');
  const timer = setTimeout(stop, options.timeout || 30000);
  const size = options.file
    ? setInterval(() => {
        try {
          if (fs.statSync(options.file).size > 268435456) stop();
        } catch {
          stop();
        }
      }, 100)
    : undefined;
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    if (failed || result.code !== 0 || result.signal || err)
      throw new Error('Native operation failed');
    return out.trim();
  } finally {
    clearTimeout(timer);
    clearInterval(size);
    children.delete(child);
  }
}
const { MIGRATION_COUNT } = require('./migration-census.cjs');
const sql = (run, env, text) =>
  run('/usr/bin/psql', ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], {
    env,
    input: text,
    timeout: 15000,
  });
function quote(name) {
  if (!/^[_a-z][_a-z0-9]{0,62}$/.test(name)) throw new Error('Rejected');
  return '"' + name + '"';
}
function migrations() {
  const base = path.resolve(__dirname, '../prisma/migrations');
  const names = fs
    .readdirSync(base)
    .filter((name) => /^[0-9]/.test(name))
    .sort();
  if (names.length !== MIGRATION_COUNT) throw new Error('Rejected');
  return names.map((name) => {
    if (!/^[0-9][a-z0-9_]{1,127}$/.test(name)) throw new Error('Rejected');
    return {
      name,
      checksum: createHash('sha256')
        .update(fs.readFileSync(path.join(base, name, 'migration.sql')))
        .digest('hex'),
    };
  });
}
async function fingerprint(tx, expected) {
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10000'");
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2000'");
  await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
  const sequences = await tx.$queryRawUnsafe(
    "SELECT count(*)::text AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S'"
  );
  if (sequences[0]?.count !== '0') throw new Error('Sequences unsupported');
  const tables = await tx.$queryRawUnsafe(
    "SELECT c.relname::text AS name,c.relkind::text AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','f','m') ORDER BY c.relname"
  );
  if (!tables.length || tables.length > 128 || tables.some((row) => row.kind !== 'r'))
    throw new Error('Table bound rejected');
  const ledger = await tx.$queryRawUnsafe(
    'SELECT migration_name AS name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name'
  );
  const applied = ledger
    .filter((row) => row.finished_at && row.rolled_back_at === null)
    .map((row) => ({ name: row.name, checksum: row.checksum }));
  if (
    JSON.stringify(applied) !== JSON.stringify(expected) ||
    ledger.some((row) => !row.finished_at && !row.rolled_back_at)
  )
    throw new Error('Migration ledger rejected');
  const rows = [];
  let total = 0;
  for (const table of tables) {
    const name = quote(table.name);
    const [cardinality] = await tx.$queryRawUnsafe(
      `SELECT count(*)::text AS count FROM public.${name}`
    );
    const count = Number(cardinality?.count);
    if (!Number.isSafeInteger(count) || count < 0 || count > 100000 || total + count > 250000)
      throw new Error('Row bound rejected');
    const [row] = await tx.$queryRawUnsafe(
      `SELECT count(*)::text AS count,encode(sha256(convert_to(COALESCE(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),'' ORDER BY encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')),''),'UTF8')),'hex') AS hash FROM public.${name} t`
    );
    if (Number(row?.count) !== count || !/^[a-f0-9]{64}$/.test(row?.hash || ''))
      throw new Error('Row bound rejected');
    total += count;
    if (total > 250000) throw new Error('Row bound rejected');
    rows.push({ name: table.name, count, hash: row.hash });
  }
  return { rows, total };
}
async function observe(args, env, dependencies = {}) {
  if (env.TIXMO_BACKUP_REHEARSAL !== 'true') return { scope: SCOPE, skipped: true };
  const started = Date.now();
  let phase = 'guard',
    source,
    restore,
    owned = false,
    directory,
    file,
    archiveOwned = false,
    createdAttempted = false,
    databaseRemoved = false,
    fileRemoved = false,
    matched = false,
    tableCount = 0,
    rowCount = 0,
    dumpComplete = false,
    serverVersionNum = 0;
  const database = 'tixmo_rehearsal_' + randomUUID().replaceAll('-', '');
  const run = dependencies.native || native;
  let plan;
  let safe = true;
  async function transaction(db, work, options) {
    let body;
    let active = true;
    const check = () => {
      if (!active) throw new Error('Transaction stopped');
    };
    try {
      return await db.$transaction((tx) => {
        const guarded = new Proxy(tx, {
          get(target, property) {
            const value = Reflect.get(target, property);
            return typeof value === 'function'
              ? (...args) => {
                  check();
                  return value.apply(target, args);
                }
              : value;
          },
        });
        body = Promise.resolve().then(() => work(guarded, check));
        return body;
      }, options);
    } catch (error) {
      active = false;
      try {
        await bounded(
          body?.then(
            () => true,
            () => true
          ),
          50000
        );
      } catch {
        safe = false;
      }
      throw error;
    }
  }
  try {
    plan = guard(args, env);
    phase = 'clients';
    for (const tool of ['pg_dump', 'pg_restore', 'psql'])
      if (
        !new RegExp('^' + tool + ' [(]PostgreSQL[)] 18[.][0-9]+(?:[ ]|$)').test(
          await run('/usr/bin/' + tool, ['--version'], {
            env: pgEnv(plan.url, plan.source),
            timeout: 5000,
          })
        )
      )
        throw new Error('Client version rejected');
    const PrismaClient = dependencies.PrismaClient || require('@prisma/client').PrismaClient;
    source = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } }, log: [] });
    await bounded(source.$connect(), 5000);
    const expected = (dependencies.migrations || migrations)();
    phase = 'workspace';
    directory = fs.mkdtempSync(path.join(process.cwd(), 'tmp', 'task603-'));
    file = path.join(directory, 'owned.dump');
    const fd = fs.openSync(file, 'wx', 0o600);
    fs.closeSync(fd);
    archiveOwned = true;
    phase = 'snapshot';
    const before = await transaction(
      source,
      async (tx, check) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10000'");
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2000'");
        const [preflight] = await tx.$queryRawUnsafe(
          "SELECT current_database()::text AS database,current_setting('server_version_num') AS version,pg_database_size(current_database())::text AS bytes,(SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname=current_user) AS capable"
        );
        serverVersionNum = Number(preflight?.version);
        if (
          serverVersionNum < 180000 ||
          serverVersionNum >= 190000 ||
          !Number.isSafeInteger(serverVersionNum) ||
          preflight.database !== plan.source ||
          preflight.capable !== true ||
          !Number.isSafeInteger(Number(preflight.bytes)) ||
          Number(preflight.bytes) < 0 ||
          Number(preflight.bytes) > 268435456
        )
          throw new Error('Preflight rejected');
        const snapshot = await fingerprint(tx, expected);
        const [exported] = await tx.$queryRawUnsafe('SELECT pg_export_snapshot() AS snapshot');
        if (
          typeof exported?.snapshot !== 'string' ||
          !/^[a-fA-F0-9-]{1,80}$/.test(exported.snapshot)
        )
          throw new Error('Snapshot rejected');
        check();
        phase = 'dump';
        await run(
          '/usr/bin/pg_dump',
          [
            '--format=custom',
            '--no-owner',
            '--no-acl',
            '--lock-wait-timeout=2000',
            '--snapshot=' + exported.snapshot,
            '--file=' + file,
          ],
          { env: pgEnv(plan.url, plan.source), file, timeout: 45000 }
        );
        const stat = fs.lstatSync(file);
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          (stat.mode & 0o777) !== 0o600 ||
          stat.size === 0 ||
          stat.size > 268435456
        )
          throw new Error('Archive rejected');
        dumpComplete = true;
        return snapshot;
      },
      { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 90000 }
    );
    phase = 'create';
    const admin = pgEnv(plan.url, plan.source);
    if (
      (await sql(run, admin, `SELECT count(*) FROM pg_database WHERE datname='${database}';`)) !==
      '0'
    )
      throw new Error('Database already exists');
    createdAttempted = true;
    await sql(run, admin, `CREATE DATABASE "${database}" TEMPLATE template0;`);
    owned = true;
    if ((await sql(run, pgEnv(plan.url, database), 'SELECT current_database();')) !== database)
      throw new Error('Restore identity rejected');
    phase = 'restore';
    await run(
      '/usr/bin/pg_restore',
      [
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-acl',
        '--dbname=' + database,
        file,
      ],
      { env: pgEnv(plan.url, database), timeout: 60000 }
    );
    const destination = new URL(env.DATABASE_URL);
    destination.pathname = '/' + database;
    restore = new PrismaClient({ datasources: { db: { url: destination.href } }, log: [] });
    await bounded(restore.$connect(), 5000);
    phase = 'compare';
    const after = await transaction(
      restore,
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        return fingerprint(tx, expected);
      },
      { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 60000 }
    );
    matched = JSON.stringify(before) === JSON.stringify(after);
    tableCount = before.rows.length;
    rowCount = before.total;
  } catch {
    /* No native/Prisma errors or data enter receipts. */
  } finally {
    try {
      if (restore) await bounded(restore.$disconnect(), 5000);
    } catch {
      matched = false;
      safe = false;
    }
    try {
      if (source) await bounded(source.$disconnect(), 5000);
    } catch {
      matched = false;
      safe = false;
    }
    if (owned && safe) {
      try {
        await sql(run, pgEnv(plan.url, plan.source), `DROP DATABASE "${database}";`);
        databaseRemoved =
          (await sql(
            run,
            pgEnv(plan.url, plan.source),
            `SELECT count(*) FROM pg_database WHERE datname='${database}';`
          )) === '0';
      } catch {}
    }
    if (archiveOwned && safe) {
      try {
        fs.unlinkSync(file);
        fileRemoved = !fs.existsSync(file);
      } catch {}
    }
    if (directory && safe) {
      try {
        fs.rmdirSync(directory);
      } catch {
        fileRemoved = false;
      }
    }
  }
  return {
    scope: SCOPE,
    phase,
    ok: matched && databaseRemoved && fileRemoved,
    dumpComplete,
    snapshotRowsMatch: matched,
    tableCount,
    rowCount,
    migrations: matched ? MIGRATION_COUNT : 0,
    serverVersionNum,
    databaseCleanupVerified: databaseRemoved,
    archiveCleanupVerified: fileRemoved,
    possibleDatabaseOrphan: createdAttempted && !databaseRemoved,
    durationMs: Math.max(0, Date.now() - started),
    sequenceSnapshotProved: false,
    providerRetentionProved: false,
  };
}
async function main(args = process.argv.slice(2), env = process.env, dependencies = {}) {
  let reported = false;
  const timer = setTimeout(() => {
    for (const child of children) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }
    if (!reported) {
      reported = true;
      process.stdout.write(
        JSON.stringify({ scope: SCOPE, phase: 'deadline', ok: false, cleanupProved: false }) + '\n'
      );
    }
    process.exit(0);
  }, 240000);
  const result = await observe(args, env, dependencies);
  if (reported) return;
  reported = true;
  process.stdout.write(JSON.stringify(result) + '\n', () => {
    clearTimeout(timer);
    process.exit(0);
  });
}
if (require.main === module) void main();
module.exports = { guard, pgEnv, fingerprint, observe, main };
