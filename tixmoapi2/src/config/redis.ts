import { createClient } from 'redis';
import { config } from './environment';
import { logger } from './logger';

type RedisClientType = ReturnType<typeof createClient>;

let redisClient: RedisClientType | null = null;

export const connectRedis = async (): Promise<RedisClientType> => {
  try {
    if (redisClient) {
      return redisClient;
    }

    redisClient = createClient({
      url: config.redisUrl,
      password: config.redisPassword,
      database: config.redisDb,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis first.');
  }
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis disconnected');
    }
  } catch (error) {
    logger.error('Redis disconnection failed:', error);
    throw error;
  }
};
