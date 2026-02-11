import { PaymentService } from '../../src/api/payments/service';
import { ApiError } from '../../src/utils/ApiError';
import Stripe from 'stripe';

jest.mock('stripe');
jest.mock('../../src/config/environment', () => ({
  config: {
    stripeSecretKey: 'sk_test_123',
    stripeWebhookSecret: 'whsec_123',
  },
}));
jest.mock('../../src/config/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockConstructEvent: jest.Mock;

  beforeEach(() => {
    mockConstructEvent = jest.fn();
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    }));

    paymentService = new PaymentService();
  });

  describe('handleWebhook', () => {
    it('should throw ApiError when constructEvent fails', async () => {
      const error = new Error('Signature verification failed');
      mockConstructEvent.mockImplementation(() => {
        throw error;
      });

      const signature = 'invalid-signature';
      const payload = Buffer.from('payload');

      await expect(paymentService.handleWebhook(signature, payload)).rejects.toThrow(ApiError);

      try {
        await paymentService.handleWebhook(signature, payload);
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe('Webhook Error: Signature verification failed');
      }
    });

    it('should throw ApiError with generic message when non-Error object is thrown', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw 'Some string error';
      });

      const signature = 'invalid-signature';
      const payload = Buffer.from('payload');

      await expect(paymentService.handleWebhook(signature, payload)).rejects.toThrow(ApiError);

      try {
        await paymentService.handleWebhook(signature, payload);
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe('Webhook Error: Unknown error');
      }
    });
  });
});
