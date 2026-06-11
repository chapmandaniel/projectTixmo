describe('environment config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'development' };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

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
