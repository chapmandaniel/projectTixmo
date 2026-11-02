import dotenv from 'dotenv';
import { resolvePaymentCurrency } from './payment-currency';

// Tests must not inherit application database or provider credentials from .env.
if (process.env.NODE_ENV !== 'test') dotenv.config();

const isTest = process.env.NODE_ENV === 'test';
const isDevelopment = process.env.NODE_ENV === 'development';
const nodeEnv = process.env.NODE_ENV || 'development';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@tixmo.co';
const serviceName = process.env.SERVICE_NAME || process.env.RAILWAY_SERVICE_NAME || 'tixmo-api';
const release =
  process.env.SENTRY_RELEASE ||
  process.env.RELEASE ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  undefined;
const deploymentEnvironment =
  process.env.SENTRY_ENVIRONMENT ||
  process.env.RAILWAY_ENVIRONMENT_NAME ||
  process.env.RAILWAY_ENVIRONMENT ||
  nodeEnv;

const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
const legacyRateLimitMax =
  process.env.RATE_LIMIT_MAX || process.env.RATE_LIMIT_MAX_REQUESTS || undefined;

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function readNonNegativeInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return value;
}

// Venue wifi presents one public IP for every scanner phone. Admission is one
// bucket per scanner API key (stored as that scanner's id), not per IP.
// 2,000 scans per 15 minutes lets one door do 1,000 admissions and still have
// room for a camera double-read. The fixed window can be used as a burst.
const scannerRateLimitWindowMs = readPositiveInteger('SCANNER_RATE_LIMIT_WINDOW_MS', 900_000);
const scannerRateLimitMax = readPositiveInteger('SCANNER_RATE_LIMIT_MAX', 2_000);
const scannerAuthFailureWindowMs = readPositiveInteger('SCANNER_AUTH_FAILURE_WINDOW_MS', 60_000);
const scannerAuthFailureMax = readPositiveInteger('SCANNER_AUTH_FAILURE_MAX', 30);

// November 9 onsale: about 1,000 buyers in the first 10 minutes, with up to
// about 200 of them behind one carrier NAT address. A purchase is a handful of
// writes (hold, payment intent, sometimes cancel and a retry). 40 per actor
// covers a messy checkout. 4,000 per IP is twice a 200-buyer NAT at 10 writes
// each, and still far below an open flood. These buckets are not the general
// 240 write limit.
const checkoutRateLimitWindowMs = readPositiveInteger('CHECKOUT_RATE_LIMIT_WINDOW_MS', 600_000);
const checkoutRateLimitMax = readPositiveInteger('CHECKOUT_RATE_LIMIT_MAX', 40);
const checkoutIpRateLimitWindowMs = readPositiveInteger(
  'CHECKOUT_IP_RATE_LIMIT_WINDOW_MS',
  600_000
);
const checkoutIpRateLimitMax = readPositiveInteger('CHECKOUT_IP_RATE_LIMIT_MAX', 4_000);

// Login stays per IP and per account. The configured-image job admits 20
// logins from one address per minute and rejects the 21st, so the unset
// production IP cap stays 20. Two hundred buyers behind one NAT can sign in
// across the 10-minute onsale window when arrivals are spread out. A pile-up
// of more than 20 in one minute waits. 10/minute/account stops a rotated-IP
// guess of one email. Tests use a higher unset cap (IP 100, account 1000)
// unless the strict or low header is sent. Development uses 100 per IP.
const authRateLimitWindowMs = readPositiveInteger('AUTH_RATE_LIMIT_WINDOW_MS', 60_000);
const authRateLimitMax = readPositiveInteger(
  'AUTH_RATE_LIMIT_MAX',
  isTest || isDevelopment ? 100 : 20
);
const authAccountRateLimitWindowMs = readPositiveInteger(
  'AUTH_ACCOUNT_RATE_LIMIT_WINDOW_MS',
  60_000
);
const authAccountRateLimitMax = readPositiveInteger(
  'AUTH_ACCOUNT_RATE_LIMIT_MAX',
  isTest ? 1000 : 10
);

export const normalizeOptionalCredential = (value?: string) => {
  const trimmedValue = value?.trim() || '';
  const lowerValue = trimmedValue.toLowerCase();

  if (
    !trimmedValue ||
    lowerValue.includes('your_') ||
    lowerValue.includes('_your') ||
    lowerValue.includes('change-this') ||
    lowerValue.includes('placeholder')
  ) {
    return '';
  }

  return trimmedValue;
};

// GST/HST program account: 9-digit business number, RT, 4-digit reference.
const GST_HST_NUMBER = /^[0-9]{9}RT[0-9]{4}$/;
const loggedHstNumberWarnings = new Set<string>();

const warnHstNumberOnce = (message: string): void => {
  if (loggedHstNumberWarnings.has(message)) return;
  loggedHstNumberWarnings.add(message);
  console.warn(message);
};

// A missing or invalid registration number must not stop boot. Receipts hide the line.
export const readHstRegistrationNumber = (raw: string | undefined): string => {
  const normalized = normalizeOptionalCredential(raw).replace(/[\s-]/g, '').toUpperCase();
  if (!normalized) {
    warnHstNumberOnce(
      'TIXMO_HST_NUMBER is missing. Startup will continue, and receipts will hide the HST registration line.'
    );
    return '';
  }
  if (!GST_HST_NUMBER.test(normalized)) {
    warnHstNumberOnce(
      'TIXMO_HST_NUMBER is invalid. Startup will continue, and receipts will hide the HST registration line. Expected a GST/HST account number: 9 digits, RT, and 4 digits.'
    );
    return '';
  }
  return normalized;
};

// Inclusive rate. 0.15 means 15% of the tax-inclusive total is HST.
export const readHstRate = (raw: string | undefined): number => {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return 0.15;
  if (!/^\d*\.?\d+$/.test(trimmed)) {
    throw new Error('TIXMO_HST_RATE must be a decimal between 0 and 1');
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('TIXMO_HST_RATE must be a decimal between 0 and 1');
  }
  return value;
};

// Compatibility default only, not an evidenced launch-capacity budget.
const waitingRoomLimit = process.env.WAITING_ROOM_MAX_CONCURRENT_REQUESTS;
const waitingRoomMaxConcurrentRequests =
  waitingRoomLimit === undefined ? 5000 : Number(waitingRoomLimit);
if (
  (waitingRoomLimit !== undefined && !/^[0-9]+$/.test(waitingRoomLimit)) ||
  !Number.isSafeInteger(waitingRoomMaxConcurrentRequests) ||
  waitingRoomMaxConcurrentRequests <= 0
) {
  throw new Error('WAITING_ROOM_MAX_CONCURRENT_REQUESTS must be a positive safe integer');
}

export const config = {
  // Application
  nodeEnv,
  serviceName,
  deploymentEnvironment,
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3001',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Anonymous public-event reads. 0 disables the in-process cache. Tests default
  // to 0 so a just-written event is visible immediately. Production default is
  // a few seconds; quantityAvailable may be that stale until the order path rechecks.
  publicEventCacheTtlSeconds: readNonNegativeInteger(
    'PUBLIC_EVENT_CACHE_TTL_SECONDS',
    isTest ? 0 : 4
  ),

  // Checkout interactive transactions fail fast instead of sitting on the 15s default.
  checkoutTxMaxWaitMs: readPositiveInteger('CHECKOUT_TX_MAX_WAIT_MS', 2000),
  checkoutTxTimeoutMs: readPositiveInteger('CHECKOUT_TX_TIMEOUT_MS', 5000),
  checkoutLockTimeoutMs: readPositiveInteger('CHECKOUT_LOCK_TIMEOUT_MS', 2000),
  checkoutStatementTimeoutMs: readPositiveInteger('CHECKOUT_STATEMENT_TIMEOUT_MS', 4000),

  // Aggregate active checkout requests across instances; not users or queue positions.
  waitingRoomMaxConcurrentRequests,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD,
  redisDb: parseInt(process.env.REDIS_DB || '0', 10),

  // JWT
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Server-only durable asset-share encryption; independent of authentication rotation.
  assetShareEncryptionKey: process.env.ASSET_SHARE_ENCRYPTION_KEY || '',
  assetShareLegacySecret: process.env.ASSET_SHARE_LEGACY_SECRET || '',

  // Stripe
  stripeSecretKey: normalizeOptionalCredential(process.env.STRIPE_SECRET_KEY),
  stripePublishableKey: normalizeOptionalCredential(process.env.STRIPE_PUBLISHABLE_KEY),
  stripeWebhookSecret: normalizeOptionalCredential(process.env.STRIPE_WEBHOOK_SECRET),
  paymentCurrency: resolvePaymentCurrency(process.env.PAYMENT_CURRENCY, nodeEnv),
  // Empty when missing or invalid so receipts omit the registration line.
  hstNumber: readHstRegistrationNumber(process.env.TIXMO_HST_NUMBER),
  hstRate: readHstRate(process.env.TIXMO_HST_RATE),

  // Email
  postmarkServerToken: process.env.POSTMARK_SERVER_TOKEN || '',
  postmarkMessageStream: process.env.POSTMARK_MESSAGE_STREAM || '',
  sellerName: process.env.TIXMO_SELLER_NAME || '',
  supportEmail: process.env.SUPPORT_EMAIL || 'info@tixmo.co',
  refundPolicyUrl: process.env.REFUND_POLICY_URL || '',
  termsUrl: process.env.TERMS_URL || '',
  fromEmail: process.env.FROM_EMAIL || 'noreply@tixmo.co',
  fromName: process.env.FROM_NAME || 'Tixmo',
  emailHost: process.env.EMAIL_HOST || 'smtp.gmail.com',
  emailPort: parseInt(process.env.EMAIL_PORT || '587', 10),
  emailUser: process.env.EMAIL_USER || '',
  emailPassword: process.env.EMAIL_PASSWORD || '',
  emailFrom: process.env.EMAIL_FROM || 'noreply@tixmo.co',

  // SMS
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,

  // AI
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // AWS
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsS3Bucket: process.env.AWS_S3_BUCKET,

  // Elasticsearch
  elasticsearchNode: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  elasticsearchUsername: process.env.ELASTICSEARCH_USERNAME,
  elasticsearchPassword: process.env.ELASTICSEARCH_PASSWORD,

  // Sentry
  sentryDsn: process.env.SENTRY_DSN,
  sentryTracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.0'),
  sentryAlertRoute: process.env.SENTRY_ALERT_ROUTE || adminEmail,
  release,

  // Rate Limiting
  rateLimitWindowMs,
  rateLimitReadMax: isTest
    ? 1000
    : isDevelopment
      ? 4000
      : parseInt(process.env.RATE_LIMIT_READ_MAX || legacyRateLimitMax || '600', 10),
  rateLimitWriteMax: isTest
    ? 1000
    : isDevelopment
      ? 2000
      : parseInt(process.env.RATE_LIMIT_WRITE_MAX || legacyRateLimitMax || '240', 10),
  scannerRateLimitWindowMs,
  scannerRateLimitMax,
  scannerAuthFailureWindowMs,
  scannerAuthFailureMax,
  checkoutRateLimitWindowMs,
  checkoutRateLimitMax,
  checkoutIpRateLimitWindowMs,
  checkoutIpRateLimitMax,
  authRateLimitWindowMs,
  authRateLimitMax,
  authAccountRateLimitWindowMs,
  authAccountRateLimitMax,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],

  // Session
  sessionSecret: process.env.SESSION_SECRET || '',

  // Feature Flags
  enableResaleMarket: process.env.ENABLE_RESALE_MARKET === 'true',
  enableAIGeneration: process.env.ENABLE_AI_GENERATION === 'true',
  enableApprovalReminders: process.env.ENABLE_APPROVAL_REMINDERS === 'true',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logToFile: process.env.LOG_TO_FILE === 'true',

  // Cart Settings
  cartExpiryMinutes: parseInt(process.env.CART_EXPIRY_MINUTES || '15', 10),
  seatLockDurationSeconds: parseInt(process.env.SEAT_LOCK_DURATION_SECONDS || '600', 10),
  adminEmail,
} as const;

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  // Test suites mock or inject credentials; every runnable app environment needs real secrets.
  if (config.nodeEnv !== 'test') {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  } else {
    console.warn(`WARNING: Missing environment variables: ${missingEnvVars.join(', ')}`);
  }
}
