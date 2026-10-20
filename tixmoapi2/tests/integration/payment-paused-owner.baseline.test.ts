jest.mock('../../src/utils/notificationService', () => ({ notificationService: { sendAdminAlert: jest.fn().mockResolvedValue(undefined) } }));
import prisma from '../../src/config/prisma';
import Stripe from 'stripe';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { config } from '../../src/config/environment';

function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return {promise, resolve}; }
async function bounded<T>(promise: Promise<T>, timeoutMs = 5000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('Barrier timeout (harness failure)')), timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}
afterAll(async () => { await prisma.$disconnect(); });
test.each(['fresh', 'before-handler', 'before-finish'])('paused owner phase=%s', async phase => {
  const key = `paused141-${Date.now()}`;
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

  const service = new PaymentService();
  const reached = deferred(), release = deferred();
  const trace: string[] = [];
  const gateMethod = phase === 'before-finish' ? 'finishWebhookEvent' : 'beginWebhookEvent';
  const realMethod = (service as any)[gateMethod].bind(service);
  let first = true;
  const gate = jest.spyOn(service as any, gateMethod).mockImplementation(async (...args: any[]) => {
    if (!first) return realMethod(...args);
    first = false;
    if (gateMethod === 'beginWebhookEvent') {
      const result = await realMethod(...args);
      expect(result).toEqual({eventId,generation:1n}); trace.push('A-real-claim-committed'); reached.resolve();
      await bounded(release.promise); return result;
    }
    trace.push('A-handler-returned-before-finish'); reached.resolve();
    await bounded(release.promise); return realMethod(...args);
  });
  const email = jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue(undefined);
  const payload = JSON.stringify({ id: eventId, object: 'event', type: 'payment_intent.succeeded', data: { object: { id: target.paymentIntentId, object: 'payment_intent', status: 'succeeded', metadata: { orderId: target.id, userId: user.id } } } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: config.stripeWebhookSecret });
  const snapshot = async () => ({
    event: await prisma.paymentWebhookEvent.findUniqueOrThrow({where:{id:eventId}}),
    target: await prisma.order.findUniqueOrThrow({where:{id:target.id},include:{tickets:{orderBy:{id:'asc'}}}}),
    other: await prisma.order.findUniqueOrThrow({where:{id:otherBefore.id},include:{tickets:{orderBy:{id:'asc'}}}}),
    inventory: await prisma.ticketType.findUniqueOrThrow({where:{id:type.id}}),
    tickets: await prisma.ticket.count({where:{ticketTypeId:type.id}}),
    events: await prisma.paymentWebhookEvent.count({where:{id:eventId}}), emails: email.mock.calls.length,
  });
  const a = service.handleWebhook(signature, Buffer.from(payload));
  // Attach a rejection handler immediately; finally always releases/drains A.
  const drained = Promise.allSettled([a]);
  try {
    await bounded(Promise.race([reached.promise, a.then(() => { throw new Error('A completed before pause barrier'); })]));
    const paused = await snapshot();
    expect(paused.event).toMatchObject({status:'PROCESSING',attemptGeneration:1n,processedAt:null});
    expect(paused.event.processingStartedAt).toBeInstanceOf(Date);
    expect(Number.isFinite(paused.event.processingStartedAt!.getTime())).toBe(true);
    expect(paused.target.status).toBe(phase === 'before-finish' ? 'PAID' : 'PENDING');
    expect(paused.target.paymentStatus).toBe(phase === 'before-finish' ? 'SUCCEEDED' : 'PROCESSING');
    expect(paused.target.tickets).toEqual(target.tickets); expect(paused.other).toEqual(otherBefore);
    expect([paused.inventory.quantityAvailable,paused.inventory.quantityHeld,paused.inventory.quantitySold]).toEqual(phase === 'before-finish' ? [6,2,2] : [6,4,0]);
    expect(paused.tickets).toBe(4); expect(paused.events).toBe(1);
    expect(paused.emails).toBe(phase === 'before-finish' ? 1 : 0);
    if (phase !== 'fresh') {
      await prisma.paymentWebhookEvent.update({where:{id:eventId},data:{processingStartedAt:new Date('2000-01-01T00:00:00.000Z')}});
      trace.push('fixture-only-lease-timestamp-expired');
    }
    const beforeB = await snapshot();
    await bounded(service.handleWebhook(signature, Buffer.from(payload)));
    trace.push('B-signed-redelivery-returned');
    const afterB = await snapshot();
    if (phase === 'fresh') {
      expect(afterB).toEqual(beforeB);
      expect(afterB.event.attemptGeneration).toBe(1n);
    } else {
      expect(afterB.event).toMatchObject({status:'PROCESSED',attemptGeneration:2n});
      expect(afterB.event.processingStartedAt).toBeInstanceOf(Date);
      expect(afterB.event.processedAt).toBeInstanceOf(Date);
      expect(Number.isFinite(afterB.event.processingStartedAt!.getTime())).toBe(true);
      expect(Number.isFinite(afterB.event.processedAt!.getTime())).toBe(true);
      expect(afterB.event.processingStartedAt!.getTime()).toBeGreaterThan(beforeB.event.processingStartedAt!.getTime());
      expect(afterB.event.processedAt!.getTime()).toBeGreaterThanOrEqual(afterB.event.processingStartedAt!.getTime());
      expect(afterB.target).toMatchObject({status:'PAID',paymentStatus:'SUCCEEDED',paymentIntentId:target.paymentIntentId});
      expect(afterB.target.tickets).toEqual(target.tickets); expect(afterB.other).toEqual(otherBefore);
      expect([afterB.inventory.quantityAvailable,afterB.inventory.quantityHeld,afterB.inventory.quantitySold]).toEqual([6,2,2]);
      expect(afterB.tickets).toBe(4); expect(afterB.events).toBe(1); expect(afterB.emails).toBe(1);
      if (phase === 'before-finish') {
        // Only event ownership/completion changes; already-fulfilled business does not repeat.
        expect({...afterB,event:beforeB.event}).toEqual(beforeB);
      }
    }
    release.resolve(); await bounded(a); trace.push('A-released-finished');
    const final = await snapshot();
    console.log('TASK141_DURABLE', JSON.stringify({phase,trace,paused,beforeB,afterB,final},(_,value)=>typeof value === 'bigint' ? value.toString() : value));
    expect(final.event).toMatchObject({status:'PROCESSED',attemptGeneration:phase === 'fresh' ? 1n : 2n});
    expect(final.event.processedAt).toBeInstanceOf(Date);
    expect(Number.isFinite(final.event.processedAt!.getTime())).toBe(true);
    if (phase !== 'fresh') expect(final).toEqual(afterB);
    expect(final.target).toMatchObject({status:'PAID',paymentStatus:'SUCCEEDED',paymentIntentId:target.paymentIntentId});
    expect(final.target.tickets).toEqual(target.tickets); expect(final.other).toEqual(otherBefore);
    expect([final.inventory.quantityAvailable,final.inventory.quantityHeld,final.inventory.quantitySold]).toEqual([6,2,2]);
    expect(final.tickets).toBe(4); expect(final.events).toBe(1); expect(final.emails).toBe(1);
  } finally {
    release.resolve();
    try { await bounded(drained); }
    finally { gate.mockRestore(); email.mockRestore(); }
  }
}, 15000);
