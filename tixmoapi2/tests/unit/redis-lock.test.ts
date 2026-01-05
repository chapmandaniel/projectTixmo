import { redisLockService } from '../../src/services/redis-lock.service';
import { getRedisClient } from '../../src/config/redis';

// Mock getRedisClient
jest.mock('../../src/config/redis', () => ({
    getRedisClient: jest.fn(),
}));

describe('RedisLockService', () => {
    let mockSet: jest.Mock;
    let mockDel: jest.Mock;

    beforeEach(() => {
        mockSet = jest.fn();
        mockDel = jest.fn();
        (getRedisClient as jest.Mock).mockReturnValue({
            set: mockSet,
            del: mockDel,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('acquireLock', () => {
        it('should return true when lock is acquired successfully', async () => {
            mockSet.mockResolvedValue('OK');

            const result = await redisLockService.acquireLock('test-key', 5000);

            expect(result).toBe(true);
            expect(mockSet).toHaveBeenCalledWith('test-key', 'locked', { PX: 5000, NX: true });
        });

        it('should return false when lock is already held', async () => {
            mockSet.mockResolvedValue(null);

            const result = await redisLockService.acquireLock('test-key', 5000);

            expect(result).toBe(false);
            expect(mockSet).toHaveBeenCalledWith('test-key', 'locked', { PX: 5000, NX: true });
        });

        it('should return false if redis throws an error', async () => {
            mockSet.mockRejectedValue(new Error('Redis error'));

            const result = await redisLockService.acquireLock('test-key', 5000);

            expect(result).toBe(false);
        });
    });

    describe('releaseLock', () => {
        it('should release the lock', async () => {
            mockDel.mockResolvedValue(1);

            await redisLockService.releaseLock('test-key');

            expect(mockDel).toHaveBeenCalledWith('test-key');
        });

        it('should handle errors gracefully during release', async () => {
            mockDel.mockRejectedValue(new Error('Redis error'));

            // Should not throw
            await expect(redisLockService.releaseLock('test-key')).resolves.not.toThrow();
        });
    });
});
