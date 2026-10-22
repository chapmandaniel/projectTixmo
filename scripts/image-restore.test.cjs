// Offline guards/contracts only: these tests never start Docker, SQL or services.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { guard, verify, SOURCE, RESTORE, PG_IMAGE, REDIS_IMAGE } = require('./verify-image-restore.cjs');
const valid = {
  GITHUB_ACTIONS: 'true', TIXMO_IMAGE_RESTORE: 'synthetic-only',
  PG_CONTAINER: 'a'.repeat(64), REDIS_CONTAINER: 'b'.repeat(64),
  DATABASE_URL: `postgresql://tixmo_restore_ci:synthetic_restore_password@127.0.0.1:49152/${SOURCE}?schema=public`,
};
test('only explicit CI loopback source identity is admitted', () => {
  assert.equal(guard(valid).pathname, '/' + SOURCE);
  assert.notEqual(SOURCE, RESTORE);
});
for (const [name, mutation] of [
  ['no opt-in', { TIXMO_IMAGE_RESTORE: '' }], ['not CI', { GITHUB_ACTIONS: '' }],
  ['foreign container', { PG_CONTAINER: 'arbitrary-name' }],
  ['shared container', { REDIS_CONTAINER: valid.PG_CONTAINER }],
  ...[
    ['remote', valid.DATABASE_URL.replace('127.0.0.1', 'remote.invalid')],
    ['original app database', valid.DATABASE_URL.replace(SOURCE, 'railway')],
    ['restore as source', valid.DATABASE_URL.replace(SOURCE, RESTORE)],
    ['foreign credential', valid.DATABASE_URL.replace('synthetic_restore_password', 'foreign')],
    ['options', valid.DATABASE_URL + '&options=unexpected'],
    ['fragment', valid.DATABASE_URL + '#unexpected'],
    ['privileged port', valid.DATABASE_URL.replace('49152', '543')],
  ].map(([name, DATABASE_URL]) => [name, { DATABASE_URL }]),
]) test(`reject ${name} before tools`, () => {
  let calls = 0;
  assert.throws(() => verify({ ...valid, ...mutation }, () => { calls++; }));
  assert.equal(calls, 0);
});
test('wrong configured image, failed tool and missing digest fail before SQL/migration', () => {
  for (const mode of ['wrong-image', 'failed-tool', 'missing-digest']) {
    const calls = [];
    assert.throws(() => verify(valid, (command, args, options) => {
      calls.push(args);
      assert.equal(command, 'docker');
      assert.equal(options.env.STRIPE_SECRET_KEY, undefined);
      assert.equal(options.env.PGOPTIONS, undefined);
      if (mode === 'failed-tool') return { status: 1, stdout: '', stderr: 'DO NOT EMIT' };
      const data = args[0] === 'inspect' ? [{
        Id: valid.PG_CONTAINER, Config: { Image: mode === 'wrong-image' ? 'postgres:14' : PG_IMAGE },
        Mounts: [], State: { Running: true, Health: { Status: 'healthy' } }, Image: 'sha256:' + 'c'.repeat(64),
        NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '49152' }] } },
      }] : [{ RepoDigests: [] }];
      return { status: 0, stdout: JSON.stringify(data) };
    }));
    assert.ok(calls.every(args => args[0] === 'inspect' || args[0] === 'image'));
  }
});
const workflow = fs.readFileSync('.github/workflows/market-readiness-local.yml', 'utf8');
function contract(text) {
  const job = text.split('\n  configured-image-restore:\n')[1];
  assert.ok(job);
  for (const exact of [PG_IMAGE, REDIS_IMAGE, 'PGDATA: /var/lib/postgresql/data/pgdata',
    "'127.0.0.1::5432'", "'127.0.0.1::6379'", 'timeout-minutes: 15',
    'PG_CONTAINER: ${{ job.services.postgres.id }}', 'REDIS_CONTAINER: ${{ job.services.redis.id }}',
    'TIXMO_IMAGE_RESTORE: synthetic-only', `/${SOURCE}?schema=public`,
    'run: node --test scripts/image-restore.test.cjs', 'run: node scripts/verify-image-restore.cjs',
    'if: always()', 'docker rm --force --volumes "$PG_CONTAINER" "$REDIS_CONTAINER"',
    '! docker inspect "$PG_CONTAINER" "$REDIS_CONTAINER"',
  ]) assert.ok(job.includes(exact), `missing ${exact}`);
  assert.doesNotMatch(job, /secrets\.|--env-file|container_name:|volumes:|docker system prune|docker volume prune|postgres:14|redis:7/);
  assert.match(text.split('\n  configured-image-restore:\n')[0], /run: npm run verify:market/);
}
test('separate configured-image job preserves existing gates and always owned cleanup', () => contract(workflow));
for (const marker of [PG_IMAGE, REDIS_IMAGE, 'PGDATA: /var/lib/postgresql/data/pgdata',
  'if: always()', 'TIXMO_IMAGE_RESTORE: synthetic-only', 'docker rm --force --volumes',
  'PG_CONTAINER: ${{ job.services.postgres.id }}']) {
  test(`workflow refuses removed contract ${marker}`, () => assert.throws(() => contract(workflow.replaceAll(marker, 'REMOVED'))));
}
test('restore source uses a new empty destination, exact snapshots and post-backup writes', () => {
  const source = fs.readFileSync('scripts/verify-image-restore.cjs', 'utf8');
  assert.ok(source.indexOf('guard(env)') < source.indexOf('const url = guard(env)'));
  assert.match(source, /assert\.equal\(migrations\.length, 32\)/);
  assert.match(source, /--template=template0/);
  assert.match(source, /--exit-on-error/);
  assert.match(source, /--single-transaction/);
  assert.doesNotMatch(source, /--clean|dropdb|DROP DATABASE|migrate.*reset/);
  assert.ok(source.indexOf("['pg_dump'") < source.indexOf("INSERT INTO users"));
  assert.ok(source.indexOf("INSERT INTO users") < source.indexOf("['pg_restore'"));
  assert.match(source, /assert\.deepEqual\(snapshot\(RESTORE\), before\)/);
  assert.match(source, /assert\.deepEqual\(snapshot\(SOURCE\), sourceAfterWrite\)/);
  assert.match(source, /attempt_generation|image-restore-assertions\.sql/);
});
test('mocked restore protocol preserves later source writes and detects changed restored rows', () => {
  for (const corrupt of [false, true]) {
    let dumped = false, wrote = false, created = false, restored = false;
    const calls = [];
    const run = (command, args, options) => {
      calls.push([command, args]);
      const ok = stdout => ({ status: 0, stdout });
      assert.equal(options.env.STRIPE_SECRET_KEY, undefined);
      if (command === process.execPath) return ok('deployed');
      assert.equal(command, 'docker');
      if (args[0] === 'inspect') {
        const pg = args[1] === valid.PG_CONTAINER;
        return ok(JSON.stringify([{
          Id: args[1], Config: { Image: pg ? PG_IMAGE : REDIS_IMAGE }, Mounts: [],
          State: { Running: true, Health: { Status: 'healthy' } }, Image: 'sha256:' + (pg ? 'c' : 'd').repeat(64),
          NetworkSettings: { Ports: { [pg ? '5432/tcp' : '6379/tcp']: [{ HostIp: '127.0.0.1', HostPort: pg ? '49152' : '49153' }] } },
        }]));
      }
      if (args[0] === 'image') return ok(JSON.stringify([{ RepoDigests: [(args[2].includes('c'.repeat(64)) ? PG_IMAGE : REDIS_IMAGE).split(':')[0] + '@sha256:' + 'e'.repeat(64)] }]));
      const tool = args[3];
      if (tool === 'redis-server') return ok('Redis server v=8.2.9');
      if (tool === 'redis-cli') return ok('PONG');
      if (args.includes('--version')) return ok(tool + ' (PostgreSQL) 18.6');
      if (tool === 'test') { assert.equal(dumped, false); return ok(''); }
      if (tool === 'pg_dump') { assert.equal(wrote, false); dumped = true; return ok(''); }
      if (tool === 'sha256sum') return ok('f'.repeat(64) + '  /tmp/tixmo-synthetic.dump');
      if (tool === 'createdb') { assert.equal(wrote, true); assert.equal(created, false); created = true; return ok(''); }
      if (tool === 'pg_restore') { assert.ok(created && dumped && wrote); restored = true; return ok(''); }
      assert.equal(tool, 'psql');
      const sql = options.input, database = args.at(-1);
      if (sql.includes("current_setting('server_version_num')")) return ok('180006');
      if (sql === 'SHOW ssl;') return ok('on');
      if (sql.includes('current_database()')) return ok(database);
      if (sql.includes('information_schema.tables')) return ok('0');
      if (sql.includes('SELECT count(*) FROM _prisma_migrations')) return ok('32');
      if (sql.includes('SELECT checksum')) {
        const migration = sql.match(/migration_name='([^']+)'/)[1];
        return ok(require('node:crypto').createHash('sha256').update(fs.readFileSync('tixmoapi2/prisma/migrations/' + migration + '/migration.sql')).digest('hex'));
      }
      if (sql.includes('FROM pg_tables')) return ok(Array.from({ length: 33 }, (_, i) => 't' + i).join('\n'));
      if (sql.includes('string_agg')) return ok(database === SOURCE && wrote ? '1:after' : database === RESTORE && corrupt ? '1:corrupt' : '1:before');
      if (sql.startsWith('INSERT INTO users')) { assert.equal(dumped, true); wrote = true; return ok(''); }
      if (sql.includes('FROM pg_database')) return ok('0');
      if (sql.includes("id='restore-after'")) return ok(database === SOURCE ? '1' : '0');
      return ok(''); // Inert fixture and invariant DO block.
    };
    const originalLog = console.log;
    console.log = () => {};
    try {
      if (corrupt) assert.throws(() => verify(valid, run));
      else verify(valid, run);
    } finally { console.log = originalLog; }
    assert.ok(dumped && wrote && created && restored);
    assert.ok(calls.every(([, args]) => !args.includes('--clean')));
  }
});
