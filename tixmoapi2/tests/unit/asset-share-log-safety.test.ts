jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), http: jest.fn() },
}));
jest.mock('../../src/config/environment', () => ({
  config: { sentryDsn: 'https://synthetic@example.invalid/1', nodeEnv: 'test' },
}));
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  Integrations: { Http: jest.fn() },
  setTags: jest.fn(),
  setContext: jest.fn(),
}));
import { requestLogger } from '../../src/middleware/requestLogger';
import { notFoundHandler } from '../../src/middleware/notFoundHandler';
import { logger } from '../../src/config/logger';
import { initSentry, Sentry } from '../../src/config/sentry';
import { assetShareLogPath } from '../../src/utils/assetShareLogPath';

const secret = 'synthetic-bearer-canary-never-log';
const redacted = '/api/v1/assets/shares/[redacted]';
const paths = [
  `/api/v1/assets/shares/${secret}/../../health`,
  `/api/v1/assets/shares/${secret}/%2e%2e/%2e%2e/health`,
  `https://api.synthetic.test/api/v1/assets/shares/${secret}/../../health`,
  `https://api.synthetic.test/api/v1/assets/shares/${secret}/%2E%2E/%2E%2E/health`,
  `/api/v1/assets/shares/${secret}`,
  `/api/v1/assets/shares/${secret}?token=${secret}#${secret}`,
  `https://api.synthetic.test/api/v1/assets/shares/${secret}`,
  `//api.synthetic.test/api/v1/assets/shares/${secret}?${secret}`,
  `/API/V1/ASSETS/SHARES/${secret}`,
  `/api/v1/%61ssets/%73hares/${secret}`,
  `/%61pi%2fv1%2fassets%2fshares%2f${secret}`,
  `/api/v1/%61ssets/%73hares/${secret}%ZZ?${secret}`,
  `/api/v1/assets/shares/%E0%A4%A${secret}`,
  `/api/v1/assets/shares/${secret}/missing`,
  `/api/v1/assets/shares?token=${secret}`,
  `/api/v1/assets/shares/#${secret}`,
  `https://api.synthetic.test/api/v1/assets/shares/${secret}%ZZ?${secret}`,
];
function finishRequest(url: string, statusCode: number) {
  let finish!: () => void;
  const next = jest.fn();
  requestLogger(
    { method: 'GET', originalUrl: url } as any,
    {
      statusCode,
      on: (event: string, callback: () => void) => {
        expect(event).toBe('finish');
        finish = callback;
      },
    } as any,
    next
  );
  expect(next).toHaveBeenCalledTimes(1);
  finish();
}
function captureNotFound(url: string) {
  try {
    notFoundHandler({ originalUrl: url } as any, {} as any);
  } catch (error) {
    return error;
  }
  throw new Error('Expected notFoundHandler to throw');
}
function telemetry(url: string) {
  initSentry();
  const beforeSend = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend;
  return beforeSend({
    request: {
      url,
      method: 'GET',
      data: { bearer: secret },
      query_string: `token=${secret}`,
      headers: { Authorization: secret, Referer: secret },
      cookies: secret,
    },
  });
}
beforeEach(() => jest.clearAllMocks());
test.each(paths)('actual diagnostic sinks redact bearer URL %s', (url) => {
  expect(assetShareLogPath(url)).toBe(redacted);
  for (const status of [200, 404, 500]) finishRequest(url, status);
  for (const method of [logger.http, logger.warn, logger.error]) {
    expect(method).toHaveBeenCalledWith(expect.stringContaining(`GET ${redacted} `));
    expect(JSON.stringify((method as jest.Mock).mock.calls)).not.toContain(secret);
  }
  const failure = captureNotFound(url);
  expect(failure).toMatchObject({ statusCode: 404, message: `Route ${redacted} not found` });
  expect(JSON.stringify(failure)).not.toContain(secret);
  const result = telemetry(url);
  expect(result.request).toEqual({ url: redacted, method: 'GET' });
  expect(JSON.stringify(result)).not.toContain(secret);
});
test.each([
  '/api/v1/assets/folders?public=control#control',
  '/api/v1/assets/shares-management/control',
  '/api/v1/events/control',
  '/other/api/v1/assets/shares/control',
  'https://api.synthetic.test/api/v1/assets/control',
])('unrelated diagnostic URL is preserved %s', (url) => {
  expect(assetShareLogPath(url)).toBeNull();
  finishRequest(url, 200);
  expect(logger.http).toHaveBeenCalledWith(expect.stringContaining(`GET ${url} `));
  expect(captureNotFound(url)).toMatchObject({ message: `Route ${url} not found` });
  expect(telemetry(url).request.url).toBe(url);
});
test('existing recovery canonicalization and sensitive request removal stay intact', () => {
  const url = `/api/v1/auth/RESET-PASSWORD/extra/${secret}?token=${secret}`;
  finishRequest(url, 404);
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('GET /api/v1/auth/reset-password ')
  );
  expect(captureNotFound(url)).toMatchObject({ message: 'Password recovery route not found' });
  expect(telemetry(url).request).toEqual({ url: '/api/v1/auth/reset-password', method: 'GET' });
});
test.each([undefined, null, 42, {}, 'http://[invalid'])(
  'non-URL input is not reflected by classifier',
  (url) => {
    expect(assetShareLogPath(url)).toBeNull();
  }
);
