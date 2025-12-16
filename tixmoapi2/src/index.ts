import { config } from '@config/environment';
import { logger } from '@config/logger';
import { connectDatabase } from '@config/database';
import { connectRedis } from '@config/redis';

import app from './app';

const port = config.port || 3000;

void (async () => {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('✅ Database connected successfully');

    // Connect to Redis
    await connectRedis();
    logger.info('✅ Redis connected successfully');

    // Start Express server
    app.listen(port, () => {
      logger.info(`🚀 TixMo API Server started on port ${port}`);
      logger.info(`📝 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 API URL: http://localhost:${port}/api/${config.apiVersion}`);
      logger.info(`❤️  Health Check: http://localhost:${port}/health`);
    });
  } catch (err) {
    logger.error('Failed to start server', err as Error);
    process.exit(1);
  }
})();
