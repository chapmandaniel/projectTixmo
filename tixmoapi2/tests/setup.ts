/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
import { execSync } from 'child_process';
import path from 'path';
import { AddressInfo, Server } from 'net';

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

const { assertDisposableTestTarget } = require('../../scripts/test-target.cjs');
process.env.DATABASE_URL = assertDisposableTestTarget(process.env);
execSync('npx prisma db push --accept-data-loss --skip-generate', {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'ignore',
});

// Mock Redis client globally
jest.mock('../src/config/redis', () => {
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
  };
});

// Mock rate-limit-redis to avoid complex Redis interactions
jest.mock('rate-limit-redis', () => {
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
