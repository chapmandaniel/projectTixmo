import rateLimit, { MemoryStore, type Options as RateLimitOptions } from 'express-rate-limit';
import { Request } from 'express';
import RedisStore from 'rate-limit-redis';
import {
  getRedisClient,
  logRedisFallback,
  resetRedisFallbackLogForTests,
  withRedisTimeout,
} from '../config/redis';
import { config } from '../config/environment';
import { AuthRequest } from './auth';

const RATE_LIMIT_COOLDOWN_MS = 1000;
let redisBlockedUntil = 0;

function openRateLimitCircuit(error: unknown): void {
  redisBlockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  logRedisFallback(
    'rate-limit',
    error,
    'Redis rate limiter unavailable; using in-memory per-instance fallback'
  );
}

/**
 * RedisStore loads its scripts from the constructor. A failed SCRIPT LOAD must
 * resolve to a sentinel so that promise is not an unhandled rejection; EVALSHA
 * then fails and the request falls back to memory.
 */
async function sendRateLimitCommand(args: string[]) {
  const scriptLoad = args[0] === 'SCRIPT' && args[1] === 'LOAD';
  if (Date.now() < redisBlockedUntil) {
    if (scriptLoad) return 'redis-unavailable';
    throw new Error('Redis rate limiter circuit open');
  }
  try {
    return await withRedisTimeout(Promise.resolve().then(() => getRedisClient().sendCommand(args)));
  } catch (error) {
    openRateLimitCircuit(error);
    if (scriptLoad) return 'redis-unavailable';
    throw error;
  }
}

class ResilientRateLimitStore {
  private readonly redisStore: RedisStore;
  private readonly memory = new MemoryStore();
  readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.redisStore = new RedisStore({
      prefix,
      sendCommand: (...args: string[]) =>
        sendRateLimitCommand(args) as Promise<
          string | number | boolean | Array<string | number | boolean>
        >,
    });
  }

  init(options: RateLimitOptions): void {
    this.redisStore.init(options);
    this.memory.init(options);
  }

  async increment(key: string) {
    if (Date.now() < redisBlockedUntil) return this.memory.increment(key);
    try {
      return await this.redisStore.increment(key);
    } catch (error) {
      openRateLimitCircuit(error);
      return this.memory.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    if (Date.now() < redisBlockedUntil) {
      await this.memory.decrement(key);
      return;
    }
    try {
      await this.redisStore.decrement(key);
    } catch (error) {
      openRateLimitCircuit(error);
      await this.memory.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    await Promise.allSettled([this.redisStore.resetKey(key), this.memory.resetKey(key)]);
  }

  shutdown(): void {
    this.memory.shutdown();
  }
}

export function resetRedisRateLimitFallbackForTests(): void {
  if (process.env.NODE_ENV !== 'test') return;
  redisBlockedUntil = 0;
  resetRedisFallbackLogForTests();
}

const SKIPPED_METHODS = new Set(['OPTIONS', 'HEAD']);
const READ_METHODS = new Set(['GET']);
const EXCLUDED_PATH_PATTERNS = [/^\/api\/v\d+\/auth(?:\/|$)/, /^\/api\/v\d+\/docs(?:\/|$)/];

const isStrictRateLimitTest = (req: Request) =>
  config.nodeEnv === 'test' && req.headers['x-test-rate-limit'] === 'strict';

const shouldSkipApiLimiter = (req: Request) =>
  SKIPPED_METHODS.has(req.method) ||
  EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(req.originalUrl));

const getRateLimitKey = (req: Request) => {
  const authReq = req as AuthRequest;
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }

  return `ip:${req.ip}`;
};

const createStore = (prefix: string) => new ResilientRateLimitStore(prefix);

const createApiRateLimiter = ({
  prefix,
  max,
  strictTestMax,
  message,
  methods,
}: {
  prefix: string;
  max: number;
  strictTestMax: number;
  message: string;
  methods: Set<string>;
}) =>
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: (req) => (isStrictRateLimitTest(req) ? strictTestMax : max),
    message: {
      success: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRateLimitKey,
    skip: (req) => shouldSkipApiLimiter(req) || !methods.has(req.method),
    store: createStore(prefix),
  });

/**
 * Rate limiter for authentication endpoints (login, register, etc.)
 * Limits to 5 requests per 1 minute window per IP (Harder in production)
 * Much higher limits in development to prevent local blocks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    if (config.nodeEnv === 'test') {
      return req.headers['x-test-rate-limit'] === 'strict' ? 5 : 100;
    }

    return config.nodeEnv === 'development' ? 100 : 20;
  },
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after a minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:auth:'),
});

export const apiReadRateLimiter = createApiRateLimiter({
  prefix: 'rl:api:read:',
  max: config.rateLimitReadMax,
  strictTestMax: 3,
  message: 'Too many requests. Please slow down and try again shortly.',
  methods: READ_METHODS,
});

export const apiWriteRateLimiter = createApiRateLimiter({
  prefix: 'rl:api:write:',
  max: config.rateLimitWriteMax,
  strictTestMax: 2,
  message: 'Too many changes submitted at once. Please try again shortly.',
  methods: new Set(['POST', 'PUT', 'PATCH', 'DELETE']),
});
