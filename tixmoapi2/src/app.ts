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
import rateLimit from 'express-rate-limit';

const app: Application = express();

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

      // Check if origin is allowed
      const allowedOrigins = Array.isArray(config.corsOrigin) ? config.corsOrigin : [config.corsOrigin];

      // Check for exact match in allowed origins (e.g. localhost)
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }

      // Check for .tixmo.co subdomains (Regex)
      // Allows: https://demo.tixmo.co, https://anything.tixmo.co
      const tixmoPattern = /^https:\/\/(?:[a-zA-Z0-9-]+\.)+tixmo\.co$/;
      if (tixmoPattern.test(origin)) {
        return callback(null, true);
      }

      // Railway apps for dynamic preview branches should be added to CORS_ORIGIN
      // Removed insecure wildcard check for .up.railway.app

      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    },
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging
app.use(requestLogger);
app.use(requestLogger);

// Rate limiting
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from './config/redis';
import { waitingRoom } from './middleware/waitingRoom';

// ... (previous imports)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store
  store: new RedisStore({
    // @ts-ignore - Known issue with rate-limit-redis types and redis v4
    sendCommand: (...args: string[]) => getRedisClient().sendCommand(args),
  }),
});

// Apply Waiting Room first (throttle high traffic)
app.use(waitingRoom);

// Apply Rate Limiter
app.use(limiter);
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
app.use('/api', apiRoutes);

// 404 handler
app.use(notFoundHandler);

// If Sentry is enabled, use the Sentry error handler before the app's error handler
if (config.sentryDsn) {
  app.use(Sentry.Handlers.errorHandler());
}

// Error handler (must be last)
app.use(errorHandler);

export default app;
