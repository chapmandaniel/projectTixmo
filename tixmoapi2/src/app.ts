import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/environment';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestLogger } from './middleware/requestLogger';
import { swaggerSpec } from './config/swagger';
import apiRoutes from './api';
import { initSentry, Sentry } from './config/sentry';
import { waitingRoom } from './middleware/waitingRoom';
import { optionalAuthenticate } from './middleware/auth';
import { apiReadRateLimiter, apiWriteRateLimiter } from './middleware/rateLimiter';

const app: Application = express();

const allowedOrigins = new Set(
  (Array.isArray(config.corsOrigin) ? config.corsOrigin : [config.corsOrigin])
    .map((origin) => origin?.trim())
    .filter(Boolean)
);

try {
  allowedOrigins.add(new URL(config.clientUrl).origin);
} catch (_error) {
  // Ignore invalid client URL here; email and deployment checks will surface it elsewhere.
}

// Initialize Sentry (if configured)
initSentry();

// Enable trust proxy for Railway load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// If Sentry is enabled, use request handler and tracing
if (config.sentryDsn) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check for exact match in allowed origins (e.g. localhost)
      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      // Check for .tixmo.co subdomains (Regex)
      // Allows: https://demo.tixmo.co, https://anything.tixmo.co
      const tixmoPattern = /^https:\/\/(?:[a-zA-Z0-9-]+\.)+tixmo\.co$/;
      if (tixmoPattern.test(origin)) {
        return callback(null, true);
      }

      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    },
    credentials: true,
  })
);

// Stripe webhooks require the raw request body for signature verification.
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '10mb' }));

// Body parsing middleware
app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/payments/webhook') {
    return next();
  }
  return express.json({ limit: '10mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging
app.use(requestLogger);

// Apply Waiting Room first (throttle high traffic)
app.use(waitingRoom);
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API is running and healthy
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 environment:
 *                   type: string
 *                   example: development
 */
// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// Debug route to test Sentry (only enabled when SENTRY_DSN is configured)
app.get('/api/v1/debug/sentry', (_req, _res, next) => {
  if (!config.sentryDsn) return next();
  // generating an error to test Sentry capture
  const err = new Error('Sentry test error');
  // capture and rethrow — Sentry's error handler will pick it up
  Sentry.captureException(err);
  next(err);
});

// Swagger API documentation
app.use(
  '/api/v1/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TixMo API Documentation',
  })
);

// API routes
app.use('/api', optionalAuthenticate, apiReadRateLimiter, apiWriteRateLimiter, apiRoutes);

// 404 handler
app.use(notFoundHandler);

// If Sentry is enabled, use the Sentry error handler before the app's error handler
if (config.sentryDsn) {
  app.use(Sentry.Handlers.errorHandler());
}

// Error handler (must be last)
app.use(errorHandler);

export default app;
