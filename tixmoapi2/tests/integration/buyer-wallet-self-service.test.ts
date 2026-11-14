import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { registerUser } from '../utils/testUtils';

jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true),
    sendOrderConfirmation: jest.fn().mockResolvedValue(true),
    sendTicketTransfer: jest.fn().mockResolvedValue(true),
    sendAdminAlert: jest.fn().mockResolvedValue(true),
  },
}));

describe('Buyer wallet self-service HTTP', () => {
  const key = `wallet-ss-${randomUUID()}`;
  let organizationId = '';
  let buyerToken = '';
  let buyerId = '';
  let buyerEmail = '';
  let otherToken = '';
  let otherOrderId = '';
  let recipientToken = '';
  let recipientId = '';
  let recipientEmail = '';
  const buyerOrderIds: string[] = [];
  let ownedTicketId = '';
  let ownedBarcode = '';

  async function paidOrder(userId: string, label: string) {
    const slug = `${key}-${label}`;
    const event = await prisma.event.create({
      data: {
        organizationId,
        name: slug,
        slug,
        tags: [],
        status: 'ON_SALE',
        startDatetime: new Date(Date.now() + 86_400_000),
        endDatetime: new Date(Date.now() + 90_000_000),
      },
    });
    const type = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Admission',
        price: 25,
        quantityTotal: 20,
        quantityAvailable: 19,
        quantitySold: 1,
      },
    });
    return prisma.order.create({
      data: {
        orderNumber: slug,
        userId,
        eventId: event.id,
        totalAmount: 25,
        currency: 'cad',
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        refundStatus: 'NONE',
        tickets: {
          create: [
            {
              eventId: event.id,
              userId,
              ticketTypeId: type.id,
              barcode: `${slug}-0`,
              qrCodeUrl: `data:image/png;base64,${label}`,
              pricePaid: 25,
              status: 'VALID',
              inventoryState: 'SOLD',
            },
          ],
        },
      },
      include: { tickets: true },
    });
  }

  beforeAll(async () => {
    const buyer = await registerUser(app, {
      email: `${key}-buyer@example.com`,
      password: 'Test123!',
      firstName: 'Wallet',
      lastName: 'Buyer',
    });
    buyerToken = buyer.accessToken;
    buyerId = buyer.user.id;
    buyerEmail = buyer.user.email;

    const other = await registerUser(app, {
      email: `${key}-other@example.com`,
      password: 'Test123!',
      firstName: 'Other',
      lastName: 'Buyer',
    });
    otherToken = other.accessToken;

    const recipient = await registerUser(app, {
      email: `${key}-recipient@example.com`,
      password: 'Test123!',
      firstName: 'Recipient',
      lastName: 'Buyer',
    });
    recipientToken = recipient.accessToken;
    recipientId = recipient.user.id;
    recipientEmail = recipient.user.email;

    const organization = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    organizationId = organization.id;

    for (const label of ['a', 'b', 'c']) {
      const order = await paidOrder(buyerId, label);
      buyerOrderIds.push(order.id);
      if (label === 'a') {
        ownedTicketId = order.tickets[0].id;
        ownedBarcode = order.tickets[0].barcode;
      }
    }
    const foreign = await paidOrder(other.user.id, 'foreign');
    otherOrderId = foreign.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { event: { slug: { startsWith: key } } } });
    await prisma.order.deleteMany({ where: { event: { slug: { startsWith: key } } } });
    await prisma.ticketType.deleteMany({ where: { event: { slug: { startsWith: key } } } });
    await prisma.event.deleteMany({ where: { slug: { startsWith: key } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: key } });
    await prisma.$disconnect();
  });

  describe('GET /api/v1/orders/mine', () => {
    it('lists only the authenticated buyer orders and paginates past page 1', async () => {
      const page1 = await request(app)
        .get('/api/v1/orders/mine?page=1&limit=1')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(page1.status).toBe(200);
      expect(page1.body.success).toBe(true);
      expect(page1.body.data.orders).toHaveLength(1);
      expect(page1.body.data.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 1, total: 3, pages: 3 })
      );
      const firstId = page1.body.data.orders[0].id as string;
      expect(buyerOrderIds).toContain(firstId);
      expect(page1.body.data.orders.map((row: { id: string }) => row.id)).not.toContain(
        otherOrderId
      );

      const page2 = await request(app)
        .get('/api/v1/orders/mine?page=2&limit=1')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(page2.status).toBe(200);
      expect(page2.body.data.orders).toHaveLength(1);
      expect(page2.body.data.pagination.page).toBe(2);
      const secondId = page2.body.data.orders[0].id as string;
      expect(buyerOrderIds).toContain(secondId);
      expect(secondId).not.toBe(firstId);
      expect(page2.body.data.orders.map((row: { id: string }) => row.id)).not.toContain(
        otherOrderId
      );

      const page3 = await request(app)
        .get('/api/v1/orders/mine?page=3&limit=1')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(page3.status).toBe(200);
      const seen = [firstId, secondId, page3.body.data.orders[0].id as string];
      expect(seen.sort()).toEqual([...buyerOrderIds].sort());
      expect(seen).not.toContain(otherOrderId);
    });

    it('never includes another buyer’s orders, even on an unfiltered first page', async () => {
      const res = await request(app)
        .get('/api/v1/orders/mine?limit=100')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(200);
      const ids = (res.body.data.orders as Array<{ id: string; userId?: string }>).map(
        (row) => row.id
      );
      expect(ids.sort()).toEqual([...buyerOrderIds].sort());
      expect(ids).not.toContain(otherOrderId);
      expect(
        (res.body.data.orders as Array<{ userId?: string }>).every(
          (row) => !row.userId || row.userId === buyerId
        )
      ).toBe(true);

      const other = await request(app)
        .get('/api/v1/orders/mine?limit=100')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(other.status).toBe(200);
      const otherIds = (other.body.data.orders as Array<{ id: string }>).map((row) => row.id);
      expect(otherIds).toEqual([otherOrderId]);
      expect(otherIds.some((id) => buyerOrderIds.includes(id))).toBe(false);
    });

    it('refuses an unauthenticated wallet order list', async () => {
      const res = await request(app).get('/api/v1/orders/mine');
      expect(res.status).toBe(401);
      expect(res.body.data).toBeUndefined();
    });
  });

  describe('ticket detail and QR ownership', () => {
    it('lets the owner view ticket detail and QR', async () => {
      const detail = await request(app)
        .get(`/api/v1/tickets/${ownedTicketId}`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.id).toBe(ownedTicketId);
      expect(detail.body.data.userId).toBe(buyerId);
      expect(detail.body.data.barcode).toBe(ownedBarcode);

      const qr = await request(app)
        .get(`/api/v1/tickets/${ownedTicketId}/qr`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(qr.status).toBe(200);
      expect(qr.body.data.qrCode).toMatch(/^data:image/);
    });

    it('does not let another buyer view ticket detail or QR', async () => {
      const detail = await request(app)
        .get(`/api/v1/tickets/${ownedTicketId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(detail.status).toBe(404);
      expect(detail.body.data).toBeUndefined();

      const qr = await request(app)
        .get(`/api/v1/tickets/${ownedTicketId}/qr`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(qr.status).toBe(403);
      expect(qr.body.data).toBeUndefined();
    });
  });

  describe('POST /api/v1/tickets/:id/transfer', () => {
    async function freshTicket() {
      const order = await paidOrder(buyerId, `xfer-${randomUUID().slice(0, 8)}`);
      return order.tickets[0];
    }

    async function senderQr(ticketId: string, token = buyerToken) {
      return request(app)
        .get(`/api/v1/tickets/${ticketId}/qr`)
        .set('Authorization', `Bearer ${token}`);
    }

    it("resolves padded mixed-case ' Bob@X.com' to the stored recipient", async () => {
      const bob = await registerUser(app, {
        email: 'bob@x.com',
        password: 'Test123!',
        firstName: 'Bob',
        lastName: 'Ex',
      });
      expect(bob.user.email).toBe('bob@x.com');
      const ticket = await freshTicket();
      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/transfer`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ recipientEmail: ' Bob@X.com' });
      expect(res.status).toBe(200);
      expect(res.body.data.userId).toBe(bob.user.id);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.userId).toBe(bob.user.id);
    });

    it('moves ownership, invalidates the sender QR, and issues a new credential', async () => {
      const ticket = await freshTicket();
      const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const priorQr = await senderQr(ticket.id);
      expect(priorQr.status).toBe(200);

      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/transfer`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ recipientEmail });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: ticket.id,
          userId: recipientId,
          status: 'VALID',
          transferredFrom: buyerId,
        })
      );
      expect(res.body.data).not.toHaveProperty('barcode');

      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.userId).toBe(recipientId);
      expect(after.barcode).not.toBe(before.barcode);
      expect(after.qrCodeUrl).toBeNull();

      const senderDenied = await senderQr(ticket.id);
      expect(senderDenied.status).toBe(403);
      const recipientQr = await senderQr(ticket.id, recipientToken);
      expect(recipientQr.status).toBe(200);
      expect(recipientQr.body.data.qrCode).toMatch(/^data:image/);
      expect(recipientQr.body.data.qrCode).not.toBe(priorQr.body.data.qrCode);

      const senderMine = await request(app)
        .get('/api/v1/tickets/mine?limit=100')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(senderMine.body.data.tickets.some((row: { id: string }) => row.id === ticket.id)).toBe(
        false
      );
      const recipientMine = await request(app)
        .get('/api/v1/tickets/mine?limit=100')
        .set('Authorization', `Bearer ${recipientToken}`);
      expect(
        recipientMine.body.data.tickets.some((row: { id: string }) => row.id === ticket.id)
      ).toBe(true);
    });

    it('refuses an unknown recipient and leaves the sender ticket usable', async () => {
      const ticket = await freshTicket();
      const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/transfer`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ recipientEmail: 'nobody-at-all@example.com' });
      expect(res.status).toBe(404);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.userId).toBe(buyerId);
      expect(after.barcode).toBe(before.barcode);
      expect(after.status).toBe('VALID');
      const qr = await senderQr(ticket.id);
      expect(qr.status).toBe(200);
      expect(qr.body.data.qrCode).toMatch(/^data:image/);
    });

    it('refuses a self-transfer and leaves the sender ticket usable', async () => {
      const ticket = await freshTicket();
      const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/transfer`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ recipientEmail: buyerEmail });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/yourself/i);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.userId).toBe(buyerId);
      expect(after.barcode).toBe(before.barcode);
      const qr = await senderQr(ticket.id);
      expect(qr.status).toBe(200);
    });

    it('refuses a used ticket and leaves it owned by the sender', async () => {
      const ticket = await freshTicket();
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'USED', checkedInAt: new Date(), checkedInBy: 'gate' },
      });
      const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/transfer`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ recipientEmail });
      expect(res.status).toBe(400);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.userId).toBe(buyerId);
      expect(after.barcode).toBe(before.barcode);
      expect(after.status).toBe('USED');
      const qr = await senderQr(ticket.id);
      expect(qr.status).toBe(200);
      expect(qr.body.data.qrCode).toMatch(/^data:image/);
    });

    it('refuses a refunded ticket and leaves ownership with the sender', async () => {
      const ticket = await freshTicket();
      await prisma.order.update({
        where: { id: ticket.orderId },
        data: { status: 'REFUNDED', refundStatus: 'SUCCEEDED' },
      });
      const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/transfer`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ recipientEmail });
      expect(res.status).toBe(400);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.userId).toBe(buyerId);
      expect(after.barcode).toBe(before.barcode);
      expect(after.transferredFrom).toBeNull();
      const detail = await request(app)
        .get(`/api/v1/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.userId).toBe(buyerId);
    });
  });
});
