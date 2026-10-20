import prisma from '../../src/config/prisma';
import { PaymentService } from '../../src/api/payments/service';
afterAll(async () => {
  await prisma.$disconnect();
});
(process.env.TIXMO_EXPERIMENTAL_RECOVERY === '1' ? test : test.skip)(
  'sequential eligible retries at same real DB sample have strictly increasing durable generation',
  async () => {
    const id = `evt_seq143_${Date.now()}`;
    await prisma.paymentWebhookEvent.create({
      data: { id, type: 'unhandled.test', status: 'FAILED', attemptGeneration: 7n },
    });
    const sample = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    const raw = jest.spyOn(prisma as any, '$queryRaw').mockImplementation(async (strings: any) => {
      expect(strings.join('')).toBe('SELECT clock_timestamp() AS now');
      return sample;
    });
    try {
      const service = new PaymentService() as any,
        event = { id, type: 'unhandled.test', data: { object: {} } };
      const first = await service.beginWebhookEvent(event);
      const one = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
      await prisma.paymentWebhookEvent.update({ where: { id }, data: { status: 'FAILED' } });
      const second = await service.beginWebhookEvent(event);
      const two = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
      console.log(
        'TASK143_SEQUENTIAL',
        JSON.stringify({ first, second, one, two }, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v
        )
      );
      expect(first).toEqual({ eventId: id, generation: one.attemptGeneration });
      expect(second).toEqual({ eventId: id, generation: two.attemptGeneration });
      expect(two.processingStartedAt).toEqual(one.processingStartedAt);
      expect(two.attemptGeneration > one.attemptGeneration).toBe(true);
      expect([one.attemptGeneration, two.attemptGeneration]).toEqual([8n, 9n]);
    } finally {
      raw.mockRestore();
    }
  },
  15000
);
