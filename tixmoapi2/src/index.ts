import { config } from '@config/environment';
import { logger } from '@config/logger';
import { connectDatabase } from '@config/database';
import { connectRedis, getRedisClient } from '@config/redis';
import { startApprovalReminderJob } from './jobs/approval-reminder.job';
import { startOrderExpiryJob } from './jobs/order-expiry.job';
import { startPaymentRecoveryJob } from './jobs/payment-recovery.job';

// app imported dynamically after connection

const port = config.port || 3000;

void (async () => {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('✅ Database connected successfully');

    // Redis is optional for login and scan. A short connect timeout still leaves
    // the client reconnecting so /ready recovers when Redis returns.
    await connectRedis();
    if (getRedisClient().isReady) {
      logger.info('✅ Redis connected successfully');
    } else {
      logger.warn('Redis not ready; serving requests with local fallbacks until it reconnects');
    }

    // Start Express server
    const app = (await import('./app')).default;
    app.listen(port, () => {
      logger.info(`🚀 Tixmo API Server started on port ${port}`);
      logger.info(`📝 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 API URL: http://localhost:${port}/api/${config.apiVersion}`);
      logger.info(`❤️  Health Check: http://localhost:${port}/health`);

      // Start background jobs
      startOrderExpiryJob();
      startPaymentRecoveryJob();
      startApprovalReminderJob();
    });
  } catch (err) {
    logger.error('Failed to start server', err as Error);
    process.exit(1);
  }
})();
