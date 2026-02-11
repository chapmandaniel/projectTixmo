import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, registerUser } from '../utils/testUtils';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
import { logger } from '../../src/config/logger';

// Mock NotificationService.sendAdminAlert
jest.spyOn(notificationService, 'sendAdminAlert').mockResolvedValue(true);
// Spy on logger
const loggerSpy = jest.spyOn(logger, 'error');
const loggerWarnSpy = jest.spyOn(logger, 'warn');

describe('Order Confirmation Retry Logic', () => {
    let userToken: string;
    let order: any;

    beforeEach(async () => {
        jest.clearAllMocks();
    });

    beforeAll(async () => {
        await cleanupTestData();

        // Create user and order
        const userData = await registerUser(app, {
            email: 'buyer@test.com',
            firstName: 'Buyer',
            lastName: 'User',
        });
        userToken = userData.accessToken;

        // Create a mock order or real one
        // Using a real one is better for integration test
        const prisma = (await import('../../src/config/prisma')).default;
        const event = await prisma.event.create({
            data: {
                organization: { create: { name: 'Retry Org', slug: 'retry-org', type: 'PROMOTER' } },
                name: 'Retry Event',
                slug: 'retry-event',
                status: 'PUBLISHED',
                ticketTypes: {
                    create: {
                        name: 'Standard',
                        price: 100,
                        quantityTotal: 100,
                        quantityAvailable: 100,
                    },
                },
            },
            include: { ticketTypes: true },
        });

        const orderRes = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                items: [{ ticketTypeId: event.ticketTypes[0].id, quantity: 1 }],
            });
        order = orderRes.body.data;
    });

    afterAll(async () => {
        await cleanupTestData();
        jest.restoreAllMocks();
    });

    it('should retry order confirmation on failure and alert admin after exhaustion', async () => {
        // Mock confirmOrder to ALWAYS fail
        const confirmOrderSpy = jest.spyOn(orderService, 'confirmOrder').mockRejectedValue(new Error('DB Timeout'));

        // Trigger the webhook handler (manual call to service since we don't want to mock Stripe if possible)
        const { paymentService } = await import('../../src/api/payments/service');

        // @ts-ignore - accessing private method for testing
        await paymentService.handlePaymentSuccess({
            metadata: { orderId: order.id },
        } as any);

        // Verify retries happened (6 attempts total: 1 initial + 5 retries)
        // withRetry logs warnings on retry
        expect(loggerWarnSpy).toHaveBeenCalledTimes(5);
        expect(confirmOrderSpy).toHaveBeenCalledTimes(6);

        // Verify admin alert was sent
        expect(notificationService.sendAdminAlert).toHaveBeenCalledWith(
            'Order Confirmation Failure',
            expect.stringContaining('failed to confirm after payment succeeded')
        );

        // Verify final error was logged
        expect(loggerSpy).toHaveBeenCalledWith(
            expect.stringContaining('Critical: Failed to confirm order')
        );
    }, 30000); // Higher timeout for retries

    it('should stop retrying if it succeeds eventually', async () => {
        // Mock confirmOrder to fail twice then succeed
        let attempts = 0;
        const confirmOrderSpy = jest.spyOn(orderService, 'confirmOrder').mockImplementation(async () => {
            attempts++;
            if (attempts < 3) throw new Error('Flaky DB');
            return {} as any;
        });
        jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue(undefined);

        const { paymentService } = await import('../../src/api/payments/service');

        // Reset spys (handled by beforeEach but redundant here)
        loggerWarnSpy.mockClear();
        (notificationService.sendAdminAlert as any).mockClear();

        // @ts-ignore
        await paymentService.handlePaymentSuccess({
            metadata: { orderId: order.id },
        } as any);

        // 3 attempts total (Fail, Fail, Success)
        expect(confirmOrderSpy).toHaveBeenCalledTimes(3);
        expect(loggerWarnSpy).toHaveBeenCalledTimes(2);
        expect(notificationService.sendAdminAlert).not.toHaveBeenCalled();
    }, 30000);
});
