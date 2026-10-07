import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';
import { StatusCodes } from 'http-status-codes';

export const ACTIVE_REQUESTS_KEY = 'tixmo:active-request-leases:v1';
export const ACQUIRE_REQUEST_LEASE = `
local clock = redis.call('TIME')
local now = clock[1] * 1000 + math.floor(clock[2] / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if not redis.call('ZSCORE', KEYS[1], ARGV[1]) and redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], now + tonumber(ARGV[3]), ARGV[1])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[3]) * 2)
return 1
`;
const RENEW_REQUEST_LEASE = `
local clock = redis.call('TIME')
local now = clock[1] * 1000 + math.floor(clock[2] / 1000)
local expiry = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not expiry or tonumber(expiry) <= now then return 0 end
redis.call('ZADD', KEYS[1], 'XX', now + tonumber(ARGV[2]), ARGV[1])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]) * 2)
return 1
`;

export const waitingRoom = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/ready' || req.path === '/metrics') return next();
  const token = randomUUID(),
    leaseMs = 120_000;
  let terminated = Boolean(req.aborted || res.destroyed || res.writableEnded);
  let acquired = false,
    released = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let client: ReturnType<typeof getRedisClient>;
  const release = async (uncertain = false) => {
    if (timer) clearInterval(timer);
    if ((!acquired && !uncertain) || released) return;
    released = true;
    // Removal is idempotent by request identity. Crash/network ambiguity also
    // expires instead of leaving a permanently poisoned shared counter.
    if (!client || client.isReady === false) return;
    try {
      await client.zRem(ACTIVE_REQUESTS_KEY, token);
    } catch (error) {
      logger.error('Waiting room lease release failed', error);
    }
  };
  const terminal = () => {
    terminated = true;
    void release();
  };
  // Register before Redis acquisition: the client can disconnect during await.
  res.on('finish', terminal);
  res.on('close', terminal);
  req.on?.('aborted', terminal);
  try {
    client = getRedisClient();
    if (client.isReady === false) {
      if (!terminated) next();
      return;
    }
    const accepted = await client.eval(ACQUIRE_REQUEST_LEASE, {
      keys: [ACTIVE_REQUESTS_KEY],
      arguments: [token, '5000', String(leaseMs)],
    });
    acquired = Number(accepted) === 1;
    if (terminated) {
      await release();
      return;
    }
    if (!acquired) {
      logger.warn('Waiting Room Active: Rejected request due to high load');
      return res
        .status(StatusCodes.SERVICE_UNAVAILABLE)
        .json({ message: 'High traffic volume. Please try again in a moment.', retryAfter: 5 });
    }
    timer = setInterval(() => {
      if (terminated || client.isReady === false) return;
      void client
        .eval(RENEW_REQUEST_LEASE, {
          keys: [ACTIVE_REQUESTS_KEY],
          arguments: [token, String(leaseMs)],
        })
        .catch((error) => logger.error('Waiting room lease renewal failed', error));
    }, 30_000);
    timer.unref();
    next();
  } catch (error) {
    await release(true);
    logger.error('Waiting Room Check Failed:', error);
    // Preserve the existing Redis fail-open policy without queued acquisition
    // when the client is known to be unavailable.
    if (!terminated) next();
  }
};
