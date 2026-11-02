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

import {
  initSentry,
  Sentry,
  scrubBrandProtectionBreadcrumb,
  scrubBrandProtectionRequest,
} from '../../src/config/sentry';

const secret = 'gwc_brand-protection-secret-value';
const phone = '+17095550100';

test('brand protection scrubber drops body, query, authorization, and cookies', () => {
  const event = scrubBrandProtectionRequest({
    request: {
      url: `https://api.example.test/api/v1/brand-protection/ingest/matches?evidencePhones=${phone}`,
      data: JSON.stringify({ evidencePhones: [phone], detail: 'login wall', token: secret }),
      query_string: `evidencePhones=${phone}`,
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      cookies: `session=${secret}`,
    },
  });
  expect(event.request?.url).toBe('/api/v1/brand-protection/ingest/matches');
  expect(event.request).not.toHaveProperty('data');
  expect(event.request).not.toHaveProperty('query_string');
  expect(event.request).not.toHaveProperty('cookies');
  expect(event.request?.headers).not.toHaveProperty('Authorization');
  expect(JSON.stringify(event)).not.toContain(secret);
  expect(JSON.stringify(event)).not.toContain(phone);
  expect(JSON.stringify(event)).not.toContain('login wall');

  const breadcrumb = scrubBrandProtectionBreadcrumb({
    data: {
      url: `https://api.example.test/api/v1/brand-protection/matches?detail=login%20wall`,
      body: { detail: 'login wall', evidenceEmails: ['a@example.test'] },
      query_string: 'detail=login wall',
      cookies: secret,
      headers: { authorization: `Bearer ${secret}`, cookie: secret },
    },
  });
  expect(breadcrumb.data?.url).toBe('/api/v1/brand-protection/matches');
  expect(breadcrumb.data).not.toHaveProperty('body');
  expect(breadcrumb.data).not.toHaveProperty('query_string');
  expect(breadcrumb.data).not.toHaveProperty('cookies');
  expect(breadcrumb.data?.headers).not.toHaveProperty('authorization');
  expect(breadcrumb.data?.headers).not.toHaveProperty('cookie');
  expect(JSON.stringify(breadcrumb)).not.toContain(secret);
  expect(JSON.stringify(breadcrumb)).not.toContain('login wall');
});

test('Sentry hooks scrub brand protection requests and leave other routes intact', () => {
  initSentry();
  const options = (Sentry.init as jest.Mock).mock.calls[0][0];
  const sent = options.beforeSend({
    request: {
      url: 'https://api.example.test/api/v1/brand-protection/accounts?code=ABCD',
      data: { verificationCode: 'ABCD-EFGH' },
      query_string: 'code=ABCD',
      headers: { Authorization: secret },
      cookies: secret,
    },
  });
  expect(sent.request.url).toBe('/api/v1/brand-protection/accounts');
  expect(JSON.stringify(sent)).not.toContain('ABCD');
  expect(JSON.stringify(sent)).not.toContain(secret);

  const untouched = options.beforeSend({
    request: {
      url: 'https://api.example.test/api/v1/events',
      data: { name: 'Harbour Show' },
      headers: { Authorization: 'Bearer user-token' },
    },
  });
  expect(untouched.request.data).toEqual({ name: 'Harbour Show' });
  expect(untouched.request.headers.Authorization).toBe('Bearer user-token');

  const crumb = options.beforeBreadcrumb({
    data: {
      url: 'https://api.example.test/api/v1/brand-protection/ingest/status?detail=captcha',
      body: secret,
      headers: { Authorization: secret },
      cookies: secret,
    },
  });
  expect(JSON.stringify(crumb)).not.toContain(secret);
  expect(JSON.stringify(crumb)).not.toContain('captcha');
});
