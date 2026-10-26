describe('environment config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
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

  it('defaults the buyer sender name to Tixmo and hides an unset HST number', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.FROM_NAME = '';
    process.env.TIXMO_HST_NUMBER = '';

    const { config } = require('../../src/config/environment');

    expect(config.fromName).toBe('Tixmo');
    expect(config.hstNumber).toBe('');
    expect(config.hstRate).toBe(0.15);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is missing/));
    error.mockRestore();
  });

  it('normalizes a configured GST/HST registration number', () => {
    process.env.TIXMO_HST_NUMBER = '123456789 rt 0001';

    const { config } = require('../../src/config/environment');

    expect(config.hstNumber).toBe('123456789RT0001');
  });

  it('treats a placeholder HST number as unset and logs it', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.TIXMO_HST_NUMBER = 'your_hst_number';

    const { config } = require('../../src/config/environment');

    expect(config.hstNumber).toBe('');
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is missing/));
    error.mockRestore();
  });

  it('hides a malformed HST number instead of stopping boot', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.TIXMO_HST_NUMBER = 'not-a-number';

    const { config } = require('../../src/config/environment');

    expect(config.hstNumber).toBe('');
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is invalid/));
    error.mockRestore();
  });

  it('keeps booting in production when the HST number is missing or invalid', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
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
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is missing/));
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/TIXMO_HST_NUMBER is invalid/));
    error.mockRestore();
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
