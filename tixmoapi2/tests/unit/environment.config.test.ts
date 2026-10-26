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
      TIXMO_HST_NUMBER: '123456789RT0001',
      TIXMO_HST_RATE: '',
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

  it('leaves buyer receipt copy unset except the support email default', () => {
    delete process.env.TIXMO_SELLER_NAME;
    delete process.env.SUPPORT_EMAIL;
    delete process.env.REFUND_POLICY_URL;
    delete process.env.TERMS_URL;

    const { config } = require('../../src/config/environment');

    expect(config.sellerName).toBe('');
    expect(config.supportEmail).toBe('info@tixmo.co');
    expect(config.refundPolicyUrl).toBe('');
    expect(config.termsUrl).toBe('');
  });

  it('reads buyer receipt copy from the environment', () => {
    process.env.TIXMO_SELLER_NAME = 'Example Seller';
    process.env.SUPPORT_EMAIL = 'desk@tixmo.co';
    process.env.REFUND_POLICY_URL = 'https://policies.example.test/refunds';
    process.env.TERMS_URL = 'https://policies.example.test/terms';

    const { config } = require('../../src/config/environment');

    expect(config.sellerName).toBe('Example Seller');
    expect(config.supportEmail).toBe('desk@tixmo.co');
    expect(config.refundPolicyUrl).toBe('https://policies.example.test/refunds');
    expect(config.termsUrl).toBe('https://policies.example.test/terms');
  });

  it('defaults the buyer sender name to Tixmo and hides an unset HST number', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.FROM_NAME = '';
    process.env.TIXMO_HST_NUMBER = '';

    const loaded = require('../../src/config/environment');
    loaded.readHstRegistrationNumber('');
    loaded.readHstRegistrationNumber('your_hst_number');

    expect(loaded.config.fromName).toBe('Tixmo');
    expect(loaded.config.hstNumber).toBe('');
    expect(loaded.config.hstRate).toBe(0.15);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is missing/));
    warn.mockRestore();
  });

  it('normalizes a configured GST/HST registration number', () => {
    process.env.TIXMO_HST_NUMBER = '123456789 rt 0001';

    const { config } = require('../../src/config/environment');

    expect(config.hstNumber).toBe('123456789RT0001');
  });

  it('treats a placeholder HST number as unset and logs it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.TIXMO_HST_NUMBER = 'your_hst_number';

    const { config } = require('../../src/config/environment');

    expect(config.hstNumber).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is missing/));
    warn.mockRestore();
  });

  it('hides a malformed HST number instead of stopping boot', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.TIXMO_HST_NUMBER = 'not-a-number';

    const { config } = require('../../src/config/environment');

    expect(config.hstNumber).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is invalid/));
    warn.mockRestore();
  });

  it('keeps booting in production when the HST number is missing or invalid', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://disposable@127.0.0.1/tixmo';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh';
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session';

    process.env.TIXMO_HST_NUMBER = '';
    expect(require('../../src/config/environment').config.hstNumber).toBe('');

    jest.resetModules();
    process.env.TIXMO_HST_NUMBER = 'not-a-number';
    expect(require('../../src/config/environment').config.hstNumber).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is missing/));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is invalid/));
    warn.mockRestore();
  });

  it('defaults the HST rate to 0.15 and accepts another decimal in range', () => {
    expect(require('../../src/config/environment').config.hstRate).toBe(0.15);

    jest.resetModules();
    process.env.TIXMO_HST_RATE = '0.13';
    expect(require('../../src/config/environment').config.hstRate).toBe(0.13);

    jest.resetModules();
    process.env.TIXMO_HST_RATE = '0';
    expect(require('../../src/config/environment').config.hstRate).toBe(0);

    jest.resetModules();
    process.env.TIXMO_HST_RATE = '1';
    expect(require('../../src/config/environment').config.hstRate).toBe(1);
  });

  it('rejects an HST rate outside 0 to 1', () => {
    process.env.TIXMO_HST_RATE = '1.5';
    expect(() => require('../../src/config/environment')).toThrow(
      'TIXMO_HST_RATE must be a decimal between 0 and 1'
    );

    jest.resetModules();
    process.env.TIXMO_HST_RATE = 'nope';
    expect(() => require('../../src/config/environment')).toThrow(
      'TIXMO_HST_RATE must be a decimal between 0 and 1'
    );
  });
});
