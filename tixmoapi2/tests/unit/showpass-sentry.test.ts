jest.mock('../../src/config/environment', () => ({
  config: {
    sentryDsn: 'https://synthetic@example.invalid/1',
    nodeEnv: 'test',
    serviceName: 'tixmo-api',
    deploymentEnvironment: 'test',
    sentryAlertRoute: 'ci-admin@tixmo.test',
    sentryTracesSampleRate: 0,
  },
}));
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  Integrations: { Http: jest.fn() },
  setTags: jest.fn(),
  setContext: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import {
  initSentry,
  Sentry,
  scrubShowpassBreadcrumb,
  scrubShowpassEvent,
} from '../../src/config/sentry';

const apiKey = 'sp_demo_valid_key';
const webhookSecret = 'sp_demo_webhook_secret';
const email = 'buyer@example.com';
const barcode = 'DO-NOT-STORE';
const buyer = 'Buyer Name';

test('showpass scrubber drops body, query, headers, cookies, and buyer fields', () => {
  const event = scrubShowpassEvent({
    request: {
      url: `https://api.example.test/api/v1/vendors/showpass/webhook?apiKey=${apiKey}`,
      data: {
        apiKey,
        webhookSecret,
        customer_email: email,
        customer_name: buyer,
        barcode_string: barcode,
      },
      query_string: `apiKey=${apiKey}`,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      cookies: `session=${webhookSecret}`,
    },
    extra: { apiKey, webhookSecret, customer_email: email, barcode_string: barcode },
  });
  expect(event.request?.url).toBe('/api/v1/vendors/showpass/webhook');
  expect(event.request).not.toHaveProperty('data');
  expect(event.request).not.toHaveProperty('query_string');
  expect(event.request).not.toHaveProperty('headers');
  expect(event.request).not.toHaveProperty('cookies');
  const serialized = JSON.stringify(event);
  expect(serialized).not.toContain(apiKey);
  expect(serialized).not.toContain(webhookSecret);
  expect(serialized).not.toContain(email);
  expect(serialized).not.toContain(barcode);
  expect(serialized).not.toContain(buyer);

  const breadcrumb = scrubShowpassBreadcrumb({
    data: {
      url: `https://api.example.test/api/v1/organizations/org/showpass/connection?apiKey=${apiKey}`,
      body: { apiKey, webhookSecret, customer_email: email },
      headers: { authorization: `Bearer ${apiKey}` },
      cookies: webhookSecret,
    },
  });
  expect(breadcrumb.data?.url).toBe('/api/v1/organizations/org/showpass/connection');
  expect(JSON.stringify(breadcrumb)).not.toContain(apiKey);
  expect(JSON.stringify(breadcrumb)).not.toContain(webhookSecret);
  expect(JSON.stringify(breadcrumb)).not.toContain(email);
});

test('a 5xx on a Showpass route does not capture the key, secret, or buyer fields', async () => {
  initSentry();
  const beforeSend = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend as (
    event: Record<string, unknown>
  ) => Record<string, unknown>;
  const captured: Record<string, unknown>[] = [];
  const app = express();
  app.use(express.json());
  app.post('/api/v1/organizations/:organizationId/showpass/connection', (req, _res, next) => {
    const failure = new Error('Showpass connect failed');
    captured.push(
      beforeSend({
        message: failure.message,
        request: {
          url: `https://api.example.test${req.originalUrl}`,
          data: req.body,
          query_string: req.originalUrl.split('?')[1],
          headers: { ...req.headers },
          cookies: req.headers.cookie,
        },
        extra: req.body,
      })
    );
    next(failure);
  });
  app.use(
    (_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false });
    }
  );

  const response = await request(app)
    .post(
      '/api/v1/organizations/00000000-0000-4000-8000-000000000001/showpass/connection?apiKey=' +
        apiKey
    )
    .set('Authorization', `Bearer ${apiKey}`)
    .set('Cookie', `session=${webhookSecret}`)
    .send({
      apiKey,
      webhookSecret,
      customer_email: email,
      customer_name: buyer,
      barcode_string: barcode,
    });

  expect(response.status).toBe(500);
  expect(captured).toHaveLength(1);
  const serialized = JSON.stringify(captured[0]);
  expect(serialized).not.toContain(apiKey);
  expect(serialized).not.toContain(webhookSecret);
  expect(serialized).not.toContain(email);
  expect(serialized).not.toContain(barcode);
  expect(serialized).not.toContain(buyer);
});
