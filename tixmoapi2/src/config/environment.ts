import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3001',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD,
  redisDb: parseInt(process.env.REDIS_DB || '0', 10),

  // JWT
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Email
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.FROM_EMAIL || 'noreply@tixmo.com',
  fromName: process.env.FROM_NAME || 'TixMo',
  emailHost: process.env.EMAIL_HOST || 'smtp.gmail.com',
  emailPort: parseInt(process.env.EMAIL_PORT || '587', 10),
  emailUser: process.env.EMAIL_USER || '',
  emailPassword: process.env.EMAIL_PASSWORD || '',
  emailFrom: process.env.EMAIL_FROM || 'noreply@tixmo.com',

  // SMS
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,

  // AI
  geminiApiKey: process.env.GEMINI_API_KEY || '',

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
  release: process.env.RELEASE || undefined,

  // Rate Limiting
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 100,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],

  // Session
  sessionSecret: process.env.SESSION_SECRET || '',

  // Feature Flags
  enableResaleMarket: process.env.ENABLE_RESALE_MARKET === 'true',
  enableAIGeneration: process.env.ENABLE_AI_GENERATION === 'true',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logToFile: process.env.LOG_TO_FILE === 'true',

  // Cart Settings
  cartExpiryMinutes: parseInt(process.env.CART_EXPIRY_MINUTES || '10', 10),
  seatLockDurationSeconds: parseInt(process.env.SEAT_LOCK_DURATION_SECONDS || '600', 10),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@tixmo.co',
} as const;

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  // Only warn in development, throw in production
  if (config.nodeEnv === 'production') {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  } else {
    console.warn(`WARNING: Missing environment variables: ${missingEnvVars.join(', ')}`);
  }
}
