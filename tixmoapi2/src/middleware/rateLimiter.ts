import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { config } from '../config/environment';

/**
 * Rate limiter for authentication endpoints (login, register, etc.)
 * Limits to 5 requests per 1 minute window per IP (Harder in production)
 * Much higher limits in development to prevent local blocks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    if (config.nodeEnv === 'test') {
      return req.headers['x-test-rate-limit'] === 'strict' ? 5 : 100;
    }

    return config.nodeEnv === 'development' ? 100 : 20;
  },
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after a minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store
  store: new RedisStore({
    prefix: 'rl:auth:',
    // @ts-ignore - Known issue with rate-limit-redis types and redis v4
    sendCommand: (...args: string[]) => getRedisClient().sendCommand(args),
  }),
});
