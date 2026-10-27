jest.mock('../src/config/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    order: { findUnique: jest.fn() },
    orderIdempotencyKey: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('../src/config/environment', () => ({
  config: { paymentCurrency: 'cad', cartExpiryMinutes: 15 },
}));
jest.mock('../src/utils/notificationService', () => ({ notificationService: {} }));

import express from 'express';
import request from 'supertest';
import prisma from '../src/config/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderService } from '../src/api/orders/service';
import { committedOrderJson } from '../src/api/orders/committed-response';
import { errorHandler } from '../src/middleware/errorHandler';
import { hashOrderRequest } from '../src/api/orders/idempotency';
import { checkoutBusyError } from '../src/services/checkout-transaction';

const tx = {
  $queryRaw: jest.fn(),
  event: { findUniqueOrThrow: jest.fn() },
  ticketType: { findUnique: jest.fn(), update: jest.fn() },
  ticketTier: { update: jest.fn() },
  order: { create: jest.fn() },
  ticket: { createMany: jest.fn() },
  promoCode: { findUnique: jest.fn(), update: jest.fn() },
  orderIdempotencyKey: { create: jest.fn(), update: jest.fn() },
};

function saleType() {
  return {
    id: 'ga',
    eventId: 'event',
    name: 'GA',
    status: 'ACTIVE',
    tierInventoryStatus: 'READY',
    tiers: [],
    quantityAvailable: 20,
    quantityHeld: 0,
    maxPerOrder: 4,
    price: new Decimal(10),
  };
}

describe('checkout transaction busy', () => {
  let type = saleType();
  const service = new OrderService();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    type = saleType();
    tx.event.findUniqueOrThrow.mockResolvedValue({
      id: 'event',
      status: 'ON_SALE',
      deletedAt: null,
      startDatetime: new Date('2099-01-01'),
    });
    tx.ticketType.findUnique.mockResolvedValue(type);
    tx.ticketType.update.mockImplementation(async ({ data }) => {
      type.quantityAvailable -= data.quantityAvailable.decrement;
      type.quantityHeld += data.quantityHeld.increment;
      return type;
    });
    tx.order.create.mockImplementation(async ({ data }) => ({
      id: 'order',
      status: 'PENDING',
      ...data,
    }));
    tx.ticket.createMany.mockResolvedValue({ count: 2 });
    tx.orderIdempotencyKey.create.mockResolvedValue({ id: 'idem' });
    tx.orderIdempotencyKey.update.mockResolvedValue({ id: 'idem' });
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.orderIdempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.orderIdempotencyKey.update as jest.Mock).mockResolvedValue({ id: 'idem' });
  });

  function timeoutAfterWork() {
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => {
      const before = { ...type };
      try {
        await work(tx);
        throw new Error(
          'Transaction already closed: Transaction API error: Transaction not found. Transaction already closed'
        );
      } catch (error) {
        Object.assign(type, before);
        throw error;
      }
    });
  }

  it('returns CHECKOUT_BUSY quickly and leaves no hold when the transaction times out', async () => {
    timeoutAfterWork();
    const started = Date.now();
    await expect(
      service.createOrder('buyer', { items: [{ ticketTypeId: 'ga', quantity: 2 }] })
    ).rejects.toMatchObject({ statusCode: 503, code: 'CHECKOUT_BUSY', retryAfter: 2 });
    expect(Date.now() - started).toBeLessThan(500);
    expect(type.quantityHeld).toBe(0);
    expect(type.quantityAvailable).toBe(20);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { orderNumber: expect.stringMatching(/^ORD-/) },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 2000,
      timeout: 5000,
    });
    const limits = tx.$queryRaw.mock.calls.map((call) => String(call[0]));
    expect(limits.some((sql) => sql.includes('lock_timeout'))).toBe(true);
    expect(limits.some((sql) => sql.includes('statement_timeout'))).toBe(true);
  });

  it('releases a reservation that committed after the client timed out', async () => {
    timeoutAfterWork();
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'ghost',
      status: 'PENDING',
      totalAmount: new Decimal(20),
    });
    const cancel = jest.spyOn(service, 'cancelOrder').mockResolvedValue({ id: 'ghost' });
    await expect(
      service.createOrder('buyer', { items: [{ ticketTypeId: 'ga', quantity: 2 }] })
    ).rejects.toMatchObject({ statusCode: 503, code: 'CHECKOUT_BUSY' });
    expect(cancel).toHaveBeenCalledWith('ghost');
    expect(type.quantityHeld).toBe(0);
  });

  it('returns the committed order when a timed-out hold cannot be released', async () => {
    timeoutAfterWork();
    const kept = {
      id: 'ghost',
      status: 'PENDING',
      totalAmount: new Decimal(20),
      orderNumber: 'ORD-GHOST',
    };
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(kept);
    jest.spyOn(service, 'cancelOrder').mockRejectedValue(new Error('cancel failed'));
    await expect(
      service.createOrder('buyer', { items: [{ ticketTypeId: 'ga', quantity: 2 }] })
    ).resolves.toMatchObject({ id: 'ghost', status: 'PENDING' });
  });

  it('returns the committed order when free confirmation fails after commit', async () => {
    type.price = new Decimal(0);
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));
    jest.spyOn(service, 'confirmOrder').mockRejectedValue(new Error('confirm failed'));
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'order',
      status: 'PENDING',
      totalAmount: new Decimal(0),
    });
    await expect(
      service.createOrder('buyer', { items: [{ ticketTypeId: 'ga', quantity: 1 }] })
    ).resolves.toMatchObject({ id: 'order', status: 'PENDING' });
  });

  it('still answers 201 when the committed order cannot be serialized', () => {
    const circular: { id: string; self?: unknown } = { id: 'order-1' };
    circular.self = circular;
    const body = JSON.parse(committedOrderJson(circular));
    expect(body).toMatchObject({
      success: true,
      message: 'Order created successfully',
      data: { id: 'order-1' },
    });
  });

  it('cancels an expired hold with the checkout lock and transaction limits', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(tx));
    jest.spyOn(service, 'cancelOrderInTransaction').mockResolvedValue({
      id: 'expired',
      status: 'CANCELLED',
    });
    await expect(service.cancelExpiredOrder('expired')).resolves.toMatchObject({
      id: 'expired',
      status: 'CANCELLED',
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 2000,
      timeout: 5000,
    });
    const limits = tx.$queryRaw.mock.calls.map((call) => String(call[0]));
    expect(limits.some((sql) => sql.includes('lock_timeout'))).toBe(true);
    expect(limits.some((sql) => sql.includes('statement_timeout'))).toBe(true);
  });

  it('does not store a 500 when checkout is busy and the same idempotency key succeeds on retry', async () => {
    const payload = { items: [{ ticketTypeId: 'ga', quantity: 2 }] };
    let attempts = 0;
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => {
      attempts += 1;
      const before = { ...type };
      const result = await work(tx);
      if (attempts === 1) {
        Object.assign(type, before);
        throw new Error(
          'Transaction already closed: Transaction API error: Transaction not found. Transaction already closed'
        );
      }
      return result;
    });

    await expect(service.createOrderHttp('buyer', payload, 'key-1')).rejects.toMatchObject({
      statusCode: 503,
      code: 'CHECKOUT_BUSY',
      retryAfter: 2,
    });
    expect(prisma.orderIdempotencyKey.update).not.toHaveBeenCalled();
    const storedStatuses = tx.orderIdempotencyKey.update.mock.calls.map(
      (call) => call[0].data.responseStatus
    );
    expect(storedStatuses.every((status) => status === 201)).toBe(true);
    expect(storedStatuses).not.toContain(500);
    expect(prisma.orderIdempotencyKey.findUnique).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 2000,
      timeout: 5000,
    });

    const retried = await service.createOrderHttp('buyer', payload, 'key-1');
    expect(retried).toMatchObject({ kind: 'idempotent', statusCode: 201 });
    if (retried.kind !== 'idempotent') throw new Error('retry did not return the stored response');
    expect(JSON.parse(retried.body)).toMatchObject({
      success: true,
      message: 'Order created successfully',
      data: { id: 'order', status: 'PENDING' },
    });
    expect(retried.body).not.toContain('"statusCode":500');
    const persisted = tx.orderIdempotencyKey.update.mock.calls.map(
      (call) => call[0].data.responseStatus
    );
    expect(persisted.every((status) => status === 201)).toBe(true);
    expect(persisted).not.toContain(500);
  });

  it('replays a stored idempotent response when a later checkout attempt is busy', async () => {
    const payload = { items: [{ ticketTypeId: 'ga', quantity: 2 }] };
    const storedBody = JSON.stringify({
      success: true,
      message: 'Order created successfully',
      data: { id: 'stored-order' },
    });
    timeoutAfterWork();
    (prisma.orderIdempotencyKey.findUnique as jest.Mock).mockResolvedValue({
      requestHash: hashOrderRequest(payload),
      responseStatus: 201,
      responseBody: storedBody,
    });

    await expect(service.createOrderHttp('buyer', payload, 'key-1')).resolves.toEqual({
      kind: 'idempotent',
      statusCode: 201,
      body: storedBody,
    });
    expect(prisma.orderIdempotencyKey.update).not.toHaveBeenCalled();
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('formats CHECKOUT_BUSY as a retryable 503', async () => {
    const app = express();
    app.get('/orders', (_req, _res, next) => next(checkoutBusyError()));
    app.use(errorHandler);
    const response = await request(app).get('/orders');
    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('2');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      success: false,
      code: 'CHECKOUT_BUSY',
      retryAfter: 2,
      message: 'Checkout is busy. Please try again.',
      errors: { code: 'CHECKOUT_BUSY' },
    });
  });
});
