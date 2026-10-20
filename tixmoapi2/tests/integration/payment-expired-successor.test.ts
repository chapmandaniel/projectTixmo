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
(process.env.TIXMO_EXPERIMENTAL_RECOVERY === '1' ? test : test.skip).each(['before-handler', 'success', 'failure'])('real expired takeover phase=%s', async phase => {
  const key = `successor143-${Date.now()}`;
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


  const aService = new PaymentService(), bService = new PaymentService();
  const aReached = deferred(), aRelease = deferred(), bReached = deferred(), bRelease = deferred();
  const trace: string[] = [];
  const snapshot = async () => ({
    event: await prisma.paymentWebhookEvent.findUniqueOrThrow({where:{id:eventId}}),
    target: await prisma.order.findUniqueOrThrow({where:{id:target.id},include:{tickets:{orderBy:{id:'asc'}}}}),
    other: await prisma.order.findUniqueOrThrow({where:{id:otherBefore.id},include:{tickets:{orderBy:{id:'asc'}}}}),
    inventory: await prisma.ticketType.findUniqueOrThrow({where:{id:type.id}}),
    tickets: await prisma.ticket.count({where:{ticketTypeId:type.id}}),
    events: await prisma.paymentWebhookEvent.count({where:{id:eventId}}),
  });
  const email = jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue(undefined);
  const realUpdate = prisma.paymentWebhookEvent.updateMany.bind(prisma.paymentWebhookEvent);
  const staleCounts: number[] = [];
  const writes = jest.spyOn(prisma.paymentWebhookEvent as any, 'updateMany').mockImplementation(async (args: any) => {
    const result = await realUpdate(args);
    if (args.where.id === eventId && args.data.processedAt) {
      staleCounts.push(result.count); trace.push(`A-terminal-${args.data.status}-rows-${result.count}`);
    }
    return result;
  });
  const originalFailure = new Error('injected-after-committed-handler');
  const method = phase === 'before-handler' ? 'beginWebhookEvent' : 'finishWebhookEvent';
  const realA = (aService as any)[method].bind(aService);
  let first = true;
  const gateA = jest.spyOn(aService as any, method).mockImplementation(async (...args: any[]) => {
    if (!first) return realA(...args);
    first = false;
    const claimed = method === 'beginWebhookEvent' ? await realA(...args) : undefined;
    if (claimed) expect(claimed).toEqual({eventId,generation:1n});
    trace.push('A-paused-outside-transaction'); aReached.resolve();
    await bounded(aRelease.promise);
    if (phase === 'failure') throw originalFailure;
    return method === 'beginWebhookEvent' ? claimed : realA(...args);
  });
  const realB = (bService as any).finishWebhookEvent.bind(bService);
  const gateB = jest.spyOn(bService as any, 'finishWebhookEvent').mockImplementation(async (...args: any[]) => {
    expect(args[0]).toEqual({eventId,generation:2n});
    trace.push('B-real-takeover-handler-returned'); bReached.resolve();
    await bounded(bRelease.promise); return realB(...args);
  });
  const payload = JSON.stringify({id:eventId,object:'event',type:'payment_intent.succeeded',data:{object:{id:target.paymentIntentId,metadata:{orderId:target.id,userId:user.id}}}});
  const signature = Stripe.webhooks.generateTestHeaderString({payload,secret:config.stripeWebhookSecret});
  const a = aService.handleWebhook(signature,Buffer.from(payload));
  const aResult = a.then(() => undefined, error => error);
  let bResult: Promise<unknown> | undefined;
  try {
    await bounded(aReached.promise);
    await prisma.paymentWebhookEvent.update({where:{id:eventId},data:{processingStartedAt:new Date('2000-01-01T00:00:00Z')}});
    trace.push('fixture-only-expiration');
    bResult = bService.handleWebhook(signature,Buffer.from(payload)).then(() => undefined,error => error);
    await bounded(bReached.promise);
    const successor = await snapshot();
    expect(successor.event).toMatchObject({status:'PROCESSING',attemptGeneration:2n,processedAt:null});
    expect(successor.target).toMatchObject({status:'PAID',paymentStatus:'SUCCEEDED'});
    expect(successor.other).toEqual(otherBefore);
    expect(successor.target.tickets).toEqual(target.tickets);
    expect([successor.inventory.quantityAvailable,successor.inventory.quantityHeld,successor.inventory.quantitySold]).toEqual([6,2,2]);
    expect(successor.tickets).toBe(4); expect(successor.events).toBe(1);
    aRelease.resolve();
    expect(await bounded(aResult)).toBe(phase === 'failure' ? originalFailure : undefined);
    const afterStale = await snapshot();
    console.log('TASK143_PRE_RELEASE',JSON.stringify({phase,trace,successor,afterStale,staleCounts},(_,v)=>typeof v === 'bigint' ? v.toString() : v));
    expect(afterStale).toEqual(successor); // BEFORE B release: full event timestamps/generation and all buyer/inventory state.
    expect(staleCounts).toEqual(phase === 'before-handler' ? [] : [0]);
    expect(email).toHaveBeenCalledTimes(1);
    bRelease.resolve(); expect(await bounded(bResult)).toBeUndefined();
    const final = await snapshot();
    expect(final.event).toMatchObject({status:'PROCESSED',attemptGeneration:2n});
    expect({...final,event:successor.event}).toEqual(successor);
    expect(email).toHaveBeenCalledTimes(1);
  } finally {
    aRelease.resolve(); bRelease.resolve();
    try { await bounded(Promise.allSettled([aResult,...(bResult ? [bResult] : [])])); }
    finally {gateA.mockRestore();gateB.mockRestore();writes.mockRestore();email.mockRestore();}
  }
},15000);
