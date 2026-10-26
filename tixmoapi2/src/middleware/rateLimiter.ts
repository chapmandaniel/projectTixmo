import { createHash } from 'crypto';
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
// Scan, offline sync, and validate authenticate with a scanner key and are
// limited per scanner below. They must not consume the shared per-IP bucket:
// every phone on venue wifi has the same public address.
const SCANNER_ADMISSION_PATH = /^\/api\/v\d+\/scanners\/(?:scan|validate|sync)(?:\?|$)/;
// Hold/create, cancel, the unmounted confirm route, and payment-intent creation.
// The Stripe webhook is not a buyer write and stays off this bucket.
const CHECKOUT_ORDER_CREATE = /^\/api\/v\d+\/orders\/?$/;
const CHECKOUT_ORDER_ACTION = /^\/api\/v\d+\/orders\/[^/]+\/(?:cancel|confirm)\/?$/;
const CHECKOUT_PAYMENT_INTENT = /^\/api\/v\d+\/payments\/create-intent\/?$/;
const GUEST_CHECKOUT_COOKIE = 'tixmo_checkout_session';
const GUEST_SESSION_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export const SCANNER_ADMISSION_LIMIT_MESSAGE =
  'This scanner is sending scans faster than the gate allows. Wait a moment, then scan the same ticket again.';

export const SCANNER_AUTH_FAILURE_LIMIT_MESSAGE =
  'Too many rejected scanner keys from this network. Wait a minute, then try the scanner key again.';

export const CHECKOUT_ACTOR_LIMIT_MESSAGE =
  'Too many checkout attempts for this account. Wait a few minutes, then try again.';

export const CHECKOUT_IP_LIMIT_MESSAGE =
  'Too many checkout attempts from this network. Wait a few minutes, then try again.';

export const AUTH_ACCOUNT_LIMIT_MESSAGE =
  'Too many attempts for this account, please try again after a minute';

const isStrictRateLimitTest = (req: Request) =>
  config.nodeEnv === 'test' && req.headers['x-test-rate-limit'] === 'strict';

const requestPath = (req: Request) => req.originalUrl.split('?')[0] || '';

const isCheckoutWrite = (req: Request) => {
  if (req.method !== 'POST') return false;
  const path = requestPath(req);
  return (
    CHECKOUT_ORDER_CREATE.test(path) ||
    CHECKOUT_ORDER_ACTION.test(path) ||
    CHECKOUT_PAYMENT_INTENT.test(path)
  );
};

const shouldSkipApiLimiter = (req: Request) =>
  SKIPPED_METHODS.has(req.method) ||
  EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(req.originalUrl)) ||
  SCANNER_ADMISSION_PATH.test(req.originalUrl);

const shouldSkipWriteLimiter = (req: Request) => shouldSkipApiLimiter(req) || isCheckoutWrite(req);

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
  skip,
}: {
  prefix: string;
  max: number;
  strictTestMax: number;
  message: string;
  methods: Set<string>;
  skip?: (req: Request) => boolean;
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
    skip: (req) => (skip ? skip(req) : shouldSkipApiLimiter(req)) || !methods.has(req.method),
    store: createStore(prefix),
  });

const readBodyString = (req: Request, field: string) => {
  if (!req.body || typeof req.body !== 'object' || Buffer.isBuffer(req.body)) return undefined;
  const value = (req.body as Record<string, unknown>)[field];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

const authAccountKey = (req: Request) => {
  const email = readBodyString(req, 'email');
  if (email) return `email:${digest(email.toLowerCase())}`;
  const token = readBodyString(req, 'token');
  if (token) return `token:${digest(token)}`;
  const refreshToken = readBodyString(req, 'refreshToken');
  if (refreshToken) return `refresh:${digest(refreshToken)}`;
  return undefined;
};

/**
 * Per-IP brake for login, registration, refresh, and recovery.
 * Production default is 20 per minute. The configured-image job admits 20
 * attempts from one address and rejects the next. The strict test header
 * still forces 5.
 */
export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  max: (req) => (isStrictRateLimitTest(req) ? 5 : config.authRateLimitMax),
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after a minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('rl:auth:'),
});

/**
 * Per-account brake. One email, reset token, or refresh token shares a bucket
 * across IP addresses. Requests with no account identifier are not collapsed
 * onto the client IP.
 */
export const authAccountRateLimiter = rateLimit({
  windowMs: config.authAccountRateLimitWindowMs,
  max: (req) =>
    config.nodeEnv === 'test' && req.headers['x-test-auth-account-rate-limit'] === 'low'
      ? 3
      : config.authAccountRateLimitMax,
  message: {
    success: false,
    message: AUTH_ACCOUNT_LIMIT_MESSAGE,
  },
  // Leave RateLimit-* on the per-IP limiter. This bucket must not publish a
  // second limit, and its Redis prefix must stay outside rl:auth:*.
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => authAccountKey(req) as string,
  skip: (req) => !authAccountKey(req),
  store: createStore('rl:account:'),
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
  skip: shouldSkipWriteLimiter,
});

const scannerAdmissionMax = (req: Request) => {
  if (config.nodeEnv === 'test' && req.headers['x-test-scanner-rate-limit'] === 'low') return 3;
  return config.scannerRateLimitMax;
};

/**
 * One bucket per valid scanner API key, after authentication. The key is the
 * scanner id that key belongs to, so the secret is not stored in Redis.
 * 2,000 requests per 15 minutes is enough for 1,000 door scans plus retries.
 * These routes are not on the shared per-IP write limiter.
 */
export const scannerAdmissionRateLimiter = rateLimit({
  windowMs: config.scannerRateLimitWindowMs,
  max: scannerAdmissionMax,
  message: {
    success: false,
    message: SCANNER_ADMISSION_LIMIT_MESSAGE,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const scannerId = (req as Request & { scannerId?: string }).scannerId;
    return scannerId ? `scanner:${scannerId}` : `ip:${req.ip}`;
  },
  store: createStore('rl:scanner:admission:'),
});

/**
 * Counts only requests that already failed scanner authentication. A valid
 * scanner key never touches this bucket, so a bad-key flood on venue wifi
 * cannot lock the other phones out of the gate.
 */
export const scannerAuthFailureLimiter = rateLimit({
  windowMs: config.scannerAuthFailureWindowMs,
  max: config.scannerAuthFailureMax,
  message: {
    success: false,
    message: SCANNER_AUTH_FAILURE_LIMIT_MESSAGE,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${req.ip ?? 'unknown'}`,
  store: createStore('rl:scanner:auth-fail:'),
});

const readCookie = (header: string | undefined, name: string) => {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const guestCheckoutSession = (req: Request) => {
  const header = req.headers['x-checkout-session'];
  const raw = Array.isArray(header) ? header[0] : header;
  const candidates = [raw, readCookie(req.headers.cookie, GUEST_CHECKOUT_COOKIE)];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && GUEST_SESSION_PATTERN.test(value)) return value;
  }
  return undefined;
};

/**
 * Buyer identity for checkout writes. Logged-in buyers use their user id.
 * A guest uses `x-checkout-session` or the `tixmo_checkout_session` cookie.
 * With neither, the request is left to the per-IP ceiling so a carrier NAT
 * is not squeezed into the per-actor cap.
 */
const checkoutActorKey = (req: Request) => {
  const userId = (req as AuthRequest).user?.userId;
  if (userId) return `user:${userId}`;
  const session = guestCheckoutSession(req);
  if (session) return `session:${session}`;
  return undefined;
};

const checkoutActorMax = (req: Request) => {
  if (config.nodeEnv === 'test' && req.headers['x-test-checkout-rate-limit'] === 'low') return 3;
  return config.checkoutRateLimitMax;
};

const checkoutIpMax = (req: Request) => {
  if (config.nodeEnv === 'test' && req.headers['x-test-checkout-ip-rate-limit'] === 'low') return 4;
  return config.checkoutIpRateLimitMax;
};

export const checkoutActorRateLimiter = rateLimit({
  windowMs: config.checkoutRateLimitWindowMs,
  max: checkoutActorMax,
  message: {
    success: false,
    message: CHECKOUT_ACTOR_LIMIT_MESSAGE,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => checkoutActorKey(req) as string,
  skip: (req) => !isCheckoutWrite(req) || !checkoutActorKey(req),
  store: createStore('rl:checkout:actor:'),
});

export const checkoutIpRateLimiter = rateLimit({
  windowMs: config.checkoutIpRateLimitWindowMs,
  max: checkoutIpMax,
  message: {
    success: false,
    message: CHECKOUT_IP_LIMIT_MESSAGE,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${req.ip ?? 'unknown'}`,
  skip: (req) => !isCheckoutWrite(req),
  store: createStore('rl:checkout:ip:'),
});
