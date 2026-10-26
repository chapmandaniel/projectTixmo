import { createClient } from 'redis';
import { config } from './environment';
import { logger } from './logger';

type RedisClientType = ReturnType<typeof createClient>;

// Short enough that a request waiting on one command still finishes inside about a second.
export const REDIS_CONNECT_TIMEOUT_MS = 1000;
export const REDIS_COMMAND_TIMEOUT_MS = 400;
const FALLBACK_LOG_INTERVAL_MS = 30_000;

let redisClient: RedisClientType | null = null;
const fallbackLoggedAt = new Map<string, number>();

export class RedisCommandTimeoutError extends Error {
  constructor(ms: number) {
    super(`Redis command timed out after ${ms}ms`);
    this.name = 'RedisCommandTimeoutError';
  }
}

export function sanitizeRedisError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown error';
  return message.replace(/rediss?:\/\/\S+/gi, 'redis://<redacted>');
}

/** Throttled so a Redis outage does not write one warning per request. */
export function logRedisFallback(scope: string, error: unknown, detail: string): void {
  const now = Date.now();
  const previous = fallbackLoggedAt.get(scope) ?? 0;
  if (now - previous < FALLBACK_LOG_INTERVAL_MS) return;
  fallbackLoggedAt.set(scope, now);
  logger.warn(`${detail} (${sanitizeRedisError(error)})`);
}

export function resetRedisFallbackLogForTests(): void {
  fallbackLoggedAt.clear();
}

export function withRedisTimeout<T>(
  promise: Promise<T>,
  ms = REDIS_COMMAND_TIMEOUT_MS
): Promise<T> {
  let arm: ReturnType<typeof setImmediate> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const timeout = new Promise<never>((_, reject) => {
    // node-redis corks writes until this turn ends. A single wall-clock timer
    // also fires late after synchronous work and expires a command whose reply
    // is already buffered. Count short slices instead, so a blocked loop adds
    // one slice and a hung socket still rejects after about `ms` of free time.
    let elapsed = 0;
    const step = () => {
      if (settled) return;
      const slice = Math.min(50, ms - elapsed);
      timer = setTimeout(() => {
        if (settled) return;
        elapsed += slice;
        if (elapsed >= ms) {
          reject(new RedisCommandTimeoutError(ms));
          return;
        }
        step();
      }, slice);
      timer.unref();
    };
    arm = setImmediate(() => {
      arm = undefined;
      if (!settled) step();
    });
    arm.unref();
  });
  // A late rejection after the timeout must not surface as unhandled.
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );
  return Promise.race([promise, timeout]).finally(() => {
    if (arm) clearImmediate(arm);
    if (timer) clearTimeout(timer);
  });
}

const SKIP_COMMAND_TIMEOUT = new Set([
  'connect',
  'disconnect',
  'quit',
  'duplicate',
  'on',
  'once',
  'off',
  'addListener',
  'removeListener',
  'removeAllListeners',
  'emit',
  'listeners',
  'listenerCount',
  'eventNames',
  'multi',
  'commandOptions',
  'ref',
  'unref',
  'scanIterator',
  'hScanIterator',
  'sScanIterator',
  'zScanIterator',
  'subscribe',
  'pSubscribe',
  'sSubscribe',
  'unsubscribe',
  'pUnsubscribe',
  'sUnsubscribe',
  'constructor',
  'Multi',
]);

/**
 * node-redis routes get/set/eval through a private sender, so replacing
 * sendCommand alone does not time those out. Copy promise-returning commands
 * onto the instance as own writable methods so tests can spy on them. A proxy
 * would hide those methods from spyOn. Connection lifecycle stays unwrapped
 * so reconnect can continue.
 */
type RedisMethod = (this: unknown, ...args: unknown[]) => unknown;

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

function applyCommandTimeout(client: RedisClientType): RedisClientType {
  const wrapped = new Set<string>();
  let prototype = Object.getPrototypeOf(client) as object | null;
  while (prototype && prototype !== Object.prototype) {
    const parent = Object.getPrototypeOf(prototype) as object | null;
    // EventEmitter is the last prototype before Object. Leave it alone.
    if (!parent || parent === Object.prototype) break;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (wrapped.has(name) || SKIP_COMMAND_TIMEOUT.has(name)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (!descriptor || typeof descriptor.value !== 'function') continue;
      const original = descriptor.value as RedisMethod;
      Object.defineProperty(client, name, {
        configurable: true,
        enumerable: Boolean(descriptor.enumerable),
        writable: true,
        value(this: unknown, ...args: unknown[]) {
          const result = original.apply(client, args);
          return isThenable(result) ? withRedisTimeout(result) : result;
        },
      });
      wrapped.add(name);
    }
    prototype = parent;
  }
  return client;
}

export const connectRedis = async (): Promise<RedisClientType> => {
  try {
    if (redisClient) {
      return redisClient;
    }

    // node-redis has no ioredis maxRetriesPerRequest. disableOfflineQueue rejects
    // each command once while the client is reconnecting instead of parking it
    // on the offline queue until Redis returns. reconnectStrategy keeps dialing
    // so /ready can recover; it does not replay the failed command.
    redisClient = applyCommandTimeout(
      createClient({
        url: config.redisUrl,
        password: config.redisPassword,
        database: config.redisDb,
        disableOfflineQueue: true,
        socket: {
          connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
          reconnectStrategy: (retries: number) => Math.min(100 * 2 ** Math.min(retries, 5), 2000),
        },
      })
    );

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    // connect() retries for as long as reconnectStrategy returns a delay, so a
    // down Redis would block process startup forever. Wait one connect timeout,
    // then serve requests; the same client keeps dialing in the background.
    const pending = redisClient.connect();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stoppedWaiting = false;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), REDIS_CONNECT_TIMEOUT_MS);
      timer.unref();
    });
    const connected = pending.then(
      () => true as const,
      (error: unknown) => {
        if (stoppedWaiting) {
          logger.error('Redis connection failed:', error);
          return false as const;
        }
        throw error;
      }
    );
    try {
      const ready = await Promise.race([connected, timedOut]);
      if (!ready) {
        stoppedWaiting = true;
        logRedisFallback(
          'connect',
          new RedisCommandTimeoutError(REDIS_CONNECT_TIMEOUT_MS),
          'Redis unavailable at startup; continuing with local fallbacks'
        );
      }
    } finally {
      if (timer) clearTimeout(timer);
    }

    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis first.');
  }
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  const client = redisClient;
  redisClient = null;
  if (!client) return;
  try {
    if (client.isReady) {
      await withRedisTimeout(client.quit());
    }
  } catch (error) {
    logger.error('Redis disconnection failed:', error);
  } finally {
    try {
      await client.disconnect();
    } catch {
      // quit() already closed the socket, or the client never finished opening.
    }
  }
};
