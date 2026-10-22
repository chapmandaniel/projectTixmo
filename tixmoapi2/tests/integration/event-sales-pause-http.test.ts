// Mounted HTTP/auth/tenant/validation + real SQL; provider/notifications synthetic.
jest.mock('stripe', () => jest.fn(() => ({})));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendOrderConfirmation: jest.fn(() => Promise.resolve(true)),
    sendAdminAlert: jest.fn(() => Promise.reject(new Error('Unexpected admin notification'))),
  },
}));
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { PaymentService } from '../../src/api/payments/service';
import { generateAccessToken } from '../../src/utils/jwt';
import { generateTicketQRData } from '../../src/utils/qrcode';
import { notificationService } from '../../src/utils/notificationService';

const roles = ['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER'] as const;
type Role = (typeof roles)[number] | 'CUSTOMER' | 'TEAM_MEMBER' | 'SCANNER';
describe('Mounted event sales-pause authorization and paid access', () => {
  let ids: {
    org: string;
    foreignOrg: string;
    event: string;
    foreignEvent: string;
    type: string;
    foreignType: string;
    scanner: string;
    users: Record<Role, string>;
    foreignUsers: Record<(typeof roles)[number], string>;
  };
  let bodyWork: Promise<void> | undefined,
    unsafe = false;
  const qualify = (name: string, body: () => Promise<void>) =>
    it(
      name,
      () => {
        bodyWork = body();
        return bodyWork;
      },
      30000
    );
  async function join() {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.allSettled(bodyWork ? [bodyWork] : []),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Unjoined sales-pause HTTP work; preserve fixtures')),
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
  }
  const token = (id: string, role: Role) =>
    generateAccessToken({
      userId: id,
      email: id + '@example.test',
      role,
      sessionVersion: 0,
      emailVerified: true,
    });
  const pause = (id: string, role: Role, body: Record<string, unknown>, eventId = ids.event) =>
    request(app)
      .post(`/api/v1/events/${eventId}/sales-pause`)
      .set('Authorization', `Bearer ${token(id, role)}`)
      .send(body);
  const input = (paused = true) => ({
    paused,
    requestId: randomUUID(),
    reason: 'Synthetic gate staffing review',
  });
  const snapshot = async (eventId = ids.event) => ({
    event: await prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
    stock: await prisma.ticketType.findMany({ where: { eventId }, orderBy: { id: 'asc' } }),
    orders: await prisma.order.findMany({
      where: { eventId },
      include: { tickets: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    }),
    audit: await prisma.eventSalesControl.findMany({ where: { eventId }, orderBy: { id: 'asc' } }),
  });
  beforeEach(() => {
    bodyWork = (async () => {
      if (unsafe) throw new Error('Prior sales-pause work remains unresolved');
      jest.clearAllMocks();
      ids = {
        org: randomUUID(),
        foreignOrg: randomUUID(),
        event: randomUUID(),
        foreignEvent: randomUUID(),
        type: randomUUID(),
        foreignType: randomUUID(),
        scanner: randomUUID(),
        users: Object.fromEntries(
          [...roles, 'CUSTOMER', 'TEAM_MEMBER', 'SCANNER'].map((role) => [role, randomUUID()])
        ) as Record<Role, string>,
        foreignUsers: Object.fromEntries(roles.map((role) => [role, randomUUID()])) as Record<
          (typeof roles)[number],
          string
        >,
      };
      for (const id of [ids.org, ids.foreignOrg])
        await prisma.organization.create({ data: { id, name: id, slug: id, type: 'PROMOTER' } });
      for (const [organizationId, users] of [
        [ids.org, ids.users],
        [ids.foreignOrg, ids.foreignUsers],
      ] as const)
        for (const [role, id] of Object.entries(users))
          await prisma.user.create({
            data: {
              id,
              organizationId,
              role: role as Role,
              email: id + '@example.test',
              firstName: 'Synthetic',
              lastName: 'Sales control',
              passwordHash: 'synthetic',
              emailVerified: true,
              isPlatformAdmin: false,
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
            status: 'ON_SALE',
            startDatetime: new Date(Date.now() + 86400000),
          },
        });
        await prisma.ticketType.create({
          data: {
            id: type,
            eventId: id,
            name: 'GA',
            price: 10,
            quantityTotal: 5,
            quantityAvailable: 5,
          },
        });
      }
      await orderService.createOrder(ids.foreignUsers.OWNER, {
        items: [{ ticketTypeId: ids.foreignType, quantity: 1 }],
      });
    })();
    return bodyWork;
  }, 30000);
  afterEach(async () => {
    if (unsafe) throw new Error('Preserve sales-pause fixture context');
    await join();
    jest.restoreAllMocks();
    bodyWork = (async () => {
      const events = [ids.event, ids.foreignEvent];
      const orders = await prisma.order.findMany({
        where: { eventId: { in: events } },
        select: { id: true },
      });
      await prisma.paymentWebhookEvent.deleteMany({
        where: { orderId: { in: orders.map((order) => order.id) } },
      });
      await prisma.scanLog.deleteMany({ where: { scannerId: ids.scanner } });
      await prisma.scanner.deleteMany({ where: { id: ids.scanner } });
      await prisma.eventSalesControl.deleteMany({ where: { eventId: { in: events } } });
      await prisma.ticket.deleteMany({ where: { eventId: { in: events } } });
      await prisma.order.deleteMany({ where: { eventId: { in: events } } });
      await prisma.ticketType.deleteMany({ where: { eventId: { in: events } } });
      await prisma.event.deleteMany({ where: { id: { in: events } } });
      await prisma.user.deleteMany({
        where: { id: { in: [...Object.values(ids.users), ...Object.values(ids.foreignUsers)] } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: [ids.org, ids.foreignOrg] } } });
    })();
    await join();
    await bodyWork;
  }, 15000);
  afterAll(async () => {
    if (!unsafe) await prisma.$disconnect();
  });

  qualify(
    'anonymous, customer/team-member/scanner and all foreign management roles leave event and audit unchanged',
    async () => {
      const before = await snapshot(),
        foreign = await snapshot(ids.foreignEvent);
      expect(
        (await request(app).post(`/api/v1/events/${ids.event}/sales-pause`).send(input())).status
      ).toBe(401);
      for (const role of ['CUSTOMER', 'TEAM_MEMBER', 'SCANNER'] as const)
        expect((await pause(ids.users[role], role, input())).status).toBe(403);
      for (const role of roles)
        expect((await pause(ids.foreignUsers[role], role, input())).status).toBe(403);
      expect(await snapshot()).toEqual(before);
      expect(await snapshot(ids.foreignEvent)).toEqual(foreign);
    }
  );

  for (const role of roles)
    qualify(
      `${role} can pause and resume only its own event through mounted middleware`,
      async () => {
        const before = await snapshot(),
          foreign = await snapshot(ids.foreignEvent);
        const body = input();
        const response = await pause(ids.users[role], role, body);
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          eventId: ids.event,
          salesPaused: true,
          changed: true,
          replayed: false,
          requestId: body.requestId,
        });
        const after = await snapshot();
        expect(after.event).toEqual({
          ...before.event,
          salesPaused: true,
          updatedAt: after.event.updatedAt,
        });
        expect(after.stock).toEqual(before.stock);
        expect(after.orders).toEqual(before.orders);
        expect(after.audit).toHaveLength(1);
        expect(after.audit[0]).toMatchObject({
          eventId: ids.event,
          organizationId: ids.org,
          actorId: ids.users[role],
          requestId: body.requestId,
          reason: body.reason,
          beforePaused: false,
          afterPaused: true,
        });
        const resumed = await pause(ids.users[role], role, input(false));
        expect(resumed.status).toBe(200);
        expect(resumed.body.data.salesPaused).toBe(false);
        const final = await snapshot();
        expect(final.audit).toHaveLength(2);
        expect(final.audit[1].actorId).toBe(ids.users[role]);
        expect(final.event.salesPaused).toBe(false);
        expect(final.stock).toEqual(before.stock);
        expect(final.orders).toEqual(before.orders);
        expect(await snapshot(ids.foreignEvent)).toEqual(foreign);
      }
    );

  qualify(
    'mounted validation, actor evidence and request replay remain immutable after later resume',
    async () => {
      const body = input();
      const first = await pause(ids.users.OWNER, 'OWNER', body);
      expect(first.status).toBe(200);
      const saved = await snapshot();
      const replay = await pause(ids.users.OWNER, 'OWNER', body);
      expect(replay.status).toBe(200);
      expect(replay.body.data).toMatchObject({ auditId: first.body.data.auditId, replayed: true });
      expect(await snapshot()).toEqual(saved);
      for (const invalid of [
        { ...body, actorId: ids.foreignUsers.OWNER },
        { ...body, reason: ' ' },
        { ...body, paused: 'true' },
      ])
        expect((await pause(ids.users.OWNER, 'OWNER', invalid)).status).toBe(400);
      expect((await pause(ids.users.ADMIN, 'ADMIN', body)).status).toBe(409);
      expect(
        (await pause(ids.users.OWNER, 'OWNER', { ...body, reason: 'Different input' })).status
      ).toBe(409);
      expect(await snapshot()).toEqual(saved);
      expect((await pause(ids.users.OWNER, 'OWNER', input(false))).status).toBe(200);
      const resumed = await snapshot();
      const historical = await pause(ids.users.OWNER, 'OWNER', body);
      expect(historical.status).toBe(200);
      expect(historical.body.data).toMatchObject({
        salesPaused: true,
        replayed: true,
        auditId: first.body.data.auditId,
      });
      expect(await snapshot()).toEqual(resumed);
      expect(resumed.event.salesPaused).toBe(false);
    }
  );

  qualify(
    'pause blocks new HTTP orders while paid QR, scanner entry and existing payment recovery still work',
    async () => {
      const buyer = ids.users.CUSTOMER;
      const paid = await orderService.createOrder(buyer, {
        items: [{ ticketTypeId: ids.type, quantity: 1 }],
      });
      await orderService.confirmOrder(paid.id);
      await prisma.order.update({
        where: { id: paid.id },
        data: { receiptStatus: 'SENT', receiptSentAt: new Date() },
      });
      const pending = await orderService.createOrder(buyer, {
        items: [{ ticketTypeId: ids.type, quantity: 1 }],
      });
      const intentId = 'pi_' + randomUUID();
      await prisma.order.update({ where: { id: pending.id }, data: { paymentIntentId: intentId } });
      const before = await snapshot(),
        foreign = await snapshot(ids.foreignEvent);
      expect((await pause(ids.users.MANAGER, 'MANAGER', input())).status).toBe(200);
      const paused = await snapshot();
      expect(paused.stock).toEqual(before.stock);
      expect(paused.orders).toEqual(before.orders);
      const denied = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token(buyer, 'CUSTOMER')}`)
        .send({ items: [{ ticketTypeId: ids.type, quantity: 1 }] });
      expect(denied.status).toBe(409);
      expect(denied.body.errors).toMatchObject({ code: 'SALES_PAUSED' });
      expect(await snapshot()).toEqual(paused);
      const paidTicket = await prisma.ticket.findFirstOrThrow({ where: { orderId: paid.id } });
      const qr = await request(app)
        .get(`/api/v1/tickets/${paidTicket.id}/qr`)
        .set('Authorization', `Bearer ${token(buyer, 'CUSTOMER')}`);
      expect(qr.status).toBe(200);
      expect(qr.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
      const scannerKey = 'sk_scanner_' + randomUUID();
      await prisma.scanner.create({
        data: {
          id: ids.scanner,
          name: 'Synthetic gate',
          apiKey: scannerKey,
          organizationId: ids.org,
          eventId: ids.event,
          createdBy: ids.users.OWNER,
        },
      });
      const scan = (ticket: { id: string; barcode: string }) =>
        request(app)
          .post('/api/v1/scanners/scan')
          .set('Authorization', `Bearer ${scannerKey}`)
          .send({
            qrData: generateTicketQRData(ticket.id, ticket.barcode, ids.event),
            scanType: 'ENTRY',
          });
      const accepted = await scan(paidTicket);
      expect(accepted.status).toBe(200);
      expect(accepted.body.data.success).toBe(true);
      const duplicate = await scan(paidTicket);
      expect(duplicate.status).toBe(200);
      expect(duplicate.body.data.success).toBe(false);
      expect(duplicate.body.data.reason).toContain('already been used');
      const provider = {
        paymentIntents: {
          retrieve: jest.fn((id: string) => {
            if (id !== intentId) throw new Error('Unexpected payment lookup');
            return Promise.resolve({
              id,
              status: 'succeeded',
              amount: 1000,
              amount_received: 1000,
              currency: pending.currency,
              metadata: { orderId: pending.id, userId: buyer },
            });
          }),
        },
        refunds: {
          create: jest.fn(() => {
            throw new Error('Unexpected refund');
          }),
        },
        events: {
          retrieve: jest.fn(() => {
            throw new Error('Unexpected event lookup');
          }),
        },
      };
      const service = new PaymentService();
      (service as any).stripe = provider;
      // Keep real queue predicates and SQL but select only this suite's owned orders.
      const ownedOrders = [paid.id, pending.id];
      const restorers: jest.SpyInstance[] = [];
      for (const [model, ownership] of [
        [prisma.order, { id: { in: ownedOrders } }],
        [prisma.paymentAttempt, { orderId: { in: ownedOrders } }],
        [prisma.paymentRefund, { orderId: { in: ownedOrders } }],
        [prisma.paymentWebhookEvent, { orderId: { in: ownedOrders } }],
      ] as Array<[any, unknown]>) {
        const find = model.findMany.bind(model);
        restorers.push(
          jest
            .spyOn(model, 'findMany')
            .mockImplementation((args: any) =>
              find({ ...args, where: { AND: [args.where, ownership] } })
            )
        );
      }
      try {
        await service.recoverPayments();
      } finally {
        for (const restore of restorers.reverse()) restore.mockRestore();
      }
      const recovered = await prisma.order.findUniqueOrThrow({ where: { id: pending.id } });
      expect(recovered).toMatchObject({ status: 'PAID', paymentStatus: 'SUCCEEDED' });
      expect(recovered.receiptSentAt).not.toBeNull();
      expect(provider.paymentIntents.retrieve.mock.calls).toEqual([[intentId]]);
      expect(provider.refunds.create).not.toHaveBeenCalled();
      expect(provider.events.retrieve).not.toHaveBeenCalled();
      expect(notificationService.sendOrderConfirmation).toHaveBeenCalledTimes(1);
      expect(notificationService.sendAdminAlert).not.toHaveBeenCalled();
      const recoveredTicket = await prisma.ticket.findFirstOrThrow({
        where: { orderId: pending.id },
      });
      const recoveredQR = await request(app)
        .get(`/api/v1/tickets/${recoveredTicket.id}/qr`)
        .set('Authorization', `Bearer ${token(buyer, 'CUSTOMER')}`);
      expect(recoveredQR.status).toBe(200);
      expect((await scan(recoveredTicket)).body.data.success).toBe(true);
      const logs = await prisma.scanLog.findMany({ where: { scannerId: ids.scanner } });
      expect(logs).toHaveLength(3);
      expect(logs.filter((log) => log.success)).toHaveLength(2);
      expect(logs.every((log) => log.eventId === ids.event)).toBe(true);
      const final = await snapshot();
      expect(final.event.salesPaused).toBe(true);
      expect(final.event.status).toBe('ON_SALE');
      expect(final.stock[0]).toMatchObject({
        quantityAvailable: 3,
        quantityHeld: 0,
        quantitySold: 2,
      });
      expect(final.audit).toEqual(paused.audit);
      expect(final.orders).toHaveLength(2);
      expect(await snapshot(ids.foreignEvent)).toEqual(foreign);
    }
  );
});
