const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const apiRoot = path.join(__dirname, '..');
const valid = {
  NODE_ENV: 'development',
  TIXMO_ALLOW_DEV_DATA: 'true',
  TIXMO_DEV_DATABASE_URL: 'postgresql://fixture:private@127.0.0.1:55444/tixmo_test_helpers',
};

function loadBoundary(env) {
  const constructors = [];
  const exported = {};
  class PrismaClient {
    constructor(options) {
      constructors.push(options);
    }
  }
  const source = fs.readFileSync(path.join(apiRoot, 'prisma/utils/development-client.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports: exported,
    require: () => ({ PrismaClient }),
    process: { env },
    URL,
  });
  return { ...exported, constructors };
}

test('rejects unsafe targets before client construction and accepts explicit local controls', () => {
  for (const patch of [
    { NODE_ENV: 'production' },
    { NODE_ENV: '' },
    { TIXMO_ALLOW_DEV_DATA: '' },
    { TIXMO_DEV_DATABASE_URL: '' },
    { TIXMO_DEV_DATABASE_URL: 'not a URL' },
    { TIXMO_DEV_DATABASE_URL: 'https://127.0.0.1/tixmo_test_helpers' },
    {
      TIXMO_DEV_DATABASE_URL:
        'postgresql://fixture:private@production.example/tixmo_dev?schema=localhost',
    },
    {
      TIXMO_DEV_DATABASE_URL:
        'postgresql://fixture:localhost@production.example/tixmo_test_helpers',
    },
    { TIXMO_DEV_DATABASE_URL: 'postgresql://fixture:private@127.0.0.1/application' },
    {
      TIXMO_DEV_DATABASE_URL:
        'postgresql://fixture:private@127.0.0.1/tixmo_test_helpers?host=production.example',
    },
    {
      TIXMO_DEV_DATABASE_URL:
        'postgresql://fixture:private@127.0.0.1/tixmo_test_helpers#production',
    },
    { DATABASE_URL: 'postgresql://fixture:private@production.example/application' },
  ]) {
    const boundary = loadBoundary({ ...valid, ...patch });
    assert.throws(() => boundary.createDevelopmentClient());
    assert.equal(boundary.constructors.length, 0);
  }
  for (const url of [
    valid.TIXMO_DEV_DATABASE_URL,
    'postgresql://fixture:private@localhost:5432/tixmoapi?schema=public',
    'postgresql://fixture:private@[::1]/tixmo_dev_review',
  ]) {
    const env = { ...valid, TIXMO_DEV_DATABASE_URL: url, DATABASE_URL: url };
    const boundary = loadBoundary(env);
    const client = boundary.createDevelopmentClient();
    assert.equal(boundary.constructors[0].datasources.db.url, url);
    env.DATABASE_URL = 'postgresql://fixture:private@production.example/application';
    assert.doesNotThrow(() => boundary.assertDevelopmentClient(client));
    assert.throws(() => boundary.assertDevelopmentClient({}));
    assert.equal(boundary.constructors[0].datasources.db.url, url);
  }
});

test('every direct legacy entry refuses a production target before fixture writes', () => {
  const entrypoints = [
    ['scripts/dev-data.ts', 'reset'],
    ['scripts/dev-data.ts', 'populate'],
    ['prisma/seed.ts'],
    ['prisma/seed-approvals.ts'],
    ['scripts/generate-event-simulation.ts'],
  ];
  for (const args of entrypoints) {
    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', ...args],
      {
        cwd: apiRoot,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          TIXMO_ALLOW_DEV_DATA: 'true',
          TIXMO_DEV_DATABASE_URL: valid.TIXMO_DEV_DATABASE_URL,
          DATABASE_URL: valid.TIXMO_DEV_DATABASE_URL,
          SEED_CLEAN: 'true',
        },
        encoding: 'utf8',
        timeout: 15000,
      }
    );
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /Local database operations require/);
    assert.doesNotMatch(result.stderr, /fixture:private/);
  }
});

test('direct population and cleanup cannot bypass the guarded client boundary', async () => {
  require('ts-node').register({
    transpileOnly: true,
    project: path.join(apiRoot, 'tsconfig.json'),
  });
  const { populateDatabase } = require('./dev-data-populate.ts');
  const { cleanupDatabase } = require('../prisma/utils/cleanup.ts');
  const unsafe = new Proxy(
    {},
    {
      get() {
        throw new Error('Unexpected database sink');
      },
    }
  );
  await assert.rejects(populateDatabase(unsafe), /explicitly authorized local development target/);
  await assert.rejects(cleanupDatabase(unsafe), /explicitly authorized local development target/);
  const seeders = [
    ['01-users', 'seedUsers'],
    ['02-organizations', 'seedOrganizations'],
    ['03-venues', 'seedVenues'],
    ['04-events', 'seedEvents'],
    ['05-ticket-types', 'seedTicketTypes'],
    ['06-promo-codes', 'seedPromoCodes'],
    ['07-orders', 'seedOrders'],
    ['08-scanners', 'seedScanners'],
  ];
  for (const [name, method] of seeders) {
    const module = require(`../prisma/seeders/${name}.seeder.ts`);
    await assert.rejects(
      module[method](unsafe, [], [], [], [], []),
      /explicitly authorized local development target/
    );
  }
});

test('setup has valid syntax and makes migrations and service startup explicit', () => {
  assert.equal(spawnSync('bash', ['-n', path.join(apiRoot, 'scripts/setup.sh')]).status, 0);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-setup-control-'));
  try {
    fs.mkdirSync(path.join(temp, 'scripts'));
    fs.mkdirSync(path.join(temp, 'bin'));
    fs.copyFileSync(path.join(apiRoot, 'scripts/setup.sh'), path.join(temp, 'scripts/setup.sh'));
    fs.writeFileSync(path.join(temp, '.env.example'), 'NODE_ENV=development\n');
    const calls = path.join(temp, 'calls');
    for (const command of ['node', 'npm', 'docker', 'git']) {
      fs.writeFileSync(
        path.join(temp, 'bin', command),
        `#!/bin/sh\nprintf '%s\\n' '${command}' >> "$SETUP_CALLS"\n`,
        { mode: 0o755 }
      );
    }
    const env = {
      ...process.env,
      PATH: `${path.join(temp, 'bin')}:${process.env.PATH}`,
      SETUP_CALLS: calls,
    };
    assert.equal(
      spawnSync('bash', [path.join(temp, 'scripts/setup.sh'), '--help'], { env }).status,
      0
    );
    assert.equal(fs.existsSync(calls), false);
    assert.equal(spawnSync('bash', [path.join(temp, 'scripts/setup.sh')], { env }).status, 0);
    assert.deepEqual(fs.readFileSync(calls, 'utf8').trim().split('\n'), ['node', 'npm', 'npm']);
    assert.equal(fs.statSync(path.join(temp, '.env')).mode & 0o777, 0o600);
    fs.writeFileSync(calls, '');
    assert.equal(
      spawnSync('bash', [path.join(temp, 'scripts/setup.sh'), '--services', '--migrate'], { env })
        .status,
      0
    );
    assert.deepEqual(fs.readFileSync(calls, 'utf8').trim().split('\n'), [
      'node',
      'npm',
      'npm',
      'docker',
      'node',
    ]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
