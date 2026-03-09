import { redisLockService } from '../../src/services/redis-lock.service';
import { getRedisClient } from '../../src/config/redis';

// Mock getRedisClient
jest.mock('../../src/config/redis', () => ({
    getRedisClient: jest.fn(),
}));

describe('RedisLockService', () => {
    let mockSet: jest.Mock;
    let mockEval: jest.Mock;

    beforeEach(() => {
        mockSet = jest.fn();
        mockEval = jest.fn();
        (getRedisClient as jest.Mock).mockReturnValue({
            set: mockSet,
            eval: mockEval,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('acquireLock', () => {
        it('should return true when lock is acquired successfully', async () => {
            mockSet.mockResolvedValue('OK');

            const result = await redisLockService.acquireLock('test-key', 5000);

            expect(typeof result).toBe('string');
            expect(mockSet).toHaveBeenCalledWith(
                'test-key',
                expect.any(String),
                { PX: 5000, NX: true }
            );
        });

        it('should return false when lock is already held', async () => {
            mockSet.mockResolvedValue(null);

            const result = await redisLockService.acquireLock('test-key', 5000);

            expect(result).toBeNull();
            expect(mockSet).toHaveBeenCalledWith(
                'test-key',
                expect.any(String),
                { PX: 5000, NX: true }
            );
        });

        it('should return false if redis throws an error', async () => {
            mockSet.mockRejectedValue(new Error('Redis error'));

            const result = await redisLockService.acquireLock('test-key', 5000);

            expect(result).toBeNull();
        });
    });

    describe('releaseLock', () => {
        it('should release the lock', async () => {
            mockEval.mockResolvedValue(1);

            const result = await redisLockService.releaseLock('test-key', 'lock-token');

            expect(result).toBe(true);
            expect(mockEval).toHaveBeenCalledWith(
                expect.any(String),
                {
                    keys: ['test-key'],
                    arguments: ['lock-token'],
                }
            );
        });

        it('should handle errors gracefully during release', async () => {
            mockEval.mockRejectedValue(new Error('Redis error'));

            await expect(redisLockService.releaseLock('test-key', 'lock-token')).resolves.toBe(false);
        });
    });
});
