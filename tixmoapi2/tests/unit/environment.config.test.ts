describe('environment config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { NODE_ENV: 'development' };
    // Config-import tests must never read a developer's real .env file.
    jest.doMock('dotenv', () => ({ config: jest.fn(() => ({ parsed: {} })) }));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    jest.dontMock('dotenv');
    jest.resetModules();
  });

  it.each(['development', 'test', 'production'])(
    'does not log synthetic credentials when imported in %s',
    (nodeEnv) => {
      const credentialKeys = [
        'DATABASE_URL',
        'REDIS_URL',
        'REDIS_PASSWORD',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'SESSION_SECRET',
        'STRIPE_SECRET_KEY',
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'POSTMARK_SERVER_TOKEN',
        'EMAIL_PASSWORD',
        'TWILIO_AUTH_TOKEN',
        'GEMINI_API_KEY',
        'OPENAI_API_KEY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'ELASTICSEARCH_PASSWORD',
        'SENTRY_DSN',
      ];
      const sentinelCredentials = Object.fromEntries(
        credentialKeys.map((key) => [key, `synthetic-config-sentinel-${key}`])
      );
      process.env = { NODE_ENV: nodeEnv, ...sentinelCredentials };
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      jest.isolateModules(() => {
        const { config } = require('../../src/config/environment');

        expect(config.jwtSecret).toBe(sentinelCredentials.JWT_SECRET);
        expect(config.stripeSecretKey).toBe(sentinelCredentials.STRIPE_SECRET_KEY);
      });

      const loggedOutput = JSON.stringify(logSpy.mock.calls);
      for (const sentinel of Object.values(sentinelCredentials)) {
        expect(loggedOutput).not.toContain(sentinel);
      }
    }
  );

  it('treats placeholder Stripe credentials as missing config', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_your_stripe_secret_key';
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_your_stripe_publishable_key';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_your_webhook_secret';

    const { config } = require('../../src/config/environment');

    expect(config.stripeSecretKey).toBe('');
    expect(config.stripePublishableKey).toBe('');
    expect(config.stripeWebhookSecret).toBe('');
  });

  it('keeps plausible non-placeholder Stripe credentials', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_v1_smoke';
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_market_smoke';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_market_smoke';

    const { config } = require('../../src/config/environment');

    expect(config.stripeSecretKey).toBe('sk_test_v1_smoke');
    expect(config.stripePublishableKey).toBe('pk_test_market_smoke');
    expect(config.stripeWebhookSecret).toBe('whsec_market_smoke');
  });
});
