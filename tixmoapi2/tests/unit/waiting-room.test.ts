import { Request, Response, NextFunction } from 'express';
import { waitingRoom } from '../../src/middleware/waitingRoom';
import { getRedisClient } from '../../src/config/redis';

// Mock getRedisClient
jest.mock('../../src/config/redis', () => ({
    getRedisClient: jest.fn(),
}));

describe('Waiting Room Middleware', () => {
    let mockIncr: jest.Mock;
    let mockDecr: jest.Mock;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        mockIncr = jest.fn();
        mockDecr = jest.fn();
        (getRedisClient as jest.Mock).mockReturnValue({
            incr: mockIncr,
            decr: mockDecr,
        });

        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            on: jest.fn(), // for response 'finish' event
        };
        next = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow request if user count is within limit', async () => {
        mockIncr.mockResolvedValue(100); // 100 active users

        await waitingRoom(req as Request, res as Response, next);

        expect(mockIncr).toHaveBeenCalled();
        expect(next).toHaveBeenCalled(); // Should proceed
        expect(res.status).not.toHaveBeenCalledWith(503);
    });

    it('should block request if user count exceeds limit', async () => {
        mockIncr.mockResolvedValue(5001); // Limit is 5000

        await waitingRoom(req as Request, res as Response, next);

        expect(mockIncr).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('High traffic'),
        }));
        // Should NOT call next()
        expect(next).not.toHaveBeenCalled();
        // Should decrement immediately since request is rejected
        expect(mockDecr).toHaveBeenCalled();
    });

    it('should setup cleanup on response finish', async () => {
        mockIncr.mockResolvedValue(100);

        await waitingRoom(req as Request, res as Response, next);

        expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));

        // Simulate finish event
        mockDecr.mockResolvedValue(0);
        const finishCallback = (res.on as jest.Mock).mock.calls[0][1];
        await finishCallback();

        expect(mockDecr).toHaveBeenCalled();
    });

    it('should bypass waiting room if Redis fails', async () => {
        mockIncr.mockRejectedValue(new Error('Redis down'));

        await waitingRoom(req as Request, res as Response, next);

        // Fail open - should proceed
        expect(next).toHaveBeenCalled();
    });
});
