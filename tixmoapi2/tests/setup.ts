/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */

// Mock Redis client globally
jest.mock('../src/config/redis', () => {
    const mockClient = {
        sendCommand: jest.fn().mockResolvedValue('OK'), // Generic success for unknown commands
        on: jest.fn(),
        connect: jest.fn(),
        quit: jest.fn(),
        incr: jest.fn().mockResolvedValue(1),
        decr: jest.fn().mockResolvedValue(0),
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        isOpen: true,
    };

    return {
        connectRedis: jest.fn().mockResolvedValue(mockClient),
        getRedisClient: jest.fn().mockReturnValue(mockClient),
        disconnectRedis: jest.fn(),
    };
});

// Mock rate-limit-redis to avoid complex Redis interactions
jest.mock('rate-limit-redis', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            init: jest.fn(),
            increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
            decrement: jest.fn(),
            resetKey: jest.fn(),
        })),
    };
});

// Mock logger to reduce noise
jest.mock('../src/config/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        http: jest.fn(), // Missing method
    },
}));
