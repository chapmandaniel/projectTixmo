import crypto from 'crypto';

// Mock Prisma
const mockCreate = jest.fn();
const mockCreateMany = jest.fn();

jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    ticket: {
      create: mockCreate,
      createMany: mockCreateMany,
    },
    $transaction: jest.fn((cb) => cb({
        ticket: {
            create: mockCreate,
            createMany: mockCreateMany,
        }
    })),
  },
}));

// Simulate latency
const DELAY_PER_INSERT = 5; // ms
const DELAY_PER_BATCH = 15; // ms

mockCreate.mockImplementation(async () => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_PER_INSERT));
  return {};
});

mockCreateMany.mockImplementation(async () => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_PER_BATCH));
  return { count: 1 }; // Return value doesn't matter much for benchmark
});


describe('Ticket Creation Benchmark', () => {
  const sortedItems = [
    { ticketTypeId: 'type1', quantity: 20 },
    { ticketTypeId: 'type2', quantity: 20 },
    { ticketTypeId: 'type3', quantity: 20 },
    { ticketTypeId: 'type4', quantity: 20 },
    { ticketTypeId: 'type5', quantity: 20 },
  ];

  const ticketTypeMap = new Map([
    ['type1', { price: 10 }],
    ['type2', { price: 20 }],
    ['type3', { price: 30 }],
    ['type4', { price: 40 }],
    ['type5', { price: 50 }],
  ]);

  const tierPriceMap = new Map();
  const newOrder = { id: 'order-123' };
  const userId = 'user-123';
  const eventId = 'event-123';

  // Re-implementation of the current Loop Logic for benchmark
  const createTicketsLoop = async (tx: any) => {
    for (const item of sortedItems) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      for (let j = 0; j < item.quantity; j++) {
        const secureBarcode = `TIX-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
        const pricePaid = tierPriceMap.get(item.ticketTypeId) ?? ticketType.price;
        await tx.ticket.create({
          data: {
            orderId: newOrder.id,
            userId,
            eventId,
            ticketTypeId: item.ticketTypeId,
            pricePaid,
            barcode: secureBarcode,
            status: 'VALID',
          },
        });
      }
    }
  };

  // Implementation of the Optimized Batch Logic for benchmark
  const createTicketsBatch = async (tx: any) => {
    const ticketData = [];
    for (const item of sortedItems) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      for (let j = 0; j < item.quantity; j++) {
        const secureBarcode = `TIX-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
        const pricePaid = tierPriceMap.get(item.ticketTypeId) ?? ticketType.price;
        ticketData.push({
          orderId: newOrder.id,
          userId,
          eventId,
          ticketTypeId: item.ticketTypeId,
          pricePaid,
          barcode: secureBarcode,
          status: 'VALID',
        });
      }
    }

    if (ticketData.length > 0) {
      await tx.ticket.createMany({
        data: ticketData,
      });
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Benchmarking: Loop vs Batch', async () => {
    // Measure Loop Approach
    const startLoop = performance.now();
    // We pass the mock object directly as 'tx'
    await createTicketsLoop({ ticket: { create: mockCreate } });
    const endLoop = performance.now();
    const timeLoop = endLoop - startLoop;

    // Measure Batch Approach
    const startBatch = performance.now();
    await createTicketsBatch({ ticket: { createMany: mockCreateMany } });
    const endBatch = performance.now();
    const timeBatch = endBatch - startBatch;

    console.log(`\n--- TICKET CREATION BENCHMARK ---`);
    console.log(`Total Tickets: ${sortedItems.reduce((acc, item) => acc + item.quantity, 0)}`);
    console.log(`Loop Approach Time: ${timeLoop.toFixed(2)} ms`);
    console.log(`Batch Approach Time: ${timeBatch.toFixed(2)} ms`);
    console.log(`Improvement: ${(timeLoop / timeBatch).toFixed(1)}x faster`);
    console.log(`---------------------------------\n`);

    expect(timeBatch).toBeLessThan(timeLoop);
  });
});
