import { restoreProcessEnv, snapshotProcessEnv } from '../helpers/restore-process-env';

describe('environment config', () => {
  const originalEnv = snapshotProcessEnv();

  beforeEach(() => {
    jest.resetModules();
    restoreProcessEnv(originalEnv);
    Object.assign(process.env, {
      NODE_ENV: 'development',
      DATABASE_URL: originalEnv.DATABASE_URL || 'postgresql://127.0.0.1:5432/tixmo_disposable_unit',
      JWT_SECRET: originalEnv.JWT_SECRET || 'unit-test-jwt-secret-value',
      JWT_REFRESH_SECRET: originalEnv.JWT_REFRESH_SECRET || 'unit-test-refresh-secret-value',
      SESSION_SECRET: originalEnv.SESSION_SECRET || 'unit-test-session-secret-value',
      PAYMENT_CURRENCY: originalEnv.PAYMENT_CURRENCY || 'cad',
      TIXMO_HST_NUMBER: '123456789RT0001',
      TIXMO_HST_RATE: '',
    });
    delete process.env.CORS_ORIGIN;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_ENVIRONMENT;
  });

  afterEach(() => {
    restoreProcessEnv(originalEnv);
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
    delete process.env.FROM_EMAIL;
    delete process.env.EMAIL_FROM;
    delete process.env.SUPPORT_EMAIL;
    process.env.TIXMO_HST_NUMBER = '';

    const loaded = require('../../src/config/environment');
    loaded.readHstRegistrationNumber('');
    loaded.readHstRegistrationNumber('your_hst_number');

    expect(loaded.config.fromName).toBe('Tixmo');
    expect(loaded.config.fromEmail).toBe('noreply@tixmo.co');
    expect(loaded.config.emailFrom).toBe('noreply@tixmo.co');
    expect(loaded.config.supportEmail).toBe('info@tixmo.co');
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

  const bootError = (): Error => {
    try {
      require('../../src/config/environment');
    } catch (error) {
      return error as Error;
    }
    throw new Error('boot continued');
  };

  it('rejects a wildcard CORS_ORIGIN at startup with one clear error', () => {
    process.env.CORS_ORIGIN = 'https://*.tixmo.co';
    const error = bootError();
    expect(error.message).toBe(
      'CORS_ORIGIN entry "https://*.tixmo.co" is invalid: wildcards are not allowed.'
    );
    expect(error.stack).toBe(error.message);
  });

  it('rejects a CORS_ORIGIN path at startup with one clear error', () => {
    process.env.CORS_ORIGIN = 'https://demo.tixmo.co/login';
    const error = bootError();
    expect(error.message).toBe(
      'CORS_ORIGIN entry "https://demo.tixmo.co/login" is invalid: paths, queries, and fragments are not allowed.'
    );
    expect(error.stack).toBe(error.message);
  });

  it('rejects a CORS_ORIGIN value that is only commas', () => {
    process.env.CORS_ORIGIN = ',,,';
    const error = bootError();
    expect(error.message).toContain('CORS_ORIGIN');
    expect(error.message).toContain('does not contain an origin');
    expect(error.stack).toBe(error.message);
  });

  it('canonicalizes case, a default port, and one trailing slash', () => {
    process.env.CORS_ORIGIN = 'https://Demo.tixmo.co/, https://demo.tixmo.co:443';

    const { config } = require('../../src/config/environment');

    expect(config.corsOrigin).toEqual(['https://demo.tixmo.co']);
  });

  it('trims CORS_ORIGIN and matches the canonical origin exactly', () => {
    process.env.CORS_ORIGIN = ' https://demo.tixmo.co , https://labs.tixmo.co, ';

    const { config } = require('../../src/config/environment');

    expect(config.corsOrigin).toEqual(['https://demo.tixmo.co', 'https://labs.tixmo.co']);
  });

  it('allows no browser origins when NODE_ENV is production and Railway name is unset', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://demo.tixmo.co';
    process.env.CLIENT_URL = 'https://demo.tixmo.co';
    delete process.env.RAILWAY_ENVIRONMENT_NAME;

    const { config } = require('../../src/config/environment');

    expect(config.corsRailwayProduction).toBe(false);
    expect(config.corsOrigin).toEqual([]);
    expect(config.clientUrl).toBe('https://demo.tixmo.co');
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('RAILWAY_ENVIRONMENT_NAME is unset')
    );
    expect(error).toHaveBeenCalledWith(expect.stringContaining('No browser origins are allowed'));
    error.mockRestore();
  });

  it('uses the live production origins only when RAILWAY_ENVIRONMENT_NAME is production', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'production';
    process.env.CORS_ORIGIN = '';
    process.env.CLIENT_URL = '';

    const { config } = require('../../src/config/environment');

    expect(config.corsRailwayProduction).toBe(true);
    expect(config.corsOrigin).toEqual([
      'https://dash-production-7487.up.railway.app',
      'https://demo.tixmo.co',
    ]);
    expect(config.corsOrigin).not.toContain(
      'https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app'
    );
    expect(config.corsOrigin).not.toContain('https://labs.tixmo.co');
    expect(config.corsOrigin).not.toContain('https://frontend-dash-production.up.railway.app');
    expect(config.corsOrigin).not.toContain('https://api-production-fbaf.up.railway.app');
    expect(config.clientUrl).toBe('https://demo.tixmo.co');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN is unset'));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('https://dash-production-7487.up.railway.app')
    );
    warn.mockRestore();
  });

  it('does not fall back to the production dashboard for links outside Railway production', () => {
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'labs';
    process.env.CORS_ORIGIN = 'https://labs.tixmo.co,https://labs-dash-labs.up.railway.app';
    process.env.CLIENT_URL = '';

    const { config } = require('../../src/config/environment');

    expect(config.clientUrl).toBe('http://localhost:3001');
    expect(config.clientUrl).not.toBe('https://demo.tixmo.co');
    expect(config.corsOrigin).toEqual([
      'https://labs.tixmo.co',
      'https://labs-dash-labs.up.railway.app',
    ]);
  });

  it('uses only the verified staging dashboard when that Railway environment leaves CORS_ORIGIN unset', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'staging-audit-20261005';
    process.env.CORS_ORIGIN = '';
    process.env.CLIENT_URL = '';

    const { config } = require('../../src/config/environment');

    expect(config.corsOrigin).toEqual([
      'https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app',
    ]);
    expect(config.corsOrigin).not.toContain('https://demo.tixmo.co');
    expect(config.corsOrigin).not.toContain('https://labs.tixmo.co');
    expect(config.corsOrigin).not.toContain(
      'https://tixmo-api-candidate-staging-audit-20261005.up.railway.app'
    );
    expect(config.clientUrl).toBe('http://localhost:3001');
    expect(config.clientUrl).not.toBe('https://demo.tixmo.co');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN is unset'));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app'
      )
    );
    warn.mockRestore();
  });

  it('uses only the verified labs dashboards when labs leaves CORS_ORIGIN unset', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'labs';
    process.env.CORS_ORIGIN = '';
    process.env.CLIENT_URL = '';

    const { config } = require('../../src/config/environment');

    expect(config.corsOrigin).toEqual([
      'https://labs.tixmo.co',
      'https://labs-dash-labs.up.railway.app',
    ]);
    expect(config.corsOrigin).not.toContain('https://demo.tixmo.co');
    expect(config.corsOrigin).not.toContain('https://labs-api.tixmo.co');
    expect(config.corsOrigin).not.toContain('https://labs-api-labs.up.railway.app');
    expect(config.clientUrl).toBe('http://localhost:3001');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('https://labs.tixmo.co'));
    warn.mockRestore();
  });

  it.each([
    'vendor-sandbox',
    'staging',
    'sandbox',
    'Production',
    'staging-audit-20261006',
    'labs-prod',
  ])('refuses to start when CORS_ORIGIN is unset for Railway environment %s', (name) => {
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = name;
    process.env.CORS_ORIGIN = '';
    process.env.CLIENT_URL = 'https://labs.tixmo.co';
    const error = bootError();
    expect(error.message).toContain('CORS_ORIGIN is unset');
    expect(error.message).toContain(name);
    expect(error.stack).toBe(error.message);
  });

  it('boots a labs deploy with NODE_ENV=production and trusts only the labs list', () => {
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'labs';
    process.env.CORS_ORIGIN = 'https://labs.tixmo.co,https://labs-dash-labs.up.railway.app';
    process.env.CLIENT_URL = 'https://labs.tixmo.co';

    const { config } = require('../../src/config/environment');

    expect(config.corsOrigin).toEqual([
      'https://labs.tixmo.co',
      'https://labs-dash-labs.up.railway.app',
    ]);
    expect(config.corsOrigin).not.toContain('https://demo.tixmo.co');
    expect(config.clientUrl).toBe('https://labs.tixmo.co');
  });

  it('rejects loopback and http origins on a deployed environment', () => {
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'production';
    process.env.CLIENT_URL = 'https://demo.tixmo.co';
    process.env.CORS_ORIGIN = 'http://localhost:8080';
    expect(bootError().message).toContain(
      'CORS_ORIGIN entry "http://localhost:8080" is invalid: deployed environments only allow https origins.'
    );

    jest.resetModules();
    process.env.CORS_ORIGIN = 'https://127.0.0.1:8080';
    expect(bootError().message).toContain('CORS_ORIGIN');
    expect(bootError().message).toContain('loopback');

    jest.resetModules();
    process.env.CORS_ORIGIN = 'https://demo.tixmo.co';
    process.env.CLIENT_URL = 'http://localhost:8080';
    expect(bootError().message).toContain('CLIENT_URL entry "http://localhost:8080"');

    jest.resetModules();
    process.env.CLIENT_URL = 'https://app.localhost';
    expect(bootError().message).toContain('CLIENT_URL');
    expect(bootError().message).toContain('loopback');

    jest.resetModules();
    process.env.CLIENT_URL = 'https://[::1]';
    expect(bootError().message).toContain('CLIENT_URL');

    jest.resetModules();
    process.env.CLIENT_URL = 'https://0.0.0.0';
    expect(bootError().message).toContain('loopback');
  });

  it('lets an explicit labs CORS_ORIGIN replace the labs fallback', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'labs';
    process.env.CORS_ORIGIN = 'https://labs.tixmo.co';
    process.env.CLIENT_URL = 'https://labs.tixmo.co';

    const { config } = require('../../src/config/environment');

    expect(config.corsOrigin).toEqual(['https://labs.tixmo.co']);
    expect(config.corsOrigin).not.toContain('https://labs-dash-labs.up.railway.app');
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN is unset'));
    warn.mockRestore();
  });

  it('lets an explicit production CORS_ORIGIN replace the hardcoded fallback', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'production';
    process.env.CORS_ORIGIN = 'https://demo.tixmo.co,https://dash-production-7487.up.railway.app';
    process.env.CLIENT_URL = 'https://demo.tixmo.co';

    const { config } = require('../../src/config/environment');

    expect(config.corsOrigin).toEqual([
      'https://demo.tixmo.co',
      'https://dash-production-7487.up.railway.app',
    ]);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN is unset'));
    warn.mockRestore();
  });

  it('does not add production origins when CORS_ORIGIN is unset outside a Railway deploy', () => {
    delete process.env.CORS_ORIGIN;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;

    const { config } = require('../../src/config/environment');

    expect(config.corsOrigin).toEqual([]);
    expect(config.clientUrl).not.toBe('https://demo.tixmo.co');
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
