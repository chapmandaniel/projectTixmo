import { randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';
import { PaymentService } from '../../src/api/payments/service';

afterAll(async () => {
  await prisma.$disconnect();
});

async function withSessionTz<T>(
  timeZone: string,
  work: (tx: { $queryRaw: typeof prisma.$queryRaw }) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('TimeZone', ${timeZone}, true)`;
    return work(tx);
  });
}

test('stale webhook leases are not live when the session TimeZone is not UTC', async () => {
  const key = `lease-tz-${randomUUID()}`;
  const organization = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const user = await prisma.user.create({
    data: {
      email: `${key}@example.test`,
      passwordHash: 'test-only',
      firstName: 'Lease',
      lastName: 'Timezone',
    },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      name: key,
      slug: key,
      status: 'ON_SALE',
      startDatetime: new Date(Date.now() + 86400000),
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: key,
      userId: user.id,
      eventId: event.id,
      totalAmount: 10,
      currency: 'cad',
    },
  });
  const staleStartedAt = new Date(Date.now() - 6 * 60_000);
  const freshStartedAt = new Date(Date.now() - 30_000);
  const stale = await prisma.paymentWebhookEvent.create({
    data: {
      id: `${key}-stale`,
      type: 'payment_intent.succeeded',
      orderId: order.id,
      status: 'PROCESSING',
      attemptGeneration: 1n,
      processingStartedAt: staleStartedAt,
    },
  });
  const fresh = await prisma.paymentWebhookEvent.create({
    data: {
      id: `${key}-fresh`,
      type: 'payment_intent.succeeded',
      orderId: order.id,
      status: 'PROCESSING',
      attemptGeneration: 1n,
      processingStartedAt: freshStartedAt,
    },
  });

  const comparison = await withSessionTz('America/St_Johns', async (tx) => {
    const rows = await tx.$queryRaw<Array<{ naive_live: boolean; utc_live: boolean }>>`
      SELECT
        processing_started_at > clock_timestamp() - interval '300 seconds' AS naive_live,
        processing_started_at > ((clock_timestamp() AT TIME ZONE 'UTC') - interval '300 seconds') AS utc_live
      FROM payment_webhook_events
      WHERE id = ${stale.id}
    `;
    return rows[0];
  });
  expect(comparison).toEqual({ naive_live: true, utc_live: false });

  const service = new PaymentService();
  const originalTransaction = prisma.$transaction.bind(prisma);
  prisma.$transaction = ((
    arg: Parameters<typeof prisma.$transaction>[0],
    options?: Parameters<typeof prisma.$transaction>[1]
  ) => {
    if (typeof arg !== 'function') return originalTransaction(arg, options);
    return originalTransaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('TimeZone', 'America/St_Johns', true)`;
      return arg(tx);
    }, options);
  }) as typeof prisma.$transaction;
  try {
    await expect(
      (service as any).withWebhookFence(
        { eventId: stale.id, generation: 1n },
        order.id,
        async () => 'stale-work'
      )
    ).rejects.toThrow('Webhook ownership lost');
    await expect(
      (service as any).withWebhookFence(
        { eventId: fresh.id, generation: 1n },
        order.id,
        async () => 'fresh-work'
      )
    ).resolves.toBe('fresh-work');
  } finally {
    prisma.$transaction = originalTransaction;
  }
});
