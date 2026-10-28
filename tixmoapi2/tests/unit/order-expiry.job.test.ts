jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: { order: { findMany: jest.fn() } },
}));
jest.mock('../../src/api/orders/service', () => ({
  orderService: { cancelExpiredOrder: jest.fn() },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/config/environment', () => ({
  config: { cartExpiryMinutes: 15 },
}));

import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { processExpiredOrders } from '../../src/jobs/order-expiry.job';

const findMany = prisma.order.findMany as jest.Mock;
const cancel = orderService.cancelExpiredOrder as jest.Mock;

beforeEach(() => {
  findMany.mockReset();
  cancel.mockReset();
});

it('keeps cancelling the rest of a small batch when one expiry transaction expires', async () => {
  const batch = Array.from({ length: 10 }, (_, index) => ({
    id: `id-${index}`,
    orderNumber: `ORD-${index}`,
  }));
  findMany.mockResolvedValue(batch);
  cancel.mockImplementation(async (id: string) => {
    if (id === 'id-0') {
      throw new Error('commit cannot be executed on an expired transaction');
    }
    return { id, status: 'CANCELLED' };
  });

  await processExpiredOrders();

  expect(findMany).toHaveBeenCalledTimes(1);
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  expect(cancel.mock.calls.map((call) => call[0])).toEqual(batch.map((order) => order.id));
});

it('retries a failed expiry on the next sweep', async () => {
  findMany.mockResolvedValueOnce([{ id: 'ghost', orderNumber: 'ORD-GHOST' }]);
  cancel.mockRejectedValueOnce(new Error('commit cannot be executed on an expired transaction'));
  await processExpiredOrders();

  findMany.mockResolvedValueOnce([{ id: 'ghost', orderNumber: 'ORD-GHOST' }]);
  cancel.mockResolvedValueOnce({ id: 'ghost', status: 'CANCELLED' });
  await processExpiredOrders();

  expect(cancel.mock.calls.map((call) => call[0])).toEqual(['ghost', 'ghost']);
});

it('does not start a second sweep while the first batch is still cancelling', async () => {
  let release: (value: unknown) => void = () => undefined;
  findMany.mockResolvedValue([{ id: 'a', orderNumber: 'ORD-A' }]);
  cancel.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );

  const first = processExpiredOrders();
  await new Promise((resolve) => setImmediate(resolve));
  await processExpiredOrders();
  expect(cancel).toHaveBeenCalledTimes(1);
  release({ id: 'a', status: 'CANCELLED' });
  await first;
});
