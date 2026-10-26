describe('environment config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      DATABASE_URL: originalEnv.DATABASE_URL || 'postgresql://127.0.0.1:5432/tixmo_disposable_unit',
      JWT_SECRET: originalEnv.JWT_SECRET || 'unit-test-jwt-secret-value',
      JWT_REFRESH_SECRET: originalEnv.JWT_REFRESH_SECRET || 'unit-test-refresh-secret-value',
      SESSION_SECRET: originalEnv.SESSION_SECRET || 'unit-test-session-secret-value',
      PAYMENT_CURRENCY: originalEnv.PAYMENT_CURRENCY || 'cad',
    };
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

  it('uses PAYMENT_CURRENCY for paymentCurrency', () => {
    process.env.PAYMENT_CURRENCY = 'CAD';

    const { config } = require('../../src/config/environment');

    expect(config.paymentCurrency).toBe('cad');
  });

  it('fails production startup when PAYMENT_CURRENCY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_CURRENCY = '';

    expect(() => require('../../src/config/environment')).toThrow(
      'Missing required environment variables: PAYMENT_CURRENCY'
    );
  });

  it('logs and uses cad when PAYMENT_CURRENCY is missing outside production', () => {
    process.env.PAYMENT_CURRENCY = '   ';
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { config } = require('../../src/config/environment');

    expect(config.paymentCurrency).toBe('cad');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('PAYMENT_CURRENCY is not set'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('usd'));
    error.mockRestore();
  });

  it('uses cad in test without a payment currency and without logging', () => {
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_CURRENCY = '';
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { config } = require('../../src/config/environment');

    expect(config.paymentCurrency).toBe('cad');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('rejects a payment currency that is not a 3-letter code', () => {
    process.env.PAYMENT_CURRENCY = 'usd-default';

    expect(() => require('../../src/config/environment')).toThrow(
      'PAYMENT_CURRENCY must be a 3-letter ISO currency code'
    );
  });
});
