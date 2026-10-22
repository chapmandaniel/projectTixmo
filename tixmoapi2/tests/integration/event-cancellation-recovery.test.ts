// Collected managed-CI qualification; no provider/notification transport is permitted.
jest.mock('stripe', () => jest.fn(() => ({})));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('Cancellation qualification forbids notification transport');
      },
    }
  ),
}));
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { eventService } from '../../src/api/events/service';
import { orderService } from '../../src/api/orders/service';
import { PaymentService } from '../../src/api/payments/service';
import { generateAccessToken } from '../../src/utils/jwt';

const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('Event cancellation interruption and authorized recovery', () => {
  let ids: ReturnType<typeof allocate>;
  let bodyWork: Promise<void> | undefined;
  let unsafe = false;
  const qualify = (name: string, body: () => Promise<void>) =>
    it(
      name,
      () => {
        bodyWork = body();
        return bodyWork;
      },
      30000
    );
  const joinBody = async () => {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.allSettled(bodyWork ? [bodyWork] : []),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Unjoined cancellation work; preserve managed-CI fixtures')),
            8000
          );
        }),
      ]);
    } catch (error) {
      unsafe = true;
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  function allocate() {
    return {
      org: randomUUID(),
      event: randomUUID(),
      type: randomUUID(),
      tier: randomUUID(),
      promo: randomUUID(),
      buyer: randomUUID(),
      owner: randomUUID(),
      foreignOrg: randomUUID(),
      foreignEvent: randomUUID(),
      foreignType: randomUUID(),
      foreignBuyer: randomUUID(),
      foreignOwner: randomUUID(),
    };
  }
  const token = (id: string, role: string) =>
    generateAccessToken({
      userId: id,
      email: `${id}@example.test`,
      role,
      sessionVersion: 0,
      emailVerified: true,
    });
  const reserve = () =>
    orderService.createOrder(ids.buyer, {
      items: [{ ticketTypeId: ids.type, quantity: 1 }],
      promoCode: ids.promo,
    });
  const foreignSnapshot = async () => ({
    buyer: await prisma.user.findUnique({ where: { id: ids.foreignBuyer } }),
    event: await prisma.event.findUnique({ where: { id: ids.foreignEvent } }),
    stock: await prisma.ticketType.findUnique({ where: { id: ids.foreignType } }),
    orders: await prisma.order.findMany({
      where: { eventId: ids.foreignEvent },
      orderBy: { id: 'asc' },
    }),
    tickets: await prisma.ticket.findMany({
      where: { eventId: ids.foreignEvent },
      orderBy: { id: 'asc' },
    }),
  });
  const targetRows = async () => ({
    orders: await prisma.order.findMany({ where: { eventId: ids.event }, orderBy: { id: 'asc' } }),
    tickets: await prisma.ticket.findMany({
      where: { eventId: ids.event },
      orderBy: { id: 'asc' },
    }),
  });
  const conservation = async (available: number, held: number, sold: number) => {
    expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: ids.type } })).toMatchObject({
      quantityAvailable: available,
      quantityHeld: held,
      quantitySold: sold,
    });
    expect(await prisma.ticketTier.findUniqueOrThrow({ where: { id: ids.tier } })).toMatchObject({
      quantityHeld: held,
      quantitySold: sold,
    });
    expect(await prisma.promoCode.findUniqueOrThrow({ where: { id: ids.promo } })).toMatchObject({
      usesHeld: held,
      usesCount: sold,
    });
  };
  beforeEach(() => {
    bodyWork = (async () => {
      if (unsafe) throw new Error('Previous cancellation work remains unjoined');
      ids = allocate();
      for (const id of [ids.org, ids.foreignOrg])
        await prisma.organization.create({ data: { id, name: id, slug: id, type: 'PROMOTER' } });
      for (const [id, organizationId, role] of [
        [ids.buyer, ids.org, 'CUSTOMER'],
        [ids.owner, ids.org, 'OWNER'],
        [ids.foreignBuyer, ids.foreignOrg, 'CUSTOMER'],
        [ids.foreignOwner, ids.foreignOrg, 'OWNER'],
      ] as const)
        await prisma.user.create({
          data: {
            id,
            organizationId,
            role,
            email: `${id}@example.test`,
            passwordHash: 'synthetic',
            firstName: 'Synthetic',
            lastName: 'Cancellation',
            emailVerified: true,
          },
        });
      for (const [id, organizationId, type] of [
        [ids.event, ids.org, ids.type],
        [ids.foreignEvent, ids.foreignOrg, ids.foreignType],
      ]) {
        await prisma.event.create({
          data: {
            id,
            organizationId,
            name: id,
            slug: id,
            tags: [],
            status: 'PUBLISHED',
            startDatetime: new Date(Date.now() + 86400000),
          },
        });
        await prisma.ticketType.create({
          data: {
            id: type,
            eventId: id,
            name: 'GA',
            price: 10,
            quantityTotal: 10,
            quantityAvailable: 10,
          },
        });
      }
      await prisma.ticketTier.create({
        data: { id: ids.tier, ticketTypeId: ids.type, name: 'Early', price: 10, quantityLimit: 10 },
      });
      await prisma.promoCode.create({
        data: {
          id: ids.promo,
          organizationId: ids.org,
          code: ids.promo.toUpperCase(),
          discountType: 'FIXED_AMOUNT',
          discountValue: 1,
          maxUses: 10,
          validFrom: new Date(Date.now() - 1000),
          validUntil: new Date(Date.now() + 86400000),
        },
      });
      await orderService.createOrder(ids.foreignBuyer, {
        items: [{ ticketTypeId: ids.foreignType, quantity: 1 }],
      });
    })();
    return bodyWork;
  }, 30000);
  afterEach(async () => {
    if (unsafe) throw new Error('Unjoined work preserves fixtures');
    await joinBody();
    jest.restoreAllMocks();
    bodyWork = (async () => {
      await prisma.paymentWebhookEvent.deleteMany({
        where: {
          orderId: {
            in: (
              await prisma.order.findMany({ where: { eventId: ids.event }, select: { id: true } })
            ).map((order) => order.id),
          },
        },
      });
      const events = [ids.event, ids.foreignEvent];
      await prisma.ticket.deleteMany({ where: { eventId: { in: events } } });
      await prisma.order.deleteMany({ where: { eventId: { in: events } } });
      await prisma.ticketTier.deleteMany({ where: { id: ids.tier } });
      await prisma.ticketType.deleteMany({ where: { eventId: { in: events } } });
      await prisma.promoCode.deleteMany({ where: { id: ids.promo } });
      await prisma.event.deleteMany({ where: { id: { in: events } } });
      await prisma.user.deleteMany({
        where: { id: { in: [ids.buyer, ids.owner, ids.foreignBuyer, ids.foreignOwner] } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: [ids.org, ids.foreignOrg] } } });
    })();
    await joinBody();
  }, 15000);
  afterAll(async () => {
    if (!unsafe) await prisma.$disconnect();
  });

  qualify(
    'admits cancellation then observes a real PAID transition before cancellation takes the event lock',
    async () => {
      const order = await reserve();
      const before = await foreignSnapshot();
      const reached = gate(),
        resume = gate();
      const realTransaction = prisma.$transaction.bind(prisma);
      const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce((async (work: any) => {
        reached.resolve();
        await resume.promise;
        return realTransaction(work);
      }) as any);
      const cancelling = eventService.cancelEvent(ids.event);
      try {
        await reached.promise;
        await orderService.confirmOrder(order.id);
      } finally {
        resume.resolve();
        await cancelling;
        spy.mockRestore();
      }
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
      });
      expect(await prisma.ticket.findMany({ where: { orderId: order.id } })).toEqual([
        expect.objectContaining({ status: 'CANCELLED', inventoryState: 'SOLD' }),
      ]);
      await conservation(9, 0, 1);
      await eventService.cancelEvent(ids.event);
      await conservation(9, 0, 1);
      expect(await foreignSnapshot()).toEqual(before);
    }
  );

  qualify(
    'event cancellation wins the inverse schedule and rejects later real fulfillment',
    async () => {
      const order = await reserve();
      const before = await foreignSnapshot();
      const reached = gate(),
        resume = gate();
      const realCancel = orderService.cancelOrder.bind(orderService);
      const spy = jest
        .spyOn(orderService, 'cancelOrder')
        .mockImplementationOnce(async (...args) => {
          reached.resolve();
          await resume.promise;
          return realCancel(...args);
        });
      const cancelling = eventService.cancelEvent(ids.event);
      try {
        await reached.promise;
        await expect(orderService.confirmOrder(order.id)).rejects.toThrow(
          'can no longer be fulfilled'
        );
      } finally {
        resume.resolve();
        await cancelling;
        spy.mockRestore();
      }
      expect(await prisma.event.findUniqueOrThrow({ where: { id: ids.event } })).toMatchObject({
        status: 'CANCELLED',
      });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
        status: 'CANCELLED',
      });
      expect(await prisma.ticket.findMany({ where: { orderId: order.id } })).toEqual([
        expect.objectContaining({ inventoryState: 'RELEASED', status: 'CANCELLED' }),
      ]);
      await conservation(10, 0, 0);
      await eventService.cancelEvent(ids.event);
      await conservation(10, 0, 0);
      expect(await foreignSnapshot()).toEqual(before);
    }
  );

  qualify(
    'retains committed prefix effects after middle-order failure then retries/replays tier and promo accounting once',
    async () => {
      const paid = await reserve();
      await orderService.confirmOrder(paid.id);
      const orders = [await reserve(), await reserve(), await reserve()];
      const before = await foreignSnapshot();
      await conservation(6, 3, 1);
      const realFindMany = prisma.order.findMany.bind(prisma.order);
      const rank = [...orders, paid].map((order) => order.id);
      const selection = jest.spyOn(prisma.order, 'findMany').mockImplementationOnce((async (
        args: any
      ) => {
        const rows = await realFindMany(args);
        return rows.sort((a, b) => rank.indexOf(a.id) - rank.indexOf(b.id));
      }) as any);
      const realCancel = orderService.cancelOrder.bind(orderService);
      let calls = 0;
      const failure = new Error('controlled middle-order interruption');
      const cancellation = jest
        .spyOn(orderService, 'cancelOrder')
        .mockImplementation(async (...args) => {
          if (++calls === 2) throw failure;
          return realCancel(...args);
        });
      await expect(eventService.cancelEvent(ids.event)).rejects.toBe(failure);
      selection.mockRestore();
      cancellation.mockRestore();
      expect(await prisma.event.findUniqueOrThrow({ where: { id: ids.event } })).toMatchObject({
        status: 'CANCELLED',
      });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: orders[0].id } })).toMatchObject({
        status: 'CANCELLED',
      });
      for (const order of orders.slice(1)) {
        expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
          status: 'PENDING',
          promoReservation: 'HELD',
        });
        expect(await prisma.ticket.findMany({ where: { orderId: order.id } })).toEqual([
          expect.objectContaining({ inventoryState: 'HELD', status: 'VALID' }),
        ]);
      }
      expect(await prisma.ticket.findMany({ where: { orderId: paid.id } })).toEqual([
        expect.objectContaining({ status: 'VALID', inventoryState: 'SOLD' }),
      ]);
      await conservation(7, 2, 1);
      expect(await foreignSnapshot()).toEqual(before);
      await eventService.cancelEvent(ids.event);
      await conservation(9, 0, 1);
      for (const order of orders) {
        expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
          status: 'CANCELLED',
          promoReservation: 'RELEASED',
        });
        expect(await prisma.ticket.findMany({ where: { orderId: order.id } })).toEqual([
          expect.objectContaining({ inventoryState: 'RELEASED', status: 'CANCELLED' }),
        ]);
      }
      const settledRows = await targetRows();
      await eventService.cancelEvent(ids.event);
      await conservation(9, 0, 1);
      expect(await targetRows()).toEqual(settledRows);
      expect(await prisma.ticket.findMany({ where: { orderId: paid.id } })).toEqual([
        expect.objectContaining({ status: 'CANCELLED', inventoryState: 'SOLD' }),
      ]);
      expect(await prisma.paymentRefund.count({ where: { order: { eventId: ids.event } } })).toBe(
        0
      );
      expect(await foreignSnapshot()).toEqual(before);
    }
  );

  qualify(
    'mounted cancel route denies anonymous, customer and foreign tenant then permits owner reentry',
    async () => {
      await reserve();
      const before = await foreignSnapshot();
      const path = `/api/v1/events/${ids.event}/cancel`;
      const targetBefore = await targetRows();
      expect((await request(app).post(path)).status).toBe(401);
      for (const [id, role] of [
        [ids.buyer, 'CUSTOMER'],
        [ids.foreignOwner, 'OWNER'],
      ])
        expect(
          (
            await request(app)
              .post(path)
              .set('Authorization', `Bearer ${token(id, role)}`)
          ).status
        ).toBe(403);
      expect(await targetRows()).toEqual(targetBefore);
      expect(await prisma.event.findUniqueOrThrow({ where: { id: ids.event } })).toMatchObject({
        status: 'PUBLISHED',
      });
      await conservation(9, 1, 0);
      const cancel = () =>
        request(app)
          .post(path)
          .set('Authorization', `Bearer ${token(ids.owner, 'OWNER')}`);
      expect((await cancel()).status).toBe(200);
      const settledRows = await targetRows();
      expect((await cancel()).status).toBe(200);
      expect(await targetRows()).toEqual(settledRows);
      await conservation(10, 0, 0);
      expect(await foreignSnapshot()).toEqual(before);
    }
  );

  qualify(
    'late-paid webhook after event cancellation remains manual through replay and refund recovery',
    async () => {
      const order = await reserve();
      const before = await foreignSnapshot();
      const intent = {
        id: `pi_${randomUUID()}`,
        status: 'succeeded',
        amount: 900,
        amount_received: 900,
        currency: order.currency,
        metadata: { orderId: order.id, userId: ids.buyer },
      };
      await prisma.order.update({ where: { id: order.id }, data: { paymentIntentId: intent.id } });
      await eventService.cancelEvent(ids.event);
      const service = new PaymentService();
      const refuse = jest.fn(() => {
        throw new Error('Provider access forbidden');
      });
      let deliveryId = 'evt_' + randomUUID();
      (service as any).stripe = {
        webhooks: {
          constructEvent: (_payload: Buffer) => ({
            id: deliveryId,
            type: 'payment_intent.succeeded',
            data: { object: intent },
          }),
        },
        refunds: { create: refuse, retrieve: refuse, list: refuse },
        paymentIntents: { retrieve: refuse, create: refuse },
      };
      await service.handleWebhook('synthetic', Buffer.from('synthetic'));
      await service.handleWebhook('synthetic', Buffer.from('synthetic'));
      deliveryId = 'evt_' + randomUUID();
      await service.handleWebhook('synthetic', Buffer.from('synthetic'));
      await prisma.paymentRefund.update({
        where: { paymentIntentId: intent.id },
        data: { updatedAt: new Date(Date.now() - 120000) },
      });
      const realRefundSelection = prisma.paymentRefund.findMany.bind(prisma.paymentRefund);
      const selection = jest.spyOn(prisma.paymentRefund, 'findMany').mockImplementationOnce((async (
        args: any
      ) =>
        realRefundSelection({
          ...args,
          where: { AND: [args.where, { orderId: order.id }] },
        })) as any);
      await service.recoverRefunds();
      expect(selection).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reason: { not: 'LATE_PAYMENT' } }),
        })
      );
      selection.mockRestore();
      await eventService.cancelEvent(ids.event);
      expect(refuse).not.toHaveBeenCalled();
      expect(
        await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: intent.id } })
      ).toMatchObject({
        reason: 'LATE_PAYMENT',
        status: 'REQUESTED',
        stripeRefundId: null,
        errorMessage: 'Manual reconciliation required: late payment; automatic refund prohibited.',
      });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
        status: 'CANCELLED',
        paymentClosedAt: null,
      });
      await conservation(10, 0, 0);
      expect(await foreignSnapshot()).toEqual(before);
    }
  );
});
