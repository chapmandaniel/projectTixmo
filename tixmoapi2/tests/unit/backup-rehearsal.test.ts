export {};
import fs from 'node:fs';
import path from 'node:path';
const { guard, pgEnv, observe } = require('../../scripts/backup-rehearsal.cjs');
const env = {
  NODE_ENV: 'production',
  TIXMO_BACKUP_REHEARSAL: 'true',
  TIXMO_BACKUP_CI: 'synthetic-only',
  GITHUB_ACTIONS: 'true',
  DATABASE_URL:
    'postgresql://tixmo_restore_ci:synthetic_restore_password@127.0.0.1:49152/tixmo_disposable_restore_source?schema=public',
};
const expected = Array.from({ length: 33 }, (_, i) => ({
  name: `20261022${String(i).padStart(6, '0')}_synthetic`,
  checksum: 'a'.repeat(64),
}));
function harness(failure = '') {
  let active = false,
    created = false;
  const sqlQueries: string[] = [];
  const nativeCalls: any[] = [];
  function transaction(kind: string) {
    const query = jest.fn(async (text: string) => {
      await Promise.resolve();
      sqlQueries.push(text);
      if (text.includes("current_setting('server_version_num')"))
        return [
          {
            database: 'tixmo_disposable_restore_source',
            version: failure === 'server' ? '170000' : '180003',
            bytes: '123456',
            capable: failure !== 'capability',
          },
        ];
      if (text.includes("c.relkind='S'")) return [{ count: failure === 'sequence' ? '1' : '0' }];
      if (text.includes('c.relname::text AS name'))
        return [
          { name: '_prisma_migrations', kind: 'r' },
          { name: 'users', kind: 'r' },
        ];
      if (text.includes('migration_name AS name'))
        return expected.map((row, i) => ({
          ...row,
          checksum: failure === 'ledger' && i === 0 ? 'b'.repeat(64) : row.checksum,
          finished_at: new Date(0),
          rolled_back_at: null,
        }));
      if (text.includes('pg_export_snapshot')) return [{ snapshot: '00000003-0000001B-1' }];
      if (text.includes('encode(sha256'))
        return [
          {
            count: '1',
            hash: failure === 'mismatch' && kind === 'restore' ? 'b'.repeat(64) : 'c'.repeat(64),
          },
        ];
      if (text.startsWith('SELECT count(*)::text'))
        return [{ count: failure === 'rows' ? '100001' : '1' }];
      throw new Error('Unexpected query');
    });
    return {
      $executeRawUnsafe: jest.fn((text: string) => {
        sqlQueries.push(text);
        return Promise.resolve(0);
      }),
      $queryRawUnsafe: query,
    };
  }
  const sourceTx = transaction('source'),
    restoreTx = transaction('restore');
  const source = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn(async (callback: any, options: any) => {
      expect(options.isolationLevel).toBe('RepeatableRead');
      active = true;
      try {
        return await callback(sourceTx);
      } finally {
        active = false;
      }
    }),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const restore = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn((callback: any) => Promise.resolve(callback(restoreTx))),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const PrismaClient = jest
    .fn()
    .mockImplementation((options: any) =>
      options.datasources.db.url.includes('/tixmo_rehearsal_') ? restore : source
    );
  const native = jest.fn(async (program: string, args: string[], options: any) => {
    await Promise.resolve();
    nativeCalls.push({ program, args, options });
    if (args[0] === '--version')
      return path.basename(program) + ' (PostgreSQL) ' + (failure === 'client' ? '17.6' : '18.6');
    if (program.endsWith('/pg_dump')) {
      expect(active).toBe(true);
      expect(args).toContain('--snapshot=00000003-0000001B-1');
      expect(args).not.toContain('--schema=public');
      expect(args).not.toContain('--no-blobs');
      expect(sqlQueries[0]).toBe('SET TRANSACTION READ ONLY');
      if (failure === 'dump') throw new Error('private-dump-canary');
      fs.writeFileSync(options.file, 'synthetic-archive-only');
      return '';
    }
    if (program.endsWith('/pg_restore')) {
      expect(active).toBe(false);
      expect(options.env.PGDATABASE).toMatch(/^tixmo_rehearsal_[a-f0-9]{32}$/);
      expect(args).toContain('--dbname=' + options.env.PGDATABASE);
      if (failure === 'restore') throw new Error('private-restore-canary');
      return '';
    }
    if (program.endsWith('/psql')) {
      const sql = options.input;
      if (sql === 'SELECT current_database();')
        return failure === 'identity' ? 'tixmo_disposable_restore_source' : options.env.PGDATABASE;
      if (sql.startsWith('SELECT count(*) FROM pg_database'))
        return failure === 'existing' && !created ? '1' : created ? '1' : '0';
      if (sql.startsWith('CREATE DATABASE')) {
        created = true;
        if (failure === 'create') throw new Error('ambiguous-create');
        return 'CREATE DATABASE';
      }
      if (sql.startsWith('DROP DATABASE')) {
        if (failure === 'drop') throw new Error('private-drop-canary');
        created = false;
        return 'DROP DATABASE';
      }
    }
    throw new Error('Unexpected tool');
  });
  return {
    deps: { PrismaClient, native, migrations: () => expected },
    nativeCalls,
    sqlQueries,
    source,
    restore,
    sourceTx,
    created: () => created,
  };
}
beforeAll(() => fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true }));
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it.each(['', undefined, 'false', 'TRUE'])(
  'nonoptin imports no clients/runs no tools %s',
  async (flag) => {
    const h = harness();
    expect(await observe([], { ...env, TIXMO_BACKUP_REHEARSAL: flag }, h.deps)).toEqual({
      scope: 'task603-snapshot-logical-roundtrip',
      skipped: true,
    });
    expect(h.deps.native).not.toHaveBeenCalled();
    expect(h.deps.PrismaClient).not.toHaveBeenCalled();
  }
);
it.each([
  { NODE_ENV: 'test' },
  { GITHUB_ACTIONS: 'false' },
  { DATABASE_URL: env.DATABASE_URL.replace('127.0.0.1', 'remote.invalid') },
  { DATABASE_URL: env.DATABASE_URL.replace('tixmo_disposable_restore_source', 'railway') },
  { DATABASE_URL: env.DATABASE_URL.replace('synthetic_restore_password', 'foreign') },
  { TIXMO_BACKUP_CI: 'unknown' },
])('rejects unsafe CI configuration %j', async (change) => {
  const h = harness();
  expect(await observe([], { ...env, ...change }, h.deps)).toMatchObject({
    ok: false,
    phase: 'guard',
    possibleDatabaseOrphan: false,
  });
  expect(h.deps.native).not.toHaveBeenCalled();
});
it('requires exact live project/environment/API guard and never accepts arbitrary arguments', () => {
  expect(() => guard(['--restore=existing'], env)).toThrow();
  expect(() => guard([], { ...env, TIXMO_BACKUP_CI: undefined })).toThrow();
  const live = {
    ...env,
    TIXMO_BACKUP_CI: undefined,
    RAILWAY_PROJECT_ID: 'c1c17660-3110-4fa8-a0bd-aca06d13a3ed',
    RAILWAY_ENVIRONMENT_ID: 'dd8e0541-0e1d-478d-bec1-1f6bb7be1e2d',
    RAILWAY_SERVICE_ID: '13efc131-9ae3-4305-9628-55c783286990',
    TIXMO_BACKUP_EXPECTED_DATABASE_HOST: '127.0.0.1',
    TIXMO_BACKUP_EXPECTED_DATABASE_NAME: 'tixmo_disposable_restore_source',
  };
  expect(guard([], live).source).toBe('tixmo_disposable_restore_source');
  expect(() =>
    guard([], { ...live, TIXMO_BACKUP_EXPECTED_DATABASE_HOST: 'foreign.invalid' })
  ).toThrow();
  expect(() => guard([], { ...live, TIXMO_BACKUP_EXPECTED_DATABASE_NAME: 'foreign' })).toThrow();
  expect(() => guard([], { ...live, TIXMO_BACKUP_EXPECTED_DATABASE_HOST: undefined })).toThrow();
});
it('native child environment is scrubbed and credentials never become arguments', () => {
  const value = pgEnv(new URL(env.DATABASE_URL), 'owned');
  expect(value.PGPASSWORD).toBe('synthetic_restore_password');
  expect(value.PGDATABASE).toBe('owned');
  expect(value.PGPASSFILE).toBe('/dev/null');
  expect(value.PGSERVICEFILE).toBe('/dev/null');
  expect(value.PGOPTIONS).toBe('-c statement_timeout=10000 -c lock_timeout=2000');
  expect(value.HOME).toBeUndefined();
  expect(value.DATABASE_URL).toBeUndefined();
  expect(value.AWS_PROFILE).toBeUndefined();
});
it('snapshot fingerprints and native dump share held read-only transaction; only owned restore is mutated and cleaned', async () => {
  const h = harness();
  const result = await observe([], env, h.deps);
  expect(result).toMatchObject({
    ok: true,
    dumpComplete: true,
    snapshotRowsMatch: true,
    tableCount: 2,
    rowCount: 2,
    migrations: 33,
    databaseCleanupVerified: true,
    archiveCleanupVerified: true,
    possibleDatabaseOrphan: false,
    sequenceSnapshotProved: false,
  });
  expect(h.created()).toBe(false);
  expect(h.source.$transaction).toHaveBeenCalledTimes(1);
  expect(h.source.$disconnect).toHaveBeenCalledTimes(1);
  expect(h.restore.$disconnect).toHaveBeenCalledTimes(1);
  for (const text of h.sqlQueries) expect(text).not.toMatch(/^(INSERT|UPDATE|DELETE|CREATE|DROP)/);
  for (const call of h.nativeCalls)
    expect(JSON.stringify(call.args)).not.toContain('synthetic_restore_password');
  expect(JSON.stringify(result)).not.toMatch(/private|tixmo_rehearsal_|\.dump|[a-f0-9]{64}/);
  const dump = h.nativeCalls.find(
    (row) => row.program.endsWith('/pg_dump') && row.args[0] !== '--version'
  );
  expect(fs.existsSync(dump.options.file)).toBe(false);
});
it.each([
  'client',
  'server',
  'capability',
  'ledger',
  'sequence',
  'rows',
  'dump',
  'existing',
  'create',
  'restore',
  'identity',
  'mismatch',
  'drop',
])('fails closed at %s without overwriting or dropping source', async (failure) => {
  const h = harness(failure);
  const result = await observe([], env, h.deps);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain('private');
  const drops = h.nativeCalls.filter((row) => row.options.input?.startsWith('DROP DATABASE'));
  for (const drop of drops) {
    expect(drop.options.input).toMatch(/^DROP DATABASE "tixmo_rehearsal_[a-f0-9]{32}";$/);
    expect(drop.options.input).not.toContain('tixmo_disposable_restore_source');
  }
  if (
    [
      'client',
      'server',
      'capability',
      'ledger',
      'sequence',
      'rows',
      'dump',
      'existing',
      'create',
    ].includes(failure)
  )
    expect(drops).toHaveLength(0);
  if (failure === 'create') expect(result.possibleDatabaseOrphan).toBe(true);
  if (failure === 'restore' || failure === 'mismatch')
    expect(result).toMatchObject({ databaseCleanupVerified: true, archiveCleanupVerified: true });
  if (failure === 'rows') {
    const hashed = h.sqlQueries.filter((text) => text.includes('encode(sha256'));
    expect(hashed).toHaveLength(0);
  }
  if (failure === 'drop')
    expect(result).toMatchObject({ possibleDatabaseOrphan: true, databaseCleanupVerified: false });
});
it('failed client cleanup preserves owned context instead of racing a live client', async () => {
  jest.useFakeTimers();
  const h = harness();
  h.restore.$disconnect.mockReturnValue(new Promise(() => {}));
  const work = observe([], env, h.deps);
  await jest.advanceTimersByTimeAsync(5001);
  const result = await work;
  const archive = h.nativeCalls.find(
    (row) => row.program.endsWith('/pg_dump') && row.args[0] !== '--version'
  ).options.file;
  try {
    expect(result).toMatchObject({
      ok: false,
      databaseCleanupVerified: false,
      archiveCleanupVerified: false,
      possibleDatabaseOrphan: true,
    });
    expect(
      h.nativeCalls.filter((row) => row.options.input?.startsWith('DROP DATABASE'))
    ).toHaveLength(0);
    expect(fs.existsSync(archive)).toBe(true);
  } finally {
    fs.rmSync(path.dirname(archive), { recursive: true, force: true });
    jest.useRealTimers();
  }
});
it('transaction timeout joins its actual dump callback before archive cleanup and never creates a restore database', async () => {
  jest.useFakeTimers();
  const h = harness();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = h.deps.native.getMockImplementation()!;
  h.deps.native.mockImplementation(async (program: string, args: string[], options: any) => {
    const value = await original(program, args, options);
    if (program.endsWith('/pg_dump') && args[0] !== '--version') await gate;
    return value;
  });
  const transaction = h.source.$transaction.getMockImplementation()!;
  h.source.$transaction.mockImplementation(
    (callback: any, options: any) =>
      Promise.race([
        transaction(callback, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Synthetic transaction deadline')), 20)
        ),
      ]) as any
  );
  const work = observe([], env, h.deps);
  await jest.advanceTimersByTimeAsync(21);
  const archive = h.nativeCalls.find(
    (row) => row.program.endsWith('/pg_dump') && row.args[0] !== '--version'
  ).options.file;
  expect(fs.existsSync(archive)).toBe(true);
  expect(h.source.$disconnect).not.toHaveBeenCalled();
  release();
  const result = await work;
  expect(result.ok).toBe(false);
  expect(result.archiveCleanupVerified).toBe(true);
  expect(
    h.nativeCalls.filter((row) => row.options.input?.startsWith('CREATE DATABASE'))
  ).toHaveLength(0);
  jest.useRealTimers();
});
it('specific hosted qualification builds and executes the actual production helper against only existing job services', () => {
  const root = path.resolve(__dirname, '../../..');
  const docker = fs.readFileSync(path.join(root, 'tixmoapi2/Dockerfile'), 'utf8');
  const workflow = fs.readFileSync(
    path.join(root, '.github/workflows/market-readiness-local.yml'),
    'utf8'
  );
  const worker = fs.readFileSync(path.join(root, 'tixmoapi2/scripts/backup-rehearsal.cjs'), 'utf8');
  expect(docker).toContain('apk add --no-cache postgresql18-client');
  expect(docker).not.toContain('alpine/edge');
  expect(docker).toContain('COPY scripts/backup-rehearsal.cjs ./scripts/backup-rehearsal.cjs');
  expect(workflow).toContain('docker build --tag tixmo-task603-production:ci tixmoapi2');
  expect(workflow).toContain('--env TIXMO_BACKUP_CI=synthetic-only');
  expect(workflow).toContain('--env DATABASE_URL');
  expect(workflow).toContain('docker start --attach "$owned_container"');
  expect(workflow).toContain('databaseCleanupVerified');
  expect(workflow).toContain('archiveCleanupVerified');
  expect(worker).not.toMatch(
    /--clean|--schema=public|--no-blobs|pg_dumpall|migrate|seed|console\.(log|error)/
  );
});
it('build guard accepts only matching stable Alpine repositories without inventing a fixed minor release', () => {
  const vm = require('node:vm');
  const docker = fs.readFileSync(path.resolve(__dirname, '../../Dockerfile'), 'utf8');
  const script = docker.match(/RUN node -e "([^"]+)"/)![1];
  const evaluate = (release: string, repo: string) =>
    vm.runInNewContext(script, {
      require: () => ({
        readFileSync: (file: string) => (file.endsWith('release') ? release : repo),
      }),
      URL,
      console: { log: jest.fn() },
    });
  expect(() =>
    evaluate('3.23.1', 'https://dl-cdn.alpinelinux.org/alpine/v3.23/main\n')
  ).not.toThrow();
  expect(() =>
    evaluate('3.24.1', 'https://dl-cdn.alpinelinux.org/alpine/v3.24/main\n')
  ).not.toThrow();
  expect(() => evaluate('3.24.1', 'https://dl-cdn.alpinelinux.org/alpine/edge/main\n')).toThrow();
  expect(() => evaluate('3.24.1', 'https://dl-cdn.alpinelinux.org/alpine/v3.23/main\n')).toThrow();
});
it('CLI failure remains nonblocking and hard deadline emits only one receipt', async () => {
  jest.useFakeTimers();
  const { main } = require('../../scripts/backup-rehearsal.cjs');
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const output = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  await main(['invalid'], env);
  await jest.advanceTimersByTimeAsync(240001);
  expect(exit).toHaveBeenCalledWith(0);
  expect(output).toHaveBeenCalledTimes(1);
});
