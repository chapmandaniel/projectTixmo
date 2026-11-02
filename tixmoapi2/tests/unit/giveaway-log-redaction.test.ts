import { ApiError } from '../../src/utils/ApiError';
import { redactGiveawayLogText } from '../../src/utils/giveawayLogRedaction';
import { errorHandler } from '../../src/middleware/errorHandler';
import { logger } from '../../src/config/logger';
import { assertDisposableDatabase } from '../../scripts/issue-giveaway-checker-token';

const phone = '+1 709 555 0199';
const email = 'scam-evidence@example.test';
const code = 'ABCD-EFGH';
const token = 'gwc_abcdefghijklmnopqrstuvwxyz';

test('redacts evidence, verification codes, and checker tokens from log text', () => {
  const raw = `POST /api/v1/brand-protection/ingest/matches?evidencePhones=${phone}&verificationCode=${code} ${JSON.stringify(
    {
      evidencePhones: [phone],
      evidenceEmails: [email],
      verificationCode: code,
    }
  )} ${token}`;
  const redacted = redactGiveawayLogText(raw);
  expect(redacted).not.toContain(phone);
  expect(redacted).not.toContain(email);
  expect(redacted).not.toContain(code);
  expect(redacted).not.toContain(token);
  expect(redacted).toContain('[redacted]');
  expect(redacted).toContain('gwc_[redacted]');
});

test('error logs do not keep evidence fields', () => {
  const body = JSON.stringify({
    evidencePhones: [phone],
    evidenceEmails: [email],
    verificationCode: code,
  });
  const res = {
    statusCode: 400,
    status() {
      return this;
    },
    json() {
      return this;
    },
    set() {
      return this;
    },
  };
  errorHandler(ApiError.badRequest(body), {} as never, res as never, () => undefined);
  const logged = JSON.stringify((logger.warn as jest.Mock).mock.calls);
  expect(logged).not.toContain(phone);
  expect(logged).not.toContain(email);
  expect(logged).not.toContain(code);
});

test('checker token issuance refuses hosted and non-disposable databases', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertDisposableDatabase('postgresql://user:secret@railway.internal/tixmo_disposable_x')
    ).toThrow(/non-loopback/);
    expect(() => assertDisposableDatabase('postgresql://user:secret@127.0.0.1/tixmo')).toThrow(
      /tixmo_disposable_/
    );
    expect(() =>
      assertDisposableDatabase('postgresql://user:secret@127.0.0.1/tixmo_disposable_local')
    ).not.toThrow();
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertDisposableDatabase('postgresql://user:secret@127.0.0.1/tixmo_disposable_local')
    ).toThrow(/production/);
  } finally {
    process.env.NODE_ENV = previous;
  }
});
