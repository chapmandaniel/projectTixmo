jest.mock('../../src/api/orders/service', () => ({
  orderService: { claimNextExpiredOrder: jest.fn() },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/config/environment', () => ({
  config: { cartExpiryMinutes: 15 },
}));

import { orderService } from '../../src/api/orders/service';
import { logger } from '../../src/config/logger';
import { processExpiredOrders } from '../../src/jobs/order-expiry.job';

const claim = orderService.claimNextExpiredOrder as jest.Mock;
const info = logger.info as jest.Mock;

beforeEach(() => {
  claim.mockReset();
  info.mockReset();
  (logger.error as jest.Mock).mockReset();
});

it('keeps cancelling the rest of a small batch when one expiry transaction expires', async () => {
  const batch = Array.from({ length: 10 }, (_, index) => ({
    id: `id-${index}`,
    orderNumber: `ORD-${index}`,
  }));
  const queue = [...batch];
  claim.mockImplementation(() => {
    const order = queue.shift();
    if (!order) return { status: 'empty' };
    if (order.id === 'id-0') {
      return {
        status: 'failed',
        id: order.id,
        orderNumber: order.orderNumber,
        error: new Error('commit cannot be executed on an expired transaction'),
      };
    }
    return { status: 'cancelled', id: order.id, orderNumber: order.orderNumber };
  });

  await processExpiredOrders();

  expect(claim).toHaveBeenCalledTimes(10);
  expect(claim.mock.calls.map((call) => call[0])).toEqual([
    [],
    ['id-0'],
    ['id-0'],
    ['id-0'],
    ['id-0'],
    ['id-0'],
    ['id-0'],
    ['id-0'],
    ['id-0'],
    ['id-0'],
  ]);
  const cancelled = info.mock.calls.map((call) => String(call[0]));
  expect(cancelled.some((line) => line.includes('Cancelled expired order ORD-0'))).toBe(false);
  for (let index = 1; index < 10; index += 1) {
    expect(
      cancelled.filter((line) => line.includes(`Cancelled expired order ORD-${index}`))
    ).toEqual([`  ✓ Cancelled expired order ORD-${index}`]);
  }
});

it('does not spend a claim slot or log a cancel when the order is already gone', async () => {
  let n = 0;
  claim.mockImplementation(() => {
    n += 1;
    if (n === 1) return { status: 'skipped', id: 'gone', orderNumber: 'ORD-GONE' };
    if (n <= 11) return { status: 'cancelled', id: `id-${n}`, orderNumber: `ORD-${n}` };
    return { status: 'empty' };
  });

  await processExpiredOrders();

  const cancelled = info.mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.includes('Cancelled expired order'));
  expect(cancelled).toHaveLength(10);
  expect(cancelled.some((line) => line.includes('ORD-GONE'))).toBe(false);
  expect(new Set(cancelled).size).toBe(cancelled.length);
});

it('retries a failed expiry on the next sweep', async () => {
  claim
    .mockResolvedValueOnce({
      status: 'failed',
      id: 'ghost',
      orderNumber: 'ORD-GHOST',
      error: new Error('commit cannot be executed on an expired transaction'),
    })
    .mockResolvedValueOnce({ status: 'empty' });
  await processExpiredOrders();

  claim
    .mockResolvedValueOnce({ status: 'cancelled', id: 'ghost', orderNumber: 'ORD-GHOST' })
    .mockResolvedValueOnce({ status: 'empty' });
  await processExpiredOrders();

  expect(claim.mock.calls.map((call) => call[0])).toEqual([[], ['ghost'], [], []]);
  const cancelled = info.mock.calls.map((call) => String(call[0]));
  expect(cancelled.filter((line) => line.includes('Cancelled expired order ORD-GHOST'))).toEqual([
    '  ✓ Cancelled expired order ORD-GHOST',
  ]);
});

it('does not start a second sweep while the first batch is still cancelling', async () => {
  let release: (value: unknown) => void = () => undefined;
  claim.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );

  const first = processExpiredOrders();
  await new Promise((resolve) => setImmediate(resolve));
  await processExpiredOrders();
  expect(claim).toHaveBeenCalledTimes(1);
  release({ status: 'empty' });
  await first;
});
