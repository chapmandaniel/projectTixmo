
import { EventService } from '../../src/api/events/service';
import prisma from '../../src/config/prisma';

// Mock Redis
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();
const mockScanIterator = jest.fn();

// Mock Redis configuration
jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn(() => ({
    get: mockGet,
    set: mockSet,
    del: mockDel,
    scanIterator: mockScanIterator,
    isOpen: true,
  })),
}));

// Mock Prisma
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock Logger
jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Event Public API Caching Benchmark', () => {
  let eventService: EventService;
  const SLUG = 'test-event-slug';
  const MOCK_EVENT = {
    id: 'evt-123',
    name: 'Test Event',
    slug: SLUG,
    status: 'PUBLISHED',
    startDatetime: new Date(),
    endDatetime: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    eventService = new EventService();

    // Default Prisma Mock: Slow Query
    (prisma.event.findFirst as jest.Mock).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms DB latency
      return MOCK_EVENT;
    });

    // Default Redis Mock: Cache Miss
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue('OK');
  });

  it('measures performance of getPublicEventBySlug', async () => {
    console.log('--- START BENCHMARK ---');

    // 1. First Call (Cold Start / Cache Miss)
    const start1 = performance.now();
    await eventService.getPublicEventBySlug(SLUG);
    const end1 = performance.now();
    const duration1 = end1 - start1;
    console.log(`1. First Call (Cold): ${duration1.toFixed(2)}ms`);

    // If implementation is present, simulate cache hit for next call
    if (mockSet.mock.calls.length > 0) {
        // Implementation is present, simulate cache hit for next call
        const storedValue = mockSet.mock.calls[0][1];
        mockGet.mockResolvedValue(storedValue);
        console.log('   (Cache was populated)');
    } else {
        console.log('   (Cache was NOT populated - Baseline)');
    }

    // 2. Second Call (Hot / Cache Hit expected)
    const start2 = performance.now();
    await eventService.getPublicEventBySlug(SLUG);
    const end2 = performance.now();
    const duration2 = end2 - start2;
    console.log(`2. Second Call (Hot): ${duration2.toFixed(2)}ms`);

    if (duration2 < 10 && duration1 > 40) {
        console.log('✅ CACHING DETECTED: Significant speedup!');
    } else {
        console.log('⚠️ NO CACHING DETECTED: Similar duration.');
    }
    console.log('--- END BENCHMARK ---');
  });
});
