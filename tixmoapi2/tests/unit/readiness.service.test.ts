jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: { $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]) },
}));
jest.mock('../../src/config/redis', () => ({ getRedisClient: jest.fn() }));

describe('Dependency readiness', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => jest.useRealTimers());
  const setup = () => {
    const prisma = require('../../src/config/prisma').default;
    const { getRedisClient } = require('../../src/config/redis');
    const redis = { isReady: true, ping: jest.fn().mockResolvedValue('PONG') };
    getRedisClient.mockReturnValue(redis);
    return { prisma, redis, check: require('../../src/services/readiness.service').checkReadiness };
  };
  it('requires successful database and Redis checks and caches only a short-lived result', async () => {
    const { prisma, redis, check } = setup();
    expect(await check()).toEqual({ database: true, redis: true });
    expect(await check()).toEqual({ database: true, redis: true });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });
  it('reports dependency failures without returning internal connection/error details', async () => {
    const { prisma, check } = setup();
    prisma.$queryRaw.mockRejectedValue(new Error('private connection details'));
    expect(await check()).toEqual({ database: false, redis: true });
  });
  it('does not enqueue a ping when Redis is disconnected', async () => {
    const { redis, check } = setup();
    redis.isReady = false;
    expect(await check()).toEqual({ database: true, redis: false });
    expect(redis.ping).not.toHaveBeenCalled();
  });
  it('bounds stalled responses and shares unfinished probes rather than accumulating queries', async () => {
    jest.useFakeTimers();
    const { prisma, redis, check } = setup();
    prisma.$queryRaw.mockReturnValue(new Promise(() => {}));
    const first = check(),
      second = check();
    await jest.advanceTimersByTimeAsync(2001);
    expect(await first).toEqual({ database: null, redis: true });
    expect(await second).toEqual({ database: null, redis: true });
    const third = check();
    await jest.advanceTimersByTimeAsync(2001);
    expect(await third).toEqual({ database: null, redis: true });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });
});
