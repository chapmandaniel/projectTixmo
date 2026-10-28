jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: { $queryRaw: jest.fn(() => new Promise(() => undefined)) },
}));
jest.mock('../../src/services/readiness-db', () => ({
  queryReadinessDatabase: jest.fn().mockResolvedValue([{ value: 1 }]),
  warmReadinessDatabase: jest.fn(),
}));
jest.mock('../../src/config/redis', () => ({ getRedisClient: jest.fn() }));

describe('Dependency readiness', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => jest.useRealTimers());
  const setup = () => {
    const prisma = require('../../src/config/prisma').default;
    const { queryReadinessDatabase } = require('../../src/services/readiness-db');
    const { getRedisClient } = require('../../src/config/redis');
    const redis = { isReady: true, ping: jest.fn().mockResolvedValue('PONG') };
    getRedisClient.mockReturnValue(redis);
    const readiness = require('../../src/services/readiness.service');
    return { prisma, redis, queryReadinessDatabase, ...readiness };
  };
  it('requires successful database and Redis checks and caches only a short-lived result', async () => {
    const { queryReadinessDatabase, redis, checkReadiness } = setup();
    expect(await checkReadiness()).toEqual({ database: true, redis: true });
    expect(await checkReadiness()).toEqual({ database: true, redis: true });
    expect(queryReadinessDatabase).toHaveBeenCalledTimes(1);
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });
  it('reports a down database as not ready without returning internal connection details', async () => {
    const { queryReadinessDatabase, checkReadiness, readinessHttpStatus } = setup();
    queryReadinessDatabase.mockRejectedValue(new Error('private connection details'));
    const checks = await checkReadiness();
    expect(checks).toEqual({ database: false, redis: true });
    expect(JSON.stringify(checks)).not.toContain('private');
    expect(readinessHttpStatus(checks)).toBe(503);
  });
  it('does not enqueue a ping when Redis is disconnected', async () => {
    const { redis, checkReadiness, readinessHttpStatus } = setup();
    redis.isReady = false;
    const checks = await checkReadiness();
    expect(checks).toEqual({ database: true, redis: false });
    expect(redis.ping).not.toHaveBeenCalled();
    expect(readinessHttpStatus(checks)).toBe(503);
  });
  it('returns immediately from the dedicated probe while the application pool is saturated', async () => {
    const { prisma, queryReadinessDatabase, checkReadiness, readinessHttpStatus } = setup();
    const started = Date.now();
    const checks = await checkReadiness();
    expect(Date.now() - started).toBeLessThan(500);
    expect(checks).toEqual({ database: true, redis: true });
    expect(readinessHttpStatus(checks)).toBe(200);
    expect(queryReadinessDatabase).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it('bounds a stalled dedicated probe and does not start another query', async () => {
    jest.useFakeTimers();
    const { prisma, queryReadinessDatabase, checkReadiness } = setup();
    queryReadinessDatabase.mockReturnValue(new Promise(() => undefined));
    const first = checkReadiness();
    const second = checkReadiness();
    await jest.advanceTimersByTimeAsync(2001);
    expect(await first).toEqual({ database: null, redis: true });
    expect(await second).toEqual({ database: null, redis: true });
    const third = checkReadiness();
    await jest.advanceTimersByTimeAsync(2001);
    expect(await third).toEqual({ database: null, redis: true });
    expect(queryReadinessDatabase).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
