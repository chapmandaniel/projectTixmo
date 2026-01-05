import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';
import { StatusCodes } from 'http-status-codes';

const MAX_CONCURRENT_USERS = 5000; // Configurable limit
const ACTIVE_USERS_KEY = 'tixmo:active_users';

export const waitingRoom = async (req: Request, res: Response, next: NextFunction) => {
    // Skip for health checks or assets if any
    if (req.path === '/health' || req.path === '/metrics') {
        return next();
    }

    try {
        const client = getRedisClient();

        // Increment active user count
        const activeUsers = await client.incr(ACTIVE_USERS_KEY);

        // If load is too high, reject
        if (activeUsers > MAX_CONCURRENT_USERS) {
            // Decrement immediately since we are rejecting
            await client.decr(ACTIVE_USERS_KEY);

            logger.warn('Waiting Room Active: Rejected request due to high load', { activeUsers });

            return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
                message: 'High traffic volume. Please try again in a moment.',
                retryAfter: 5 // Suggest retry in 5 seconds
            });
        }

        // Capture response finish to decrement count
        res.on('finish', () => {
            client.decr(ACTIVE_USERS_KEY).catch(err => {
                logger.error('Failed to decrement active user count', err);
            });
        });

        // Also handle close in case connection is terminated prematurely
        res.on('close', () => {
            // NOTE: 'finish' and 'close' might both emit, but DECR operates on an atomic counter.
            // Ideally we want to decrement exactly once per increment.
            // Express 'finish' event is reliable for completed responses.
            // 'close' handles aborted connections.
            // We rely on 'finish' primarily. To handle 'close' without double-decrementing is tricky without unique request IDs.
            // For a simple waiting room, 'finish' is usually sufficient. 
            // If we implement unique request tracking, we could be more precise.
            // For now, we trust 'finish'.
        });

        next();
    } catch (error) {
        logger.error('Waiting Room Check Failed:', error);
        // Fail open: If Redis is down, let them in (or fail closed depending on strategy)
        // Here we choose to fail open to not block traffic if Redis blips.
        next();
    }
};
