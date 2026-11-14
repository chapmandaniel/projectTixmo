/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
// Snapshot once, before a test file can publish a synthetic Stripe key or browser path.
if (process.env.TIXMO_TEST_ENV_CAPTURED !== '1') {
  process.env.TIXMO_TEST_ENV_CAPTURED = '1';
  process.env.TIXMO_CAPTURED_STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
  process.env.TIXMO_CAPTURED_STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  process.env.TIXMO_CAPTURED_BROWSER_PATH = process.env.TIXMO_BROWSER_PATH ?? '';
}

import { execSync } from 'child_process';
import path from 'path';
import { AddressInfo, Server } from 'net';

// Shared pure guard runs before schema bootstrap or test-module cleanup imports.
const { bootstrapTestDatabase } = require('../../scripts/verification-safety.cjs');
bootstrapTestDatabase(process.env, execSync, path.resolve(__dirname, '..'));

// Mock Redis client globally
// Supertest binds an unspecified address but always targets IPv4. On macOS an
// IPv6 listener can share a port with an unrelated IPv4 listener. Connect to the
// family we actually bound so test requests cannot reach that other service.
const SupertestTest = require('supertest/lib/test');
const serverAddress = SupertestTest.prototype.serverAddress;
SupertestTest.prototype.serverAddress = function (app: Server, route: string) {
  const url: string = serverAddress.call(this, app, route);
  const address = app.address() as AddressInfo | null;
  return address?.family === 'IPv6' ? url.replace('://127.0.0.1:', '://[::1]:') : url;
};

beforeAll(async () => {
  jest.useRealTimers();
  if (process.env.TIXMO_REDIS_OUTAGE_TEST === '1') return;
  const { createClient } = require('redis');
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 500, reconnectStrategy: false },
  });
  try {
    await client.connect();
    await client.flushDb();
  } catch {
    // Unit files mock Redis. Integration files that need it still fail on connectRedis.
  } finally {
    if (client.isOpen) await client.quit().catch(() => undefined);
  }
});

afterAll(async () => {
  jest.useRealTimers();
  try {
    const readiness = require('../src/services/readiness-db');
    if (typeof readiness.disconnectReadinessDatabase === 'function') {
      await readiness.disconnectReadinessDatabase();
    }
  } catch {
    // A mocked probe module has no client to close.
  }
});

jest.mock('../src/config/redis', () => {
  if (process.env.TIXMO_REDIS_OUTAGE_TEST === '1') {
    return jest.requireActual('../src/config/redis');
  }
  const mockClient = {
    sendCommand: jest.fn().mockResolvedValue('OK'), // Generic success for unknown commands
    on: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    isOpen: true,
  };

  return {
    connectRedis: jest.fn().mockResolvedValue(mockClient),
    getRedisClient: jest.fn().mockReturnValue(mockClient),
    disconnectRedis: jest.fn(),
    withRedisTimeout: (operation: Promise<unknown>) => operation,
    logRedisFallback: jest.fn(),
    resetRedisFallbackLogForTests: jest.fn(),
    REDIS_COMMAND_TIMEOUT_MS: 400,
    REDIS_CONNECT_TIMEOUT_MS: 1000,
  };
});

// Mock rate-limit-redis to avoid complex Redis interactions
jest.mock('rate-limit-redis', () => {
  if (process.env.TIXMO_REDIS_OUTAGE_TEST === '1') {
    return jest.requireActual('rate-limit-redis');
  }
  class MockRedisStore {
    localKeys = true;
    prefix: string;
    windowMs = 60 * 1000;
    counts = new Map<string, { totalHits: number; resetTime: Date }>();

    constructor(options: { prefix?: string } = {}) {
      this.prefix = options.prefix || 'rl:';
    }

    init(options: { windowMs: number }) {
      this.windowMs = options.windowMs;
    }

    async increment(key: string) {
      const storeKey = `${this.prefix}${key}`;
      const now = Date.now();
      const current = this.counts.get(storeKey);

      if (!current || current.resetTime.getTime() <= now) {
        const next = {
          totalHits: 1,
          resetTime: new Date(now + this.windowMs),
        };
        this.counts.set(storeKey, next);
        return next;
      }

      const next = {
        totalHits: current.totalHits + 1,
        resetTime: current.resetTime,
      };
      this.counts.set(storeKey, next);
      return next;
    }

    async decrement(key: string) {
      const storeKey = `${this.prefix}${key}`;
      const current = this.counts.get(storeKey);

      if (!current) {
        return;
      }

      if (current.totalHits <= 1) {
        this.counts.delete(storeKey);
        return;
      }

      this.counts.set(storeKey, {
        totalHits: current.totalHits - 1,
        resetTime: current.resetTime,
      });
    }

    async resetKey(key: string) {
      this.counts.delete(`${this.prefix}${key}`);
    }
  }

  return {
    __esModule: true,
    default: MockRedisStore,
  };
});

// Mock logger to reduce noise
jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(), // Missing method
  },
}));
