jest.mock('../../src/config/email', () => ({
  emailFrom: { name: 'Synthetic', address: 'sender@synthetic.test' },
  transporter: { sendMail: jest.fn() },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), http: jest.fn() },
}));
jest.mock('../../src/config/environment', () => ({
  config: {
    sentryDsn: 'https://synthetic@example.invalid/1',
    clientUrl: 'https://buyer.synthetic.test',
    nodeEnv: 'test',
  },
}));
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  Integrations: { Http: jest.fn() },
  setTags: jest.fn(),
  setContext: jest.fn(),
}));
import { notificationService } from '../../src/utils/notificationService';
import { transporter } from '../../src/config/email';
import { requestLogger } from '../../src/middleware/requestLogger';
import { notFoundHandler } from '../../src/middleware/notFoundHandler';
import { logger } from '../../src/config/logger';
import { initSentry, Sentry } from '../../src/config/sentry';
const secret = 'synthetic-reset-token-that-must-not-be-logged';
test.each([
  '/api/v1/auth/reset-password',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/RESET-PASSWORD/',
  '/api/v1/auth/reset-password/extra/secret-token',
  '/api/v1/auth/forgot-password-malformed/secret-token',
])('request logger strips recovery query on %s', (route) => {
  jest.clearAllMocks();
  let finish!: () => void;
  requestLogger(
    {
      method: 'POST',
      originalUrl: `${route.replace('secret-token', secret)}?token=${secret}`,
      body: { token: secret, password: secret },
    } as any,
    {
      statusCode: 200,
      on: (_name: string, callback: () => void) => {
        finish = callback;
      },
    } as any,
    jest.fn()
  );
  finish();
  expect(JSON.stringify((logger.http as jest.Mock).mock.calls).includes(secret)).toBe(false);
});
test('malformed recovery route does not echo the request URL', () => {
  let failure: unknown;
  try {
    notFoundHandler(
      { originalUrl: `/api/v1/auth/reset-password/missing?token=${secret}` } as any,
      {} as any
    );
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ statusCode: 404, message: 'Password recovery route not found' });
});
test('recovery telemetry removes body/query/header/cookie token material', () => {
  initSentry();
  const beforeSend = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend;
  const result = beforeSend({
    request: {
      url: `https://api.synthetic.test/api/v1/auth/reset-password/extra/${secret}?token=${secret}`,
      data: JSON.stringify({ token: secret, password: secret }),
      query_string: `token=${secret}`,
      headers: { Authorization: secret },
      cookies: secret,
    },
  });
  expect(JSON.stringify(result).includes(secret)).toBe(false);
  expect(result.request.url).toBe('/api/v1/auth/reset-password');
});

test('all recovery-looking suffixes canonicalize without any raw path token', () => {
  initSentry();
  const beforeSend = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend;
  for (const url of [
    `https://api.synthetic.test/api/v1/auth/forgot-password-malformed/${secret}?token=${secret}`,
    `https://api.synthetic.test/api/v1/auth/RESET-PASSWORD/${secret}`,
    `https://api.synthetic.test/api/v1/auth/%72eset-password/${secret}`,
  ]) {
    const result = beforeSend({
      request: {
        url,
        data: { token: secret },
        headers: { Authorization: secret },
        query_string: secret,
        cookies: secret,
      },
    });
    expect(JSON.stringify(result).includes(secret)).toBe(false);
  }
});

test('recovery transport rejection never logs provider errors containing a link or body', async () => {
  jest.clearAllMocks();
  (transporter.sendMail as jest.Mock).mockRejectedValue(new Error(secret));
  expect(
    await notificationService.sendBuyerPasswordReset(
      'buyer@synthetic.test',
      `https://buyer.synthetic.test/reset-password#token=${secret}`
    )
  ).toBe(false);
  expect(await notificationService.sendBuyerPasswordChanged('buyer@synthetic.test')).toBe(false);
  expect(JSON.stringify((logger.warn as jest.Mock).mock.calls).includes(secret)).toBe(false);
});
