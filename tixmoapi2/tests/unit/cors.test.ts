
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// Mock Redis
jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    sendCommand: jest.fn(),
  }),
  connectRedis: jest.fn(),
}));

// Mock Sentry
jest.mock('../../src/config/sentry', () => ({
  initSentry: jest.fn(),
  Sentry: {
    Handlers: {
      requestHandler: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      tracingHandler: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      errorHandler: () => (err: Error, _req: Request, _res: Response, next: NextFunction) => next(err),
    },
  },
}));

// Mock API routes to avoid loading controllers/services
jest.mock('../../src/api', () => {
  const router = express.Router();
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });
  return router;
});

// Import app after mocks
import app from '../../src/app';

describe('CORS Configuration', () => {
  it('should allow requests from localhost:3001', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3001');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
  });

  it('should allow requests from tixmo.co subdomains', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://demo.tixmo.co');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://demo.tixmo.co');
  });

  it('should allow requests from nested tixmo.co subdomains', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://sub.demo.tixmo.co');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://sub.demo.tixmo.co');
  });

  // VULNERABILITY CHECK
  it('should NOT allow requests from arbitrary railway apps', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.up.railway.app');

    // If vulnerable, it returns 200 and the origin
    // We expect this to FAIL initially (because it IS allowed currently)
    expect(response.headers['access-control-allow-origin']).not.toBe('https://evil.up.railway.app');
  });

  // Stricter Regex Check (Bonus)
  it('should NOT allow requests from domains containing tixmo.co but not ending in it properly', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://evil-tixmo.co');

    expect(response.headers['access-control-allow-origin']).not.toBe('https://evil-tixmo.co');
  });
});
