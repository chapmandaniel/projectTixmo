import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

export class RedisLockService {
    /**
     * Acquire a distributed lock.
     * @param key The lock key (e.g., 'lock:event:123')
     * @param ttl Time to live in milliseconds (default 5000ms)
     * @returns true if lock acquired, false otherwise
     */
    async acquireLock(key: string, ttl: number = 5000): Promise<boolean> {
        try {
            const client = getRedisClient();
            // SET key value NX PX ttl
            // NX: Only set if the key does not exist
            // PX: Set the specified expire time, in milliseconds
            const result = await client.set(key, 'locked', {
                NX: true,
                PX: ttl
            });

            return result === 'OK';
        } catch (error) {
            logger.error(`Failed to acquire lock for ${key}`, error);
            return false;
        }
    }

    /**
     * Release a distributed lock.
     * @param key The lock key
     */
    async releaseLock(key: string): Promise<void> {
        try {
            const client = getRedisClient();
            await client.del(key);
        } catch (error) {
            logger.error(`Failed to release lock for ${key}`, error);
        }
    }
}

export const redisLockService = new RedisLockService();
