import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
import { logger } from '../../src/config/logger';

// Fully mocked fixture: exercise real fencing and retry code without DB bootstrap.
jest.mock('stripe', () => jest.fn());
jest.mock('../../src/config/environment', () => ({ config: { stripeSecretKey: 'mock-only' } }));
jest.mock('../../src/config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock('../../src/config/prisma', () => ({ __esModule: true, default: { $transaction: jest.fn() } }));
jest.mock('../../src/api/orders/service', () => ({ orderService: {
    confirmOrder: jest.fn(), confirmOrderInTransaction: jest.fn(), sendOrderConfirmationEmail: jest.fn(),
} }));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: { sendAdminAlert: jest.fn() } }));

// Mock NotificationService.sendAdminAlert
jest.spyOn(notificationService, 'sendAdminAlert').mockResolvedValue(true);
// Spy on logger
const loggerSpy = jest.spyOn(logger, 'error');
const loggerWarnSpy = jest.spyOn(logger, 'warn');

describe('Order Confirmation Retry Logic', () => {
    let order: any;
    const claim = { eventId: 'evt-retry', generation: 1n };
    let tx: any;

    beforeEach(() => {
        jest.clearAllMocks();
        order = { id: 'order-retry', paymentIntentId: 'pi-retry', status: 'PENDING', paymentStatus: 'PROCESSING' };
        tx = {
            $queryRaw: jest.fn(),
            order: { findUnique: jest.fn().mockResolvedValue(order), updateMany: jest.fn() },
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async work => {
            tx.$queryRaw
                .mockResolvedValueOnce([{ status: 'PROCESSING', attempt_generation: claim.generation }])
                .mockResolvedValueOnce([{ live: true }])
                .mockResolvedValueOnce([{ id: order.id }]);
            return work(tx);
        });
    });

    afterAll(() => jest.restoreAllMocks());

    function expectFenceAttempts(attempts: number) {
        expect(prisma.$transaction).toHaveBeenCalledTimes(attempts);
        expect(tx.$queryRaw).toHaveBeenCalledTimes(attempts * 3);
        for (let attempt = 0; attempt < attempts; attempt++) {
            const calls = tx.$queryRaw.mock.calls.slice(attempt * 3, attempt * 3 + 3);
            expect(calls.map((call: any[]) => call.slice(1))).toEqual([[claim.eventId], [claim.eventId], [order.id]]);
            expect(calls[0][0].join('')).toContain('FOR UPDATE');
            expect(calls[1][0].join('')).toContain('AS live');
            expect(calls[2][0].join('')).toContain('FOR UPDATE');
        }
        expect(orderService.confirmOrderInTransaction).toHaveBeenCalledWith(tx, order.id);
        expect(orderService.confirmOrder).not.toHaveBeenCalled();
        expect(tx.order.findUnique).toHaveBeenCalledTimes(attempts);
        expect(tx.order.updateMany).not.toHaveBeenCalled();
    }

    it('should retry order confirmation on failure and alert admin after exhaustion', async () => {
        // Mock transactional confirmation to ALWAYS fail
        const confirmOrderSpy = jest.spyOn(orderService, 'confirmOrderInTransaction').mockRejectedValue(new Error('DB Timeout'));

        // Exercise the real private handler with a valid fenced claim.
        const { paymentService } = await import('../../src/api/payments/service');

        // @ts-ignore - accessing private method for testing
        await expect(paymentService.handlePaymentSuccess({
            id: order.paymentIntentId, metadata: { orderId: order.id },
        } as any, claim)).rejects.toThrow('DB Timeout');

        // Verify retries happened (6 attempts total: 1 initial + 5 retries)
        // withRetry logs warnings on retry
        expect(loggerWarnSpy).toHaveBeenCalledTimes(5);
        expect(confirmOrderSpy).toHaveBeenCalledTimes(6);

        // Verify admin alert was sent
        expect(notificationService.sendAdminAlert).toHaveBeenCalledWith(
            'Order Confirmation Failure',
            expect.stringContaining(`Order ${order.id} failed after payment succeeded. Manual intervention required. Error: Error: DB Timeout`)
        );

        // The current handler propagates the final error into the admin diagnostic,
        // rather than emitting the removed Critical log line.
        expect(notificationService.sendAdminAlert).toHaveBeenCalledTimes(1);
        expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
        expect(loggerSpy).not.toHaveBeenCalled();
        expectFenceAttempts(6);
    }, 30000); // Higher timeout for retries

    it('should stop retrying if it succeeds eventually', async () => {
        // Mock transactional confirmation to fail twice then succeed
        let attempts = 0;
        const confirmOrderSpy = jest.spyOn(orderService, 'confirmOrderInTransaction').mockImplementation(async () => {
            attempts++;
            if (attempts < 3) throw new Error('Flaky DB');
            return {} as any;
        });
        jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue(undefined);

        const { paymentService } = await import('../../src/api/payments/service');

        // Clear diagnostic spies before exercising eventual success.
        loggerWarnSpy.mockClear();
        (notificationService.sendAdminAlert as any).mockClear();

        // @ts-ignore
        await paymentService.handlePaymentSuccess({
            id: order.paymentIntentId, metadata: { orderId: order.id },
        } as any, claim);

        // 3 attempts total (Fail, Fail, Success)
        expect(confirmOrderSpy).toHaveBeenCalledTimes(3);
        expect(loggerWarnSpy).toHaveBeenCalledTimes(2);
        expect(notificationService.sendAdminAlert).not.toHaveBeenCalled();
        expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledWith(order.id);
        expect(loggerSpy).not.toHaveBeenCalled();
        expectFenceAttempts(3);
    }, 30000);
});
