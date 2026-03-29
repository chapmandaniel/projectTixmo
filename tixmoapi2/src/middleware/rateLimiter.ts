import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { config } from '../config/environment';
import { AuthRequest } from './auth';

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

const createStore = (prefix: string) =>
  new RedisStore({
    prefix,
    // @ts-ignore - Known issue with rate-limit-redis types and redis v4
    sendCommand: (...args: string[]) => getRedisClient().sendCommand(args),
  });

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
