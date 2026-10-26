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

  it('defaults the buyer sender name to Tixmo and hides an unset HST number', () => {
    process.env.FROM_NAME = '';
    process.env.TIXMO_HST_NUMBER = '';

    const { config } = require('../../src/config/environment');

    expect(config.fromName).toBe('Tixmo');
    expect(config.hstNumber).toBe('');
  });

  it('normalizes a configured GST/HST registration number', () => {
    process.env.TIXMO_HST_NUMBER = '123456789 rt 0001';

    const { config } = require('../../src/config/environment');

    expect(config.hstNumber).toBe('123456789RT0001');
  });

  it('treats a placeholder HST number as unset outside production', () => {
    process.env.TIXMO_HST_NUMBER = 'your_hst_number';

    const { config } = require('../../src/config/environment');

    expect(config.hstNumber).toBe('');
  });

  it('rejects a malformed HST number', () => {
    process.env.TIXMO_HST_NUMBER = 'not-a-number';

    expect(() => require('../../src/config/environment')).toThrow(/TIXMO_HST_NUMBER/);
  });

  it('requires the HST number when production boots', () => {
    process.env.NODE_ENV = 'production';
    process.env.TIXMO_HST_NUMBER = '';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://disposable@127.0.0.1/tixmo';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh';
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session';

    expect(() => require('../../src/config/environment')).toThrow(
      'Missing required environment variable: TIXMO_HST_NUMBER'
    );
  });
});
