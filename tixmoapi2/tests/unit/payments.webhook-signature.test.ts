import { PaymentService } from '../../src/api/payments/service';
import { ApiError } from '../../src/utils/ApiError';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
import Stripe from 'stripe';

jest.mock('stripe', () => jest.fn(() => ({ webhooks: { constructEvent: jest.fn() } })));
jest.mock('@prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));
jest.mock('../../src/config/environment', () => ({
  config: { stripeSecretKey: 'mock-only', stripeWebhookSecret: 'mock-webhook-secret' },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    paymentWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    order: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock('../../src/api/orders/service', () => ({
  orderService: {
    getOrderById: jest.fn(),
    confirmOrder: jest.fn(),
    sendOrderConfirmationEmail: jest.fn(),
  },
}));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn(), sendEmail: jest.fn() },
}));
jest.mock('../../src/utils/retry', () => ({ withRetry: jest.fn() }));

describe('PaymentService webhook signature rejection (fully mocked)', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['Error', new Error('signature mismatch')],
    ['string', 'signature mismatch'],
    ['null', null],
    ['undefined', undefined],
  ])('rejects a thrown %s before all downstream effects', async (_label, thrown) => {
    const service = new PaymentService();
    const stripe = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
    stripe.webhooks.constructEvent.mockImplementation(() => {
      // Deliberately verify defensive handling of third-party non-Error throws.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw thrown;
    });
    const payload = Buffer.from([0x00, 0xff, 0x7b, 0x0a, 0x7d]);
    const signature = 't=123,v1=original-signature';

    const rejection = await service
      .handleWebhook(signature, payload)
      .catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(ApiError);
    expect(rejection).toMatchObject({ statusCode: 400, message: 'Invalid webhook signature' });
    expect(stripe.webhooks.constructEvent).toHaveBeenCalledTimes(1);
    const args = stripe.webhooks.constructEvent.mock.calls[0];
    expect(args).toHaveLength(3);
    expect(args[0]).toBe(payload);
    expect(args[0].equals(Buffer.from([0x00, 0xff, 0x7b, 0x0a, 0x7d]))).toBe(true);
    expect(args[1]).toBe(signature);
    expect(args[2]).toBe('mock-webhook-secret');
    const effects = [
      ...Object.values(prisma.paymentWebhookEvent),
      ...Object.values(prisma.order),
      ...Object.values(prisma.user),
      ...Object.values(orderService),
      ...Object.values(notificationService),
    ];
    for (const effect of effects) expect(effect).not.toHaveBeenCalled();
  });
});
