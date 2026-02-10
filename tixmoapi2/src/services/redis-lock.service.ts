import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';
import crypto from 'crypto';

export class RedisLockService {
    /**
     * Acquire a distributed lock with a unique owner token.
     * @param key The lock key (e.g., 'lock:event:123')
     * @param ttl Time to live in milliseconds (default 5000ms)
     * @returns The owner token if lock acquired, null otherwise.
     *          Callers must pass this token to releaseLock().
     */
    async acquireLock(key: string, ttl: number = 5000): Promise<string | null> {
        try {
            const client = getRedisClient();
            const token = crypto.randomUUID();

            // SET key token NX PX ttl
            // NX: Only set if the key does not exist
            // PX: Set the specified expire time, in milliseconds
            const result = await client.set(key, token, {
                NX: true,
                PX: ttl
            });

            return result === 'OK' ? token : null;
        } catch (error) {
            logger.error(`Failed to acquire lock for ${key}`, error);
            return null;
        }
    }

    /**
     * Release a distributed lock, but ONLY if we still own it.
     * Uses a Lua script for atomic check-and-delete to prevent
     * releasing a lock that was acquired by another process after
     * our lock expired.
     *
     * @param key The lock key
     * @param token The owner token returned by acquireLock()
     * @returns true if the lock was released, false if we no longer owned it
     */
    async releaseLock(key: string, token: string): Promise<boolean> {
        try {
            const client = getRedisClient();

            // Atomic check-and-delete: only delete if value matches our token
            const luaScript = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;

            const result = await client.eval(luaScript, {
                keys: [key],
                arguments: [token],
            });

            if (result === 0) {
                logger.warn(`Lock ${key} was not released — token mismatch (lock may have expired)`);
                return false;
            }
            return true;
        } catch (error) {
            logger.error(`Failed to release lock for ${key}`, error);
            return false;
        }
    }
}

export const redisLockService = new RedisLockService();
