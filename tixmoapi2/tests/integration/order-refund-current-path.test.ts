// Current-path qualification only. Historical stale-request assertions remain untouched.
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
jest.mock('stripe', () =>
  jest.fn(() => ({
    paymentIntents: { retrieve: jest.fn() },
    refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
  }))
);
import prisma from '../../src/config/prisma';
import { paymentService } from '../../src/api/payments/service';
import { OrderService } from '../../src/api/orders/service';

const provider = (paymentService as any).stripe;
async function fixture(status: 'VALID' | 'USED' | 'TRANSFERRED' = 'VALID') {
  const key = `refund325-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const org = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const user = await prisma.user.create({
    data: {
      email: `${key}@example.test`,
      passwordHash: 'synthetic',
      firstName: 'Fixture',
      lastName: '325',
    },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      name: key,
      slug: key,
      tags: [],
      status: 'ON_SALE',
      startDatetime: new Date(Date.now() + 86400000),
    },
  });
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: 10,
      quantityAvailable: 8,
      quantitySold: 2,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: key,
      userId: user.id,
      eventId: event.id,
      totalAmount: 20,
      currency: 'cad',
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      paymentIntentId: `pi_${key}`,
      tickets: {
        create: [0, 1].map((i) => ({
          eventId: event.id,
          userId: user.id,
          ticketTypeId: type.id,
          barcode: `${key}-${i}`,
          pricePaid: 10,
          status,
          inventoryState: 'SOLD',
        })),
      },
    },
    include: { tickets: { orderBy: { id: 'asc' } } },
  });
  provider.paymentIntents.retrieve.mockResolvedValue({
    id: order.paymentIntentId,
    status: 'succeeded',
    amount: 2000,
    amount_received: 2000,
    currency: 'cad',
  });
  provider.refunds.list.mockResolvedValue({ data: [] });
  provider.refunds.create.mockImplementation(async (params: any) => ({
    id: `re_${key}`,
    status: 'succeeded',
    amount: params.amount,
    currency: 'cad',
    payment_intent: params.payment_intent,
    metadata: params.metadata,
  }));
  return { order, type };
}
beforeEach(() => jest.clearAllMocks());
afterAll(async () => prisma.$disconnect());
test.each(['USED', 'TRANSFERRED'] as const)(
  'denied %s remains unchanged before provider operations',
  async (status) => {
    const { order, type } = await fixture(status);
    await expect(new OrderService().refundOrder(order.id)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(
      await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      })
    ).toEqual(order);
    expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
    expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
    expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
    expect(provider.refunds.create).not.toHaveBeenCalled();
  }
);
test('matching inert provider success finalizes SOLD inventory once and retry is idempotent', async () => {
  const { order, type } = await fixture();
  await expect(new OrderService().refundOrder(order.id)).resolves.toMatchObject({
    status: 'REFUNDED',
    paymentStatus: 'REFUNDED',
  });
  const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect([after.quantityAvailable, after.quantityHeld, after.quantitySold]).toEqual([10, 0, 0]);
  const tickets = await prisma.ticket.findMany({ where: { orderId: order.id } });
  expect(tickets).toHaveLength(2);
  expect(tickets.every((t) => t.status === 'CANCELLED' && t.inventoryState === 'RELEASED')).toBe(
    true
  );
  const refund = await prisma.paymentRefund.findUniqueOrThrow({
    where: { paymentIntentId: order.paymentIntentId! },
  });
  expect(refund).toMatchObject({ status: 'SUCCEEDED', amount: 2000, reason: 'ORDER_REFUND' });
  expect(provider.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 2000 }), {
    idempotencyKey: `refund-${refund.id}`,
  });
  await expect(new OrderService().refundOrder(order.id)).resolves.toMatchObject({
    status: 'REFUNDED',
    paymentStatus: 'REFUNDED',
  });
  expect(provider.refunds.create).toHaveBeenCalledTimes(1);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(after);
});
test('pending inert refund does not finalize financial or inventory state', async () => {
  const { order, type } = await fixture();
  provider.refunds.create.mockImplementation(async (p: any) => ({
    id: 're_pending325',
    status: 'pending',
    amount: p.amount,
    currency: 'cad',
    payment_intent: p.payment_intent,
  }));
  await expect(new OrderService().refundOrder(order.id)).resolves.toMatchObject({
    status: 'PAID',
    refundStatus: 'PROCESSING',
  });
  expect(
    await prisma.paymentRefund.findUniqueOrThrow({
      where: { paymentIntentId: order.paymentIntentId! },
    })
  ).toMatchObject({
    orderId: order.id,
    paymentIntentId: order.paymentIntentId,
    amount: 2000,
    currency: 'cad',
    reason: 'ORDER_REFUND',
    status: 'PROCESSING',
    stripeRefundId: 're_pending325',
    errorMessage: null,
  });
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
  expect(
    await prisma.ticket.findMany({ where: { orderId: order.id }, orderBy: { id: 'asc' } })
  ).toEqual(order.tickets);
});

// Actual authorized request observation followed by a committed competing write.
test('stale scoped refund payment observation refuses before provider or ledger writes', async () => {
  const { order, type } = await fixture();
  await prisma.user.update({
    where: { id: order.userId },
    data: {
      role: 'ADMIN',
      organizationId: (await prisma.event.findUniqueOrThrow({ where: { id: order.eventId } }))
        .organizationId,
    },
  });
  const original = prisma.order.findFirst.bind(prisma.order);
  let changed: any;
  const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementationOnce((async (args: any) => {
    const observed = await original(args);
    expect(observed?.paymentStatus).toBe('SUCCEEDED');
    changed = await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED' },
      include: { tickets: { orderBy: { id: 'asc' } } },
    });
    return observed;
  }) as any);
  try {
    await expect(new OrderService().refundOrder(order.id, order.userId)).rejects.toMatchObject({
      statusCode: 400,
    });
  } finally {
    spy.mockRestore();
  }
  expect(changed).toBeDefined();
  expect(
    await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    })
  ).toEqual(changed);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
  expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
});

test('stable FAILED local payment status is not a new categorical refund prohibition', async () => {
  const { order } = await fixture();
  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } });
  await expect(new OrderService().refundOrder(order.id)).resolves.toMatchObject({
    status: 'REFUNDED',
    paymentStatus: 'REFUNDED',
  });
  expect(provider.refunds.create).toHaveBeenCalledTimes(1);
});

test('direct payment ingress refuses committed change after its real preflight', async () => {
  const { order, type } = await fixture();
  const original = prisma.order.findUnique.bind(prisma.order);
  let changed: any;
  const spy = jest.spyOn(prisma.order, 'findUnique').mockImplementationOnce((async (args: any) => {
    const observed = await original(args);
    changed = await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED' },
      include: { tickets: { orderBy: { id: 'asc' } } },
    });
    return observed;
  }) as any);
  try {
    await expect(paymentService.refundOrder(order.id)).rejects.toMatchObject({ statusCode: 400 });
  } finally {
    spy.mockRestore();
  }
  expect(changed).toBeDefined();
  expect(
    await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    })
  ).toEqual(changed);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
  expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
});
