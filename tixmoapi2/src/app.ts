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
    origin: config.corsOrigin,
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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
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
