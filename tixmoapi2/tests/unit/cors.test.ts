import request from 'supertest';
import express, { Application, Request, Response, NextFunction } from 'express';

jest.mock('../../src/services/readiness-db', () => ({
  queryReadinessDatabase: jest.fn().mockResolvedValue(1),
  warmReadinessDatabase: jest.fn(),
  disconnectReadinessDatabase: jest.fn().mockResolvedValue(undefined),
  readinessDatabaseUrl: (raw: string) => raw,
}));

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    sendCommand: jest.fn(),
  }),
  connectRedis: jest.fn(),
}));

jest.mock('../../src/config/sentry', () => ({
  initSentry: jest.fn(),
  Sentry: {
    Handlers: {
      requestHandler: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      tracingHandler: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      errorHandler: () => (err: Error, _req: Request, _res: Response, next: NextFunction) =>
        next(err),
    },
  },
}));

jest.mock('../../src/api', () => {
  const router = express.Router();
  router.post('/v1/auth/login', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'Login successful' });
  });
  return router;
});

const PROD_DASH_ORIGIN = 'https://demo.tixmo.co';
const PROD_RAILWAY_ORIGIN = 'https://dash-production-7487.up.railway.app';
const LABS_ORIGINS = 'https://labs.tixmo.co,https://labs-dash-labs.up.railway.app';

const accessControlHeaders = (headers: request.Response['headers']) =>
  Object.keys(headers).filter((name) => name.startsWith('access-control-'));

const expectAllowed = (response: request.Response, origin: string) => {
  expect(response.status).not.toBe(403);
  expect(response.status).not.toBe(500);
  expect(response.headers['access-control-allow-origin']).toBe(origin);
  expect(response.headers['access-control-allow-credentials']).toBe('true');
};

const expectDenied = (response: request.Response) => {
  expect(response.status).toBe(403);
  expect(response.status).not.toBe(500);
  expect(accessControlHeaders(response.headers)).toEqual([]);
  expect(response.body).toEqual({
    success: false,
    message: 'The CORS policy for this site does not allow access from the specified Origin.',
  });
};

const loadApp = (env: NodeJS.ProcessEnv) => {
  const previous = process.env;
  const warnings: string[] = [];
  const errors: string[] = [];
  const warn = jest.spyOn(console, 'warn').mockImplementation((message?: unknown) => {
    warnings.push(String(message));
  });
  const errorSpy = jest.spyOn(console, 'error').mockImplementation((message?: unknown) => {
    errors.push(String(message));
  });
  process.env = {
    ...previous,
    RAILWAY_ENVIRONMENT: '',
    RAILWAY_ENVIRONMENT_NAME: '',
    ...env,
  };
  try {
    let loaded: Application | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = require('../../src/app').default as Application;
    });
    if (!loaded) {
      throw new Error('app did not load');
    }
    return { app: loaded, warnings, errors };
  } finally {
    warn.mockRestore();
    errorSpy.mockRestore();
    process.env = previous;
  }
};

const deployedSecrets: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://127.0.0.1:5432/tixmo_disposable_cors',
  JWT_SECRET: 'cors-unit-jwt-secret-value-32',
  JWT_REFRESH_SECRET: 'cors-unit-refresh-secret-value',
  SESSION_SECRET: 'cors-unit-session-secret-value',
  PAYMENT_CURRENCY: 'cad',
  TIXMO_HST_NUMBER: '123456789RT0001',
};

const productionEnv: NodeJS.ProcessEnv = {
  ...deployedSecrets,
  RAILWAY_ENVIRONMENT_NAME: 'production',
  CORS_ORIGIN: '',
  CLIENT_URL: 'https://demo.tixmo.co',
};

describe('CORS allowlist', () => {
  describe('outside production', () => {
    const { app } = loadApp({
      NODE_ENV: 'test',
      CORS_ORIGIN: '',
      CLIENT_URL: 'http://localhost:5173',
    });

    it('allows a dev origin with credentials', async () => {
      const response = await request(app).get('/health').set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
      expectAllowed(response, 'http://localhost:5173');
    });

    it('denies labs when it is not in the list', async () => {
      const response = await request(app).get('/health').set('Origin', 'https://labs.tixmo.co');

      expectDenied(response);
    });

    it('denies the production dashboard until it is listed', async () => {
      const response = await request(app).get('/health').set('Origin', PROD_DASH_ORIGIN);

      expectDenied(response);
    });

    it('allows labs only from CORS_ORIGIN', async () => {
      const listed = loadApp({
        NODE_ENV: 'test',
        CORS_ORIGIN: 'https://labs.tixmo.co',
        CLIENT_URL: 'http://localhost:5173',
      }).app;
      const response = await request(listed).get('/health').set('Origin', 'https://labs.tixmo.co');

      expect(response.status).toBe(200);
      expectAllowed(response, 'https://labs.tixmo.co');
    });

    it('matches a canonicalized configured origin', async () => {
      const listed = loadApp({
        NODE_ENV: 'test',
        CORS_ORIGIN: 'https://Demo.tixmo.co/, https://demo.tixmo.co:443',
        CLIENT_URL: 'http://localhost:5173',
      }).app;
      const response = await request(listed).get('/health').set('Origin', PROD_DASH_ORIGIN);

      expect(response.status).toBe(200);
      expectAllowed(response, PROD_DASH_ORIGIN);
    });
  });

  describe('production fallback', () => {
    const { app, warnings } = loadApp(productionEnv);

    it('warns and keeps both live production dashboard origins', () => {
      expect(warnings.some((warning) => warning.includes('CORS_ORIGIN is unset'))).toBe(true);
      expect(warnings.some((warning) => warning.includes(PROD_DASH_ORIGIN))).toBe(true);
      expect(warnings.some((warning) => warning.includes(PROD_RAILWAY_ORIGIN))).toBe(true);
    });

    it('allows both live production dashboard origins with credentials', async () => {
      for (const origin of [PROD_DASH_ORIGIN, PROD_RAILWAY_ORIGIN]) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.status).toBe(200);
        expectAllowed(response, origin);
      }
    });

    it('serves a production dashboard login preflight and POST through CORS', async () => {
      const preflight = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', PROD_DASH_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(preflight.status).toBe(204);
      expectAllowed(preflight, PROD_DASH_ORIGIN);
      expect(preflight.headers['access-control-allow-methods']).toBe(
        'GET,HEAD,PUT,PATCH,POST,DELETE'
      );
      expect(preflight.headers['access-control-allow-headers']).toBe('content-type');

      const login = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', PROD_DASH_ORIGIN)
        .set('Content-Type', 'application/json')
        .send({ email: 'operator@example.com', password: 'not-a-real-password' });

      expect(login.status).toBe(200);
      expect(login.body).toEqual({ success: true, message: 'Login successful' });
      expectAllowed(login, PROD_DASH_ORIGIN);
    });

    it.each([
      'https://labs.tixmo.co',
      'https://evil-tixmo.co',
      'https://tixmo.co.evil.com',
      'http://demo.tixmo.co',
      'https://sub.demo.tixmo.co',
      'https://demo.tixmo.co.evil.com',
      'https://frontend-dash-production.up.railway.app',
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:8080',
    ])('denies %s with 403 and no CORS headers', async (origin) => {
      const response = await request(app).get('/health').set('Origin', origin);
      expectDenied(response);

      const preflight = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');
      expectDenied(preflight);
    });
  });

  describe('other Railway environments and NODE_ENV=production without a name', () => {
    it('trusts only the labs list when NODE_ENV is production', async () => {
      const { app } = loadApp({
        ...deployedSecrets,
        RAILWAY_ENVIRONMENT_NAME: 'labs',
        CORS_ORIGIN: LABS_ORIGINS,
        CLIENT_URL: 'https://labs.tixmo.co',
      });

      for (const origin of ['https://labs.tixmo.co', 'https://labs-dash-labs.up.railway.app']) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.status).toBe(200);
        expectAllowed(response, origin);
      }

      for (const origin of [PROD_DASH_ORIGIN, PROD_RAILWAY_ORIGIN, 'http://localhost:8080']) {
        expectDenied(await request(app).get('/health').set('Origin', origin));
      }
    });

    it('allows no browser origins when NODE_ENV is production and Railway name is unset', async () => {
      const { app, errors } = loadApp({
        ...deployedSecrets,
        RAILWAY_ENVIRONMENT_NAME: '',
        CORS_ORIGIN: 'https://demo.tixmo.co',
        CLIENT_URL: 'https://demo.tixmo.co',
      });

      expect(errors.some((line) => line.includes('No browser origins are allowed'))).toBe(true);
      expectDenied(await request(app).get('/health').set('Origin', PROD_DASH_ORIGIN));
      expectDenied(await request(app).get('/health').set('Origin', 'http://localhost:8080'));
    });
  });
});
