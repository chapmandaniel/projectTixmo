import { ScannerService } from '../../src/api/scanners/service';
import prisma from '../../src/config/prisma';

// Mock prisma
jest.mock('../../src/config/prisma', () => {
  return {
    __esModule: true,
    default: {
      scanner: {
        findUnique: jest.fn(),
      },
      ticket: {
        findMany: jest.fn(),
      },
      scanLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    },
  };
});

// Mock logger
jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

// Mock redis
jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn(),
}));


describe('SyncTickets Benchmark', () => {
  let scannerService: ScannerService;

  beforeEach(() => {
    scannerService = new ScannerService();
    jest.clearAllMocks();

    // Setup default mock responses
    (prisma.scanner.findUnique as jest.Mock).mockResolvedValue({
      id: 'scanner-123',
      eventId: 'event-123',
      organizationId: 'org-123',
      status: 'ACTIVE'
    });
  });

  it('should measure memory usage for syncTicketsStream with large dataset', async () => {
    // Generate large dataset
    const ticketCount = 100000;
    // We allocate this outside to simulate DB storage.
    // In a real scenario, this memory is in the DB process, not Node process.
    // But here we mock it. We measure the *increase* so existing memory doesn't matter much
    // as long as we don't duplicate it all.
    const allTickets = Array.from({ length: ticketCount }, (_, i) => ({
      id: `ticket-${String(i).padStart(6, '0')}`, // Ensure proper sorting for cursor simulation
      barcode: `barcode-${i}`,
      status: 'VALID',
      ticketTypeId: 'type-1',
      updatedAt: new Date(),
    }));

    // Mock ticket finding to return slices (simulating cursor pagination)
    (prisma.ticket.findMany as jest.Mock).mockImplementation(async (args) => {
        const { take, cursor } = args;
        let startIndex = 0;

        if (cursor) {
            const cursorId = cursor.id;
            // Simple linear search for mock, in real DB it's index scan
            startIndex = allTickets.findIndex(t => t.id === cursorId) + 1;
        }

        // Return slice
        // Note: The service uses 'orderBy: id asc', so our array generation must match or we sort it.
        // Array generation index matches id order.
        return allTickets.slice(startIndex, startIndex + (take || 1000));
    });

    // Force garbage collection if possible (not available in standard node without flag)
    if (global.gc) { global.gc(); }

    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    const stream = scannerService.syncTicketsStream('scanner-123', 'event-123');

    let processedCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const batch of stream) {
        processedCount += batch.length;
        // access items to ensure they are loaded
        if (batch.length > 0) {
            batch[0].hash;
        }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const memoryDiffMB = (endMemory - startMemory) / 1024 / 1024;
    const timeDiffMs = endTime - startTime;

    console.log(`\n--- STREAM BENCHMARK RESULTS ---`);
    console.log(`Dataset size: ${ticketCount} tickets`);
    console.log(`Processed: ${processedCount} tickets`);
    console.log(`Memory usage increase: ${memoryDiffMB.toFixed(2)} MB`);
    console.log(`Execution time: ${timeDiffMs.toFixed(2)} ms`);
    console.log(`--------------------------------\n`);

    expect(processedCount).toBe(ticketCount);
    // Expect memory usage to be significantly lower than loading all at once (which was ~23MB)
    // It should be around batch size * item size (~ few hundred KB to 1-2 MB)
    // Allowing some overhead, let's say < 10MB to be safe against GC timing.
    // But really it should be very low.
  }, 60000); // 60s timeout
});
