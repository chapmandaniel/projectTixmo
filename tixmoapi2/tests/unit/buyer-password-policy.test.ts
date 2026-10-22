jest.mock('../../src/config/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/config/environment', () => ({
  config: { clientUrl: 'https://buyer.synthetic.test', nodeEnv: 'test' },
}));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import { config } from '../../src/config/environment';
import { buyerResetLink } from '../../src/api/auth/buyerPasswordRecovery';
import { resetPasswordSchema, registerSchema } from '../../src/api/auth/validation';

test('reset link uses only configured trusted origin and a fragment', () => {
  const url = new URL(buyerResetLink('a'.repeat(64)));
  expect(url.origin).toBe('https://buyer.synthetic.test');
  expect(url.pathname).toBe('/reset-password');
  expect(url.search).toBe('');
  expect(url.hash.startsWith('#token=')).toBe(true);
});
test.each([
  'https://user:pass@buyer.synthetic.test',
  'https://buyer.synthetic.test?redirect=foreign',
  'https://buyer.synthetic.test#foreign',
  'https://buyer.synthetic.test/path',
  'http://foreign.invalid',
  'javascript:alert(1)',
])('reject configured unsafe recovery origin %s', (value) => {
  const replacement = jest.replaceProperty(config, 'clientUrl', value);
  try {
    expect(() => buyerResetLink('a'.repeat(64))).toThrow();
  } finally {
    replacement.restore();
  }
});
test('HTTP is limited to explicit test loopback and production always requires HTTPS', () => {
  const previous = { clientUrl: config.clientUrl, nodeEnv: config.nodeEnv };
  try {
    Object.assign(config, { clientUrl: 'http://127.0.0.1:12345', nodeEnv: 'test' });
    expect(() => buyerResetLink('a'.repeat(64))).not.toThrow();
    Object.assign(config, { nodeEnv: 'production' });
    expect(() => buyerResetLink('a'.repeat(64))).toThrow();
  } finally {
    Object.assign(config, previous);
  }
});
test.each(['short', 'nouppercase1!', 'NOLOWERCASE1!', 'NoNumber!', 'NoSpecial123'])(
  'reset preserves registration strength for %s',
  (password) => {
    expect(registerSchema.shape.body.shape.password.safeParse(password).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ body: { token: 'a'.repeat(64), password } }).success
    ).toBe(false);
  }
);
test('reset rejects truncation-length passwords, malformed tokens and unknown account selectors', () => {
  for (const body of [
    { token: 'a'.repeat(64), password: 'A'.repeat(73) + 'a1!' },
    { token: 'bogus', password: 'Synthetic-Valid1!' },
    { token: 'a'.repeat(64), password: 'Synthetic-Valid1!', userId: 'foreign' },
  ])
    expect(resetPasswordSchema.safeParse({ body }).success).toBe(false);
  expect(
    resetPasswordSchema.safeParse({
      body: { token: 'a'.repeat(64), password: 'Synthetic-Valid1!' },
    }).success
  ).toBe(true);
});
