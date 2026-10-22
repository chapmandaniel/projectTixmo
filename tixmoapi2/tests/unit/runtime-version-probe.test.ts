const { guard, versions, observe, main } = require('../../scripts/runtime-version-probe.cjs');
const env = {
  NODE_ENV: 'production',
  TIXMO_RUNTIME_VERSION_PROBE: 'true',
  DATABASE_URL: 'postgresql://synthetic:canary@db.test/owned',
  REDIS_URL: 'redis://synthetic:canary@redis.test:6379/0',
};
const scope = 'runtime-postgresql-redis-versions-only';
function harness() {
  const db = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ version: '180003' }]),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const redis = {
    isOpen: true,
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    info: jest.fn().mockResolvedValue('# Server\r\nredis_version:8.2.9\r\nsecret:canary\r\n'),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const PrismaClient = jest.fn().mockImplementation(() => db);
  const createClient = jest.fn().mockReturnValue(redis);
  return { db, redis, deps: { PrismaClient, createClient } };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it.each([
  { NODE_ENV: 'test' },
  { TIXMO_RUNTIME_VERSION_PROBE: 'TRUE' },
  { TIXMO_RUNTIME_VERSION_PROBE: undefined },
  { DATABASE_URL: 'https://canary.invalid' },
  { DATABASE_URL: '' },
  { REDIS_URL: 'https://canary.invalid' },
  { REDIS_URL: 'redis://host/#canary' },
  { DATABASE_URL: 'postgresql://host/db\n' },
])('rejects configuration before dependency load %j', async (change) => {
  const h = harness();
  expect(await observe([], { ...env, ...change }, h.deps)).toEqual({
    ok: false,
    scope,
    phase: 'guard',
  });
  expect(h.deps.PrismaClient).not.toHaveBeenCalled();
  expect(h.deps.createClient).not.toHaveBeenCalled();
});
it('rejects arguments before clients', async () => {
  const h = harness();
  expect(() => guard(['--apply'], env)).toThrow('Rejected');
  expect(await observe(['--apply'], env, h.deps)).toMatchObject({ phase: 'guard', ok: false });
  expect(h.deps.PrismaClient).not.toHaveBeenCalled();
});
it('uses only fixed read SQL and INFO server, no retries, and projects only versions', async () => {
  const h = harness();
  expect(await observe([], env, h.deps)).toEqual({
    ok: true,
    scope,
    postgresqlVersionNum: 180003,
    redisVersion: '8.2.9',
  });
  expect(h.deps.PrismaClient).toHaveBeenCalledWith({
    datasources: { db: { url: env.DATABASE_URL } },
    log: [],
  });
  expect(h.deps.createClient).toHaveBeenCalledWith({
    url: env.REDIS_URL,
    disableOfflineQueue: true,
    commandsQueueMaxLength: 1,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
  });
  expect(h.db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  expect(h.db.$queryRawUnsafe).toHaveBeenCalledWith(
    "SELECT current_setting('server_version_num') AS version"
  );
  expect(h.redis.info).toHaveBeenCalledTimes(1);
  expect(h.redis.info).toHaveBeenCalledWith('server');
  expect(h.db.$connect).toHaveBeenCalledTimes(1);
  expect(h.redis.connect).toHaveBeenCalledTimes(1);
  expect(h.redis.disconnect).toHaveBeenCalledTimes(1);
  expect(h.db.$disconnect).toHaveBeenCalledTimes(1);
});
it.each([
  [[], 'redis_version:8.2.9'],
  [[{ version: '180003', secret: 'canary' }], 'redis_version:8.2.9'],
  [[{ version: 180003 }], 'redis_version:8.2.9'],
  [[{ version: '180003\n' }], 'redis_version:8.2.9'],
  [[{ version: '180003' }], 'redis_version:8.2.9\nredis_version:7.0.0'],
  [[{ version: '180003' }], 'redis_version:8.2.9-canary'],
  [[{ version: '180003' }], 'x'.repeat(65537)],
  [[{ version: '180003' }], 'redis_version:8.2.9\n' + 'é'.repeat(33000)],
])('rejects malformed/ambiguous/oversize response projection', (rows, info) =>
  expect(() => versions(rows, info)).toThrow('Rejected')
);
it.each(['postgres-connect', 'postgres-version', 'redis-connect', 'redis-version'])(
  'fails closed without leaking operation errors at %s',
  async (phase) => {
    const h = harness();
    const error = new Error('canary endpoint secret rawINFO');
    if (phase === 'postgres-connect') h.db.$connect.mockRejectedValue(error);
    if (phase === 'postgres-version') h.db.$queryRawUnsafe.mockRejectedValue(error);
    if (phase === 'redis-connect') h.redis.connect.mockRejectedValue(error);
    if (phase === 'redis-version') h.redis.info.mockRejectedValue(error);
    expect(await observe([], env, h.deps)).toEqual({ ok: false, scope, phase });
    expect(h.db.$disconnect).toHaveBeenCalledTimes(1);
    expect(h.redis.disconnect).toHaveBeenCalledTimes(1);
  }
);
it('redis error event refuses success without echoing the error', async () => {
  const h = harness();
  h.redis.info.mockImplementation(() => {
    h.redis.on.mock.calls[0][1](new Error('canary'));
    return Promise.resolve('redis_version:8.2.9');
  });
  expect(await observe([], env, h.deps)).toEqual({ ok: false, scope, phase: 'validate' });
});
it.each(['postgres', 'redis'])(
  'cleanup failure cannot report success, both clients attempted: %s',
  async (client) => {
    const h = harness();
    (client === 'postgres' ? h.db.$disconnect : h.redis.disconnect).mockRejectedValue(
      new Error('privatecanary')
    );
    expect(await observe([], env, h.deps)).toEqual({ ok: false, scope, phase: 'cleanup' });
    expect(h.db.$disconnect).toHaveBeenCalledTimes(1);
    expect(h.redis.disconnect).toHaveBeenCalledTimes(1);
  }
);
it('operation timeout fails, joins cleanup and never advances to another command', async () => {
  jest.useFakeTimers();
  const h = harness();
  h.db.$queryRawUnsafe.mockReturnValue(new Promise(() => {}));
  const work = observe([], env, h.deps);
  await jest.advanceTimersByTimeAsync(3001);
  expect(await work).toEqual({ ok: false, scope, phase: 'postgres-version' });
  expect(h.redis.connect).not.toHaveBeenCalled();
  expect(h.db.$disconnect).toHaveBeenCalledTimes(1);
});
it('cleanup timeout fails and still attempts other cleanup', async () => {
  jest.useFakeTimers();
  const h = harness();
  h.redis.disconnect.mockReturnValue(new Promise(() => {}));
  const work = observe([], env, h.deps);
  await jest.advanceTimersByTimeAsync(2001);
  expect(await work).toEqual({ ok: false, scope, phase: 'cleanup' });
  expect(h.db.$disconnect).toHaveBeenCalledTimes(1);
});
it('CLI rejects before dependencies and terminates after only the fixed receipt', async () => {
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const output = jest.spyOn(process.stdout, 'write').mockImplementation(((
    _value: string,
    callback: () => void
  ) => {
    callback();
    return true;
  }) as any);
  await main(['canary'], env);
  expect(output).toHaveBeenCalledWith(
    JSON.stringify({ ok: false, scope, phase: 'guard' }) + '\n',
    expect.any(Function)
  );
  expect(exit).toHaveBeenCalledWith(1);
});
it('CLI exits failure after operation and cleanup deadlines despite permanently pending client work', async () => {
  jest.useFakeTimers();
  const h = harness();
  h.db.$queryRawUnsafe.mockReturnValue(new Promise(() => {}));
  h.db.$disconnect.mockReturnValue(new Promise(() => {}));
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const output = jest.spyOn(process.stdout, 'write').mockImplementation(((
    _value: string,
    callback: () => void
  ) => {
    callback();
    return true;
  }) as any);
  const work = main([], env, h.deps);
  await jest.advanceTimersByTimeAsync(5001);
  await work;
  expect(output).toHaveBeenCalledTimes(1);
  expect(output).toHaveBeenCalledWith(
    JSON.stringify({ ok: false, scope, phase: 'cleanup' }) + '\n',
    expect.any(Function)
  );
  expect(exit).toHaveBeenCalledTimes(1);
  expect(exit).toHaveBeenCalledWith(1);
  await jest.advanceTimersByTimeAsync(20000);
  expect(output).toHaveBeenCalledTimes(1);
});
it('CLI hard ceiling still terminates when receipt output callback never completes', async () => {
  jest.useFakeTimers();
  const h = harness();
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const output = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  await main([], env, h.deps);
  expect(exit).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(20001);
  expect(exit).toHaveBeenCalledWith(1);
  expect(output).toHaveBeenCalledTimes(1);
});
it('packages the guarded standalone observer and retains a hard CLI deadline', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../../..');
  const source = fs.readFileSync(
    path.join(root, 'tixmoapi2/scripts/runtime-version-probe.cjs'),
    'utf8'
  );
  const docker = fs.readFileSync(path.join(root, 'tixmoapi2/Dockerfile'), 'utf8');
  expect(docker).toContain(
    'COPY scripts/runtime-version-probe.cjs ./scripts/runtime-version-probe.cjs'
  );
  expect(source).not.toMatch(/require\(['"](?:dotenv|.*config\/|.*app)/);
  expect(source).toContain('20000');
  expect(source).toContain('process.exit(1)');
});
