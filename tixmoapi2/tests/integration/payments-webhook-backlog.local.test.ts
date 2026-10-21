// Real SQL/Prisma/recovery/claim/finish. Only provider and notification boundaries stubbed.
jest.mock('stripe', () => jest.fn(() => ({ events: { retrieve: jest.fn() } })));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: new Proxy({}, { get() { throw new Error('Notification boundary forbidden'); } }) }));
import Stripe from 'stripe';
import prisma from '../../src/config/prisma';
import { PaymentService } from '../../src/api/payments/service';
const synthetic = (id: string) => ({ id, type: 'task291.synthetic.unsupported', data: { object: {} } });
const instance = () => {
  const service = new PaymentService();
  const provider = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
  return { service, retrieve: provider.events.retrieve as jest.Mock };
};
const read = (id: string) => prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
const seed = (id: string, extra: any = {}) => prisma.paymentWebhookEvent.create({ data: { id, type: synthetic(id).type, status: 'FAILED', processingStartedAt: new Date(Date.now()-600000), updatedAt: new Date(Date.now()-180000), ...extra } });
const snapshot = async (label: string) => {
  const rows = await prisma.$queryRaw`SELECT id,status,attempt_generation,processing_started_at,processed_at,updated_at,error_message FROM payment_webhook_events ORDER BY id`;
  console.log('TASK291_SQL', label, JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? v.toString() : v));
};
beforeEach(async () => { await prisma.paymentWebhookEvent.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

test('50 oldest poison rows rotate durably; healthy51 progresses on reconstructed instance without waiting', async () => {
  const now = Date.now();
  await prisma.paymentWebhookEvent.createMany({ data: Array.from({ length: 50 }, (_, i) => ({ id: `evt_poison_${i.toString().padStart(2,'0')}`, type: synthetic('').type, status: 'FAILED', attemptGeneration: 7n, processingStartedAt: new Date(now-600000), updatedAt: new Date(now-240000+i) })) });
  await seed('evt_healthy51', { updatedAt: new Date(now-120000) });
  const before = await prisma.paymentWebhookEvent.findMany({ where: { id: { startsWith: 'evt_poison_' } }, orderBy: { id: 'asc' } });
  const first = instance(); first.retrieve.mockRejectedValue(new Error('Synthetic provider unavailable'));
  await first.service.recoverPayments();
  expect(first.retrieve.mock.calls.map(c => c[0])).toEqual(before.map(r => r.id));
  const rotated = await prisma.paymentWebhookEvent.findMany({ where: { id: { startsWith: 'evt_poison_' } }, orderBy: { id: 'asc' } });
  rotated.forEach((r, i) => { expect(r.status).toBe('FAILED'); expect(r.attemptGeneration).toBe(7n); expect(r.processingStartedAt).toEqual(before[i].processingStartedAt); expect(r.processedAt).toBeNull(); expect(r.updatedAt.getTime()).toBeGreaterThan(before[i].updatedAt.getTime()); expect(r.errorMessage).toBe('Webhook recovery reconciliation required; owner=tixmo-backend; retry after 60 seconds.'); });
  expect((await read('evt_healthy51')).status).toBe('FAILED');
  await snapshot('after-first50-poison');
  const second = instance(); second.retrieve.mockImplementation(async id => synthetic(id));
  const finish = jest.spyOn(second.service as any, 'finishWebhookEvent');
  await second.service.recoverPayments();
  expect(second.retrieve.mock.calls).toEqual([['evt_healthy51']]);
  const healthy = await read('evt_healthy51');
  expect(healthy.status).toBe('PROCESSED'); expect(healthy.attemptGeneration).toBe(1n); expect(healthy.errorMessage).toBeNull(); expect(healthy.processedAt).not.toBeNull(); expect(healthy.processingStartedAt.getTime()).toBeGreaterThan(now-1000);
  await second.service.recoverPayments();
  await (second.service as any).processEvent(synthetic('evt_healthy51'));
  expect(second.retrieve).toHaveBeenCalledTimes(1); expect(finish).toHaveBeenCalledTimes(1); expect(await read('evt_healthy51')).toEqual(healthy);
  // Durable cooldown eligibility, no fake clock: age just one poison row in SQL.
  await prisma.paymentWebhookEvent.update({ where: { id: before[0].id }, data: { updatedAt: new Date(Date.now()-61000) } });
  const third = instance(); third.retrieve.mockRejectedValue(new Error('Synthetic poison retry'));
  await third.service.recoverPayments(); expect(third.retrieve.mock.calls).toEqual([[before[0].id]]);
  await snapshot('healthy51-and-reeligible-one');
}, 20000);

test('two actual SQL claims admit one generation; expired takeover fences stale completion and effects', async () => {
  const id = 'evt_generation'; await seed(id);
  const a = instance().service as any, b = instance().service as any;
  const claims = await Promise.all([a.beginWebhookEvent(synthetic(id)), b.beginWebhookEvent(synthetic(id))]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const old = claims.find(Boolean); expect(old.generation).toBe(1n);
  expect(await b.beginWebhookEvent(synthetic(id))).toBeNull();
  await prisma.paymentWebhookEvent.update({ where: { id }, data: { processingStartedAt: new Date(Date.now()-301000) } });
  const fresh = await b.beginWebhookEvent(synthetic(id)); expect(fresh.generation).toBe(2n);
  const before = await read(id);
  await a.finishWebhookEvent(old, 'FAILED', new Error('stale must not write'));
  expect(await read(id)).toEqual(before);
  const work = jest.fn();
  await expect(a.withWebhookFence(old, 'absent-synthetic-order', work)).rejects.toThrow('Webhook ownership lost'); expect(work).not.toHaveBeenCalled();
  await b.finishWebhookEvent(fresh, 'PROCESSED');
  const final = await read(id); expect(final.status).toBe('PROCESSED'); expect(final.attemptGeneration).toBe(2n); expect(final.errorMessage).toBeNull(); expect(final.processedAt).not.toBeNull();
  await snapshot('generation-fences');
});

test('retrieval failure CAS cannot overwrite concurrently claimed or completed row', async () => {
  const id = 'evt_cas'; await seed(id);
  const first = instance(); const competitor = instance().service as any;
  let completed: any;
  first.retrieve.mockImplementation(async () => {
    const claim = await competitor.beginWebhookEvent(synthetic(id));
    await competitor.finishWebhookEvent(claim, 'PROCESSED'); completed = await read(id);
    throw new Error('Synthetic stale retrieval failure');
  });
  await first.service.recoverPayments(); expect(first.retrieve).toHaveBeenCalledTimes(1);
  expect(await read(id)).toEqual(completed); expect(completed.status).toBe('PROCESSED'); expect(completed.errorMessage).toBeNull(); expect(completed.attemptGeneration).toBe(1n);
  await snapshot('retrieval-selection-CAS');
});
