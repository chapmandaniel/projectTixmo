import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { registerUser } from '../utils/testUtils';

describe('staff ticket actions stay inside the organization', () => {
  const key = `ticket-scope-${randomUUID()}`;
  let organizationId = '';
  let eventId = '';
  let typeId = '';
  let buyerId = '';
  let orderId = '';
  let outsiderToken = '';
  let insiderToken = '';
  let globalToken = '';

  beforeAll(async () => {
    const buyer = await registerUser(app, { email: `${key}-buyer@test.invalid` });
    buyerId = buyer.user.id;
    const insider = await registerUser(app, {
      role: 'MANAGER',
      email: `${key}-manager@test.invalid`,
    });
    insiderToken = insider.accessToken;
    const outsider = await registerUser(app, {
      role: 'OWNER',
      email: `${key}-outsider@test.invalid`,
    });
    outsiderToken = outsider.accessToken;
    const globalAdmin = await registerUser(app, {
      role: 'ADMIN',
      email: `${key}-platform@test.invalid`,
    });
    globalToken = globalAdmin.accessToken;

    const organization = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    organizationId = organization.id;
    const other = await prisma.organization.create({
      data: { name: `${key}-other`, slug: `${key}-other`, type: 'PROMOTER' },
    });
    await prisma.user.update({
      where: { id: insider.user.id },
      data: { organizationId },
    });
    await prisma.user.update({
      where: { id: outsider.user.id },
      data: { organizationId: other.id },
    });

    const event = await prisma.event.create({
      data: {
        organizationId,
        name: key,
        slug: key,
        tags: [],
        status: 'ON_SALE',
        startDatetime: new Date(Date.now() - 60 * 60 * 1000),
        endDatetime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    });
    eventId = event.id;
    const type = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'Admission',
        price: 20,
        quantityTotal: 20,
        quantityAvailable: 20,
      },
    });
    typeId = type.id;
    const order = await prisma.order.create({
      data: {
        orderNumber: key,
        userId: buyerId,
        eventId,
        totalAmount: 20,
        currency: 'cad',
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        refundStatus: 'NONE',
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { eventId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.ticketType.deleteMany({ where: { id: typeId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
    await prisma.$disconnect();
  });

  async function ticket(label: string) {
    return prisma.ticket.create({
      data: {
        orderId,
        eventId,
        userId: buyerId,
        ticketTypeId: typeId,
        barcode: `${key}-${label}`,
        pricePaid: 20,
        status: 'VALID',
        inventoryState: 'SOLD',
      },
    });
  }

  async function expectScope(
    send: (token: string) => request.Test,
    allowed: (body: { success?: boolean; data?: unknown }) => void
  ) {
    const denied = await send(outsiderToken);
    expect(denied.status).toBe(403);
    expect(denied.body.data).toBeUndefined();
    const missing = await send('missing');
    const platform = await send(globalToken);
    const sameOrg = await send(insiderToken);
    expect(platform.status).toBe(200);
    expect(sameOrg.status).toBe(200);
    allowed(sameOrg.body);
    return { missing, platform, sameOrg };
  }

  it('scopes staff ticket view', async () => {
    const row = await ticket('view');
    const { missing } = await expectScope(
      (token) =>
        request(app)
          .get(`/api/v1/tickets/${token === 'missing' ? randomUUID() : row.id}`)
          .set('Authorization', `Bearer ${token === 'missing' ? insiderToken : token}`),
      (body) => expect((body.data as { id: string }).id).toBe(row.id)
    );
    expect(missing.status).toBe(404);
  });

  it('scopes staff ticket QR retrieval', async () => {
    const row = await ticket('qr');
    const { missing } = await expectScope(
      (token) =>
        request(app)
          .get(`/api/v1/tickets/${token === 'missing' ? randomUUID() : row.id}/qr`)
          .set('Authorization', `Bearer ${token === 'missing' ? insiderToken : token}`),
      (body) => expect(typeof (body.data as { qrCode: string }).qrCode).toBe('string')
    );
    expect(missing.status).toBe(404);
  });

  it('scopes staff QR regeneration', async () => {
    const row = await ticket('regen');
    const before = row.barcode;
    const denied = await request(app)
      .post(`/api/v1/tickets/${row.id}/regenerate-qr`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(denied.status).toBe(403);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).barcode).toBe(before);

    const missing = await request(app)
      .post(`/api/v1/tickets/${randomUUID()}/regenerate-qr`)
      .set('Authorization', `Bearer ${insiderToken}`);
    expect(missing.status).toBe(404);

    const platform = await request(app)
      .post(`/api/v1/tickets/${row.id}/regenerate-qr`)
      .set('Authorization', `Bearer ${globalToken}`);
    expect(platform.status).toBe(200);
    expect(typeof platform.body.data.qrCode).toBe('string');
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).barcode).not.toBe(
      before
    );
  });

  it('scopes staff barcode validation', async () => {
    const row = await ticket('validate');
    const denied = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ barcode: row.barcode });
    expect(denied.status).toBe(403);
    expect(denied.body.data).toBeUndefined();

    const missing = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Authorization', `Bearer ${insiderToken}`)
      .send({ barcode: `${key}-missing` });
    expect(missing.status).toBe(404);

    const platform = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ barcode: row.barcode });
    expect(platform.status).toBe(200);
    expect(platform.body.data.valid).toBe(true);

    const sameOrg = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Authorization', `Bearer ${insiderToken}`)
      .send({ barcode: row.barcode });
    expect(sameOrg.status).toBe(200);
    expect(sameOrg.body.data.valid).toBe(true);
  });

  it('scopes staff check-in by barcode alone', async () => {
    const blocked = await ticket('check-blocked');
    const denied = await request(app)
      .post('/api/v1/tickets/check-in')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ barcode: blocked.barcode });
    expect(denied.status).toBe(403);
    expect(denied.body.data).toBeUndefined();
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: blocked.id } })).status).toBe(
      'VALID'
    );

    const missing = await request(app)
      .post('/api/v1/tickets/check-in')
      .set('Authorization', `Bearer ${insiderToken}`)
      .send({ barcode: `${key}-missing` });
    expect(missing.status).toBe(404);

    const same = await ticket('check-same');
    const sameOrg = await request(app)
      .post('/api/v1/tickets/check-in')
      .set('Authorization', `Bearer ${insiderToken}`)
      .send({ barcode: same.barcode });
    expect(sameOrg.status).toBe(200);
    expect(sameOrg.body.data.status).toBe('USED');

    const platformTicket = await ticket('check-platform');
    const platform = await request(app)
      .post('/api/v1/tickets/check-in')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ barcode: platformTicket.barcode });
    expect(platform.status).toBe(200);
    expect(platform.body.data.status).toBe('USED');
  });
});
