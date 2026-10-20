jest.mock('../../src/utils/notificationService', () => ({ notificationService: { sendAdminAlert: jest.fn().mockResolvedValue(undefined) } }));
import prisma from '../../src/config/prisma';
import Stripe from 'stripe';
import { AsyncLocalStorage } from 'async_hooks';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { config } from '../../src/config/environment';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
async function bounded(promise: Promise<unknown>) {
  let timer: NodeJS.Timeout | undefined;
  try { await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Barrier timeout (harness failure)')), 5000);
  })]); } finally { if (timer) clearTimeout(timer); }
}

afterAll(async () => { await prisma.$disconnect(); });
test.each([false, true])('FAILED same-ID retry has one claimant (success completion last=%s)', async (successLast) => {
  const key = `race132-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, passwordHash: 'test-only', firstName: 'Race', lastName: 'Fixture' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [] } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 10, quantityAvailable: 6, quantityHeld: 4 } });
  const otherUser = await prisma.user.create({ data: { email: `${key}-other@example.test`, passwordHash: 'test-only', firstName: 'Other', lastName: 'Buyer' } });
  const makeOrder = (suffix: string, buyer = user.id) => prisma.order.create({ data: { orderNumber: `${key}-${suffix}`, userId: buyer, eventId: event.id, totalAmount: 20, paymentIntentId: suffix === 'a' ? `pi_${key}` : null, paymentStatus: suffix === 'a' ? 'PROCESSING' : 'PENDING',
    tickets: { create: [0, 1].map(i => ({ eventId: event.id, userId: buyer, ticketTypeId: type.id, barcode: `${key}-${suffix}-${i}`, pricePaid: 10 })) } }, include: { tickets: { orderBy: { id: 'asc' } } } });
  const target = await makeOrder('a');
  const otherBefore = await makeOrder('b', otherUser.id);

  const eventId = `evt_${key}`;
  await prisma.paymentWebhookEvent.create({ data: { id: eventId, type: 'payment_intent.succeeded', orderId: target.id, paymentIntentId: target.paymentIntentId, status: 'FAILED', errorMessage: 'prior confirmation failure' } });
  const invocation = new AsyncLocalStorage<number>();
  const claimRead = [deferred(), deferred()];
  const claimRelease = [deferred(), deferred()];
  const orderRead = [deferred(), deferred()];
  const orderRelease = [deferred(), deferred()];
  const successFinish = deferred();
  const successRelease = deferred();
  const trace: string[] = [];
  const originalRead = prisma.paymentWebhookEvent.findUnique.bind(prisma.paymentWebhookEvent);
  const originalWrite = prisma.paymentWebhookEvent.update.bind(prisma.paymentWebhookEvent);
  const originalOrder = prisma.order.findUnique.bind(prisma.order);
  let claims = 0;
  const gated = new Set<number>();
  const readSpy = jest.spyOn(prisma.paymentWebhookEvent, 'findUnique').mockImplementation((async (args: any) => {
    const index = invocation.getStore();
    const row = await originalRead(args);
    if (args.where.id === eventId && index !== undefined) {
      expect(row?.status).toBe('FAILED');
      trace.push(`claim-read-${index}-FAILED`); claimRead[index].resolve();
      await bounded(claimRelease[index].promise);
    }
    return row;
  }) as any);
  const writeSpy = jest.spyOn(prisma.paymentWebhookEvent, 'update').mockImplementation((async (args: any) => {
    const index = invocation.getStore();
    if (args.where.id === eventId && args.data.status === 'PROCESSED' && successLast) {
      successFinish.resolve(); await bounded(successRelease.promise);
    }
    const row = await originalWrite(args);
    if (args.where.id === eventId) {
      trace.push(`write-${index}-${args.data.status}`);
      if (args.data.status === 'PROCESSING') claims++;
    }
    return row;
  }) as any);
  const orderSpy = jest.spyOn(prisma.order, 'findUnique').mockImplementation((async (args: any) => {
    const index = invocation.getStore();
    const row = await originalOrder(args);
    if (args.where.id === target.id && index !== undefined && !gated.has(index)) {
      gated.add(index); expect(row?.status).toBe('PENDING');
      trace.push(`order-read-${index}-PENDING`); orderRead[index].resolve();
      await bounded(orderRelease[index].promise);
    }
    return row;
  }) as any);
  const service = new PaymentService();
  const email = jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue(undefined);
  const eventPayload = JSON.stringify({ id: eventId, object: 'event', type: 'payment_intent.succeeded', data: { object: { id: target.paymentIntentId, object: 'payment_intent', status: 'succeeded', metadata: { orderId: target.id, userId: user.id } } } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: eventPayload, secret: config.stripeWebhookSecret });
  const deliver = (index: number) => invocation.run(index, () => service.handleWebhook(signature, Buffer.from(eventPayload)));
  const calls = [deliver(0), deliver(1)];
  const outcomes = Promise.allSettled(calls);
  try {
    await bounded(Promise.all(claimRead.map(g => g.promise)));
    // Both return genuine FAILED snapshots, and both real claim writes complete.
    claimRelease[0].resolve(); await bounded(orderRead[0].promise);
    claimRelease[1].resolve(); await bounded(orderRead[1].promise);
    orderRelease[0].resolve();
    if (successLast) await bounded(successFinish.promise); else await calls[0];
    orderRelease[1].resolve();
    await calls[1].catch(() => undefined);
    successRelease.resolve();
    const settled = await outcomes;
    readSpy.mockRestore(); writeSpy.mockRestore(); orderSpy.mockRestore();
    const row = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    const a = await prisma.order.findUniqueOrThrow({ where: { id: target.id }, include: { tickets: { orderBy: { id: 'asc' } } } });
    const b = await prisma.order.findUniqueOrThrow({ where: { id: otherBefore.id }, include: { tickets: { orderBy: { id: 'asc' } } } });
    const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    console.log('TASK132_OBSERVED', JSON.stringify({ successLast, trace, claims, outcomes: settled.map(r => r.status), row, counters: [inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold] }));
    expect(settled.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    if (settled[1].status === 'rejected') expect(settled[1].reason).toMatchObject({ statusCode: 400, message: 'Cannot confirm order with status PAID' });
    expect(row).toMatchObject({ id: eventId, type: 'payment_intent.succeeded', orderId: target.id, paymentIntentId: target.paymentIntentId, status: successLast ? 'PROCESSED' : 'FAILED', errorMessage: successLast ? null : 'Cannot confirm order with status PAID', processedAt: expect.any(Date), processingStartedAt: expect.any(Date) });
    expect(await prisma.paymentWebhookEvent.count({ where: { id: eventId } })).toBe(1);
    expect(a.status).toBe('PAID'); expect(a.paymentStatus).toBe('SUCCEEDED');
    expect(a.paymentIntentId).toBe(target.paymentIntentId); expect(a.tickets).toEqual(target.tickets);
    expect(b).toEqual(otherBefore);
    expect([inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold]).toEqual([6, 2, 2]);
    expect(await prisma.ticket.count({ where: { ticketTypeId: type.id } })).toBe(4);
    expect(email).toHaveBeenCalledTimes(1);
    // Existing retry contract is a same-intent PAID no-op, not invented policy.
    const payload = Buffer.from(eventPayload);
    await service.handleWebhook(signature, payload);
    const recovered = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(recovered.status).toBe('PROCESSED'); expect(recovered.errorMessage).toBeNull();
    await service.handleWebhook(signature, payload);
    expect(await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })).toEqual(recovered);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: target.id }, include: { tickets: { orderBy: { id: 'asc' } } } })).toEqual(a);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: otherBefore.id }, include: { tickets: { orderBy: { id: 'asc' } } } })).toEqual(otherBefore);
    expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(inventory);
    expect(email).toHaveBeenCalledTimes(1);
    // Deliberately red regression: both stale FAILED readers must not own claims.
    expect(claims).toBe(1);
  } finally {
    [...claimRelease, ...orderRelease, successRelease].forEach(g => g.resolve());
    await outcomes;
    readSpy.mockRestore(); writeSpy.mockRestore(); orderSpy.mockRestore(); email.mockRestore();
  }
}, 20000);
