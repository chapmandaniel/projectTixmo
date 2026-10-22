// Synthetic configured-image qualification only; never a target/customer backup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const SOURCE = 'tixmo_disposable_restore_source';
const RESTORE = 'tixmo_disposable_restore_destination';
const PG_IMAGE = 'ghcr.io/railwayapp-templates/postgres-ssl:18';
const REDIS_IMAGE = 'redis:8.2.9';
function guard(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.TIXMO_IMAGE_RESTORE, 'synthetic-only');
  for (const key of ['PG_CONTAINER', 'REDIS_CONTAINER']) assert.match(env[key] || '', /^[a-f0-9]{64}$/);
  assert.notEqual(env.PG_CONTAINER, env.REDIS_CONTAINER);
  const url = new URL(env.DATABASE_URL);
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.port, /^[0-9]+$/);
  assert.ok(Number(url.port) > 1024 && Number(url.port) <= 65535);
  assert.equal(url.username, 'tixmo_restore_ci');
  assert.equal(url.password, 'synthetic_restore_password');
  assert.equal(url.pathname, '/' + SOURCE);
  assert.equal(url.search, '?schema=public');
  assert.equal(url.hash, '');
  return url;
}
function verify(env = process.env, spawn = spawnSync) {
  const url = guard(env); // No tools/imported application code before validation.
  for (const file of ['../.env', '../tixmoapi2/.env', '../tixmoapi2/prisma/.env']) {
    assert.equal(fs.existsSync(path.join(__dirname, file)), false, 'Refuse inherited dotenv files');
  }
  const safeEnv = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', DATABASE_URL: url.href };
  function run(command, args, input) {
    const result = spawn(command, args, { env: safeEnv, input, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0 || result.signal) throw new Error('Synthetic restore tool failed');
    return result.stdout.trim();
  }
  const exec = (container, args, input) => run('docker', ['exec', '-i', container, ...args], input);
  const sql = (database, text) => exec(env.PG_CONTAINER, ['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-U', 'tixmo_restore_ci', '-d', database], text);
  function inspect(container, image, port) {
    const [data] = JSON.parse(run('docker', ['inspect', container]));
    assert.equal(data.Id, container);
    assert.equal(data.Config.Image, image);
    assert.equal(data.State.Running, true);
    assert.equal(data.State.Health.Status, 'healthy');
    assert.ok(data.Mounts.every(mount => mount.Type === 'volume' && /^[a-f0-9]{64}$/.test(mount.Name)), 'Only anonymous job volumes');
    const bindings = data.NetworkSettings.Ports[port + '/tcp'];
    assert.equal(bindings.length, 1);
    assert.equal(bindings[0].HostIp, '127.0.0.1');
    if (port === 5432) assert.equal(bindings[0].HostPort, url.port);
    const [metadata] = JSON.parse(run('docker', ['image', 'inspect', data.Image]));
    assert.match(data.Image, /^sha256:[a-f0-9]{64}$/);
    const digest = metadata.RepoDigests.find(value => value.startsWith(image.split(':')[0] + '@sha256:'));
    assert.match(digest || '', /@sha256:[a-f0-9]{64}$/);
    return { image, imageId: data.Image, digest };
  }
  const receipt = { scope: 'synthetic configured-image compatibility; not actual target backup/RTO/RPO', images: [inspect(env.PG_CONTAINER, PG_IMAGE, 5432), inspect(env.REDIS_CONTAINER, REDIS_IMAGE, 6379)] };
  receipt.postgres = sql(SOURCE, "SELECT current_setting('server_version_num');");
  assert.ok(Number(receipt.postgres) >= 180000 && Number(receipt.postgres) < 190000);
  assert.equal(sql(SOURCE, 'SHOW ssl;'), 'on');
  receipt.redis = exec(env.REDIS_CONTAINER, ['redis-server', '--version']);
  assert.match(receipt.redis, /\bv=8\.2\.9\b/);
  assert.equal(exec(env.REDIS_CONTAINER, ['redis-cli', 'PING']), 'PONG');
  receipt.tools = {};
  for (const tool of ['pg_dump', 'pg_restore']) {
    receipt.tools[tool] = exec(env.PG_CONTAINER, [tool, '--version']);
    assert.match(receipt.tools[tool], /\b18\./);
  }
  assert.equal(sql(SOURCE, 'SELECT current_database();'), SOURCE);
  assert.equal(sql(SOURCE, "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"), '0');
  const migrations = fs.readdirSync(path.join(__dirname, '../tixmoapi2/prisma/migrations')).filter(name => /^\d/.test(name)).sort();
  assert.equal(migrations.length, 33);
  assert.ok(migrations.includes('20261021120000_event_sales_pause'));
  assert.ok(migrations.includes('20261022143000_buyer_password_recovery'));
  run(process.execPath, [path.join(__dirname, '../tixmoapi2/node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(__dirname, '../tixmoapi2/prisma/schema.prisma')]);
  assert.equal(sql(SOURCE, 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;'), String(migrations.length));
  for (const migration of migrations) {
    assert.match(migration, /^[a-z0-9_]+$/);
    const checksum = createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../tixmoapi2/prisma/migrations', migration, 'migration.sql'))).digest('hex');
    assert.equal(sql(SOURCE, `SELECT checksum FROM _prisma_migrations WHERE migration_name='${migration}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;`), checksum);
  }
  sql(SOURCE, fs.readFileSync(path.join(__dirname, 'image-restore-fixture.sql'), 'utf8'));
  const assertions = fs.readFileSync(path.join(__dirname, 'image-restore-assertions.sql'), 'utf8');
  sql(SOURCE, assertions);
  // Sorted full-row fingerprints include every public table and all migration checksums.
  const snapshot = database => {
    const tables = sql(database, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;").split('\n');
    assert.ok(tables.length >= 33);
    return tables.map(table => {
      assert.match(table, /^[_a-z0-9]+$/);
      return [table, sql(database, `SELECT count(*) || ':' || md5(COALESCE(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text), '')) FROM public."${table}" t;`)];
    });
  };
  const before = snapshot(SOURCE);
  const started = performance.now();
  // Archive remains inside this job-owned container; no host paths or overwrite.
  exec(env.PG_CONTAINER, ['test', '!', '-e', '/tmp/tixmo-synthetic.dump']);
  exec(env.PG_CONTAINER, ['pg_dump', '-U', 'tixmo_restore_ci', '-d', SOURCE, '--format=custom', '--file=/tmp/tixmo-synthetic.dump']);
  receipt.archiveSha256 = exec(env.PG_CONTAINER, ['sha256sum', '/tmp/tixmo-synthetic.dump']).split(/\s+/)[0];
  assert.match(receipt.archiveSha256, /^[a-f0-9]{64}$/);
  receipt.dumpMs = Math.round(performance.now() - started);
  // Commit a new source write AFTER backup, before restoring elsewhere.
  sql(SOURCE, "INSERT INTO users (id,email,password_hash,first_name,last_name,updated_at) VALUES ('restore-after','restore-after@test.invalid','synthetic','After','Backup',now());");
  const sourceAfterWrite = snapshot(SOURCE);
  assert.notDeepEqual(sourceAfterWrite, before);
  assert.equal(sql(SOURCE, `SELECT count(*) FROM pg_database WHERE datname='${RESTORE}';`), '0');
  exec(env.PG_CONTAINER, ['createdb', '-U', 'tixmo_restore_ci', '--template=template0', RESTORE]);
  assert.equal(sql(RESTORE, 'SELECT current_database();'), RESTORE);
  assert.equal(sql(RESTORE, "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"), '0');
  const restoring = performance.now();
  exec(env.PG_CONTAINER, ['pg_restore', '-U', 'tixmo_restore_ci', '-d', RESTORE, '--exit-on-error', '--single-transaction', '/tmp/tixmo-synthetic.dump']);
  receipt.restoreMs = Math.round(performance.now() - restoring);
  sql(RESTORE, assertions);
  assert.deepEqual(snapshot(RESTORE), before);
  assert.deepEqual(snapshot(SOURCE), sourceAfterWrite);
  assert.equal(sql(RESTORE, "SELECT count(*) FROM users WHERE id='restore-after';"), '0');
  assert.equal(sql(SOURCE, "SELECT count(*) FROM users WHERE id='restore-after';"), '1');
  receipt.snapshotSha256 = createHash('sha256').update(JSON.stringify(before)).digest('hex');
  console.log(JSON.stringify({ ...receipt, migrations: migrations.length, restoredFingerprintMatch: true, sourcePostBackupWritePreserved: true }));
}
module.exports = { guard, verify, SOURCE, RESTORE, PG_IMAGE, REDIS_IMAGE };
if (require.main === module) {
  try { verify(); } catch { console.error('Synthetic image restore qualification failed; no target backup claim.'); process.exitCode = 1; }
}
