import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, createOrganization, prisma, registerUser } from '../utils/testUtils';

const key = 'cd'.repeat(32);
const secret = 'sp_demo_webhook_secret';
const fixture = (file: string) =>
  readFileSync(path.resolve(__dirname, '../../fixtures/showpass', file));

describe('Showpass vendor import', () => {
  let token = '';
  let organizationId = '';
  let userId = '';

  beforeAll(async () => {
    process.env.VENDOR_CREDENTIAL_KEY = key;
    process.env.SHOWPASS_FIXTURE_REVISION = 'baseline';
    process.env.SHOWPASS_SYNC_INTERVAL_MINUTES = '5';
    delete process.env.SHOWPASS_ADAPTER;
    delete process.env.SHOWPASS_FIXTURE_REVOKED_KEYS;
    await cleanupTestData();
    const registered = await registerUser(app, {
      email: 'vendor-import@example.com',
      role: 'OWNER',
    });
    token = registered.accessToken;
    userId = registered.user.id;
    const organization = await createOrganization(app, token, {
      name: 'Fixture Festival',
      slug: 'fixture-festival',
    });
    organizationId = organization.id;
  });

  afterAll(async () => {
    delete process.env.SHOWPASS_FIXTURE_REVOKED_KEYS;
    delete process.env.SHOWPASS_ADAPTER;
    delete process.env.SHOWPASS_SYNC_INTERVAL_MINUTES;
    process.env.SHOWPASS_FIXTURE_REVISION = 'current';
    await cleanupTestData();
    await prisma.$disconnect();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('covers AC-1 through AC-10 with fixture ids', async () => {
    const missing = await request(app)
      .get(`/api/v1/organizations/${organizationId}/showpass`)
      .set(auth());
    expect(missing.status).toBe(200);
    expect(missing.body).toEqual({ success: true, data: null });

    const disabled = await request(app)
      .put(`/api/v1/organizations/${organizationId}/showpass/fixtures`)
      .set(auth())
      .send({ revision: 'current' });
    expect(disabled.status).toBe(404);
    expect(disabled.body.code).toBe('FIXTURE_CONTROL_DISABLED');

    const invalid = await request(app)
      .post(`/api/v1/organizations/${organizationId}/showpass/connection`)
      .set(auth())
      .send({ apiKey: 'sp_demo_revoked_key', vendorVenueId: 'fixture', webhookSecret: secret });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toBe('Invalid token.');
    expect(await prisma.vendorConnection.count({ where: { organizationId } })).toBe(0);

    const connected = await request(app)
      .post(`/api/v1/organizations/${organizationId}/showpass/connection`)
      .set(auth())
      .send({ apiKey: 'sp_demo_valid_key', vendorVenueId: 'fixture', webhookSecret: secret });
    expect(connected.status).toBe(201);
    expect(connected.body.data.keyLast4).toBe('_key');
    expect(connected.body.data.status).toBe('ACTIVE');
    expect(connected.body.data.festivals[0].syncIntervalMinutes).toBe(5);
    expect(JSON.stringify(connected.body)).not.toContain('sp_demo_valid_key');

    const mapped = await request(app)
      .put(`/api/v1/organizations/${organizationId}/showpass/config`)
      .set(auth())
      .send({
        vendorVenueId: 'fixture',
        timezone: 'America/St_Johns',
        currency: 'CAD',
        syncIntervalMinutes: 60,
        ticketTypeMappings: [{ externalTicketTypeId: '4581610', tierName: 'Door' }],
      });
    expect(mapped.status).toBe(200);
    expect(mapped.body.data.ticketTypeMappings).toEqual([
      { externalTicketTypeId: '4581610', tierName: 'Door' },
    ]);

    await prisma.event.create({
      data: {
        organizationId,
        name: 'Existing Tixmo page',
        slug: 'halloween-at-the-polygon-gallery',
        timezone: 'America/St_Johns',
        status: 'DRAFT',
      },
    });

    const imported = await request(app)
      .post(`/api/v1/organizations/${organizationId}/showpass/import`)
      .set(auth())
      .send({
        vendorVenueId: 'fixture',
        externalItemIds: ['1543494', '1545631', '1563243'],
      });
    expect(imported.status).toBe(201);
    expect(imported.body.data.count).toBe(3);
    const bySlug = Object.fromEntries(
      imported.body.data.events.map((event: { slug: string }) => [event.slug, event])
    );
    expect(bySlug['halloween-at-the-polygon-gallery']).toBeUndefined();
    const polygon = imported.body.data.events.find((event: { name: string }) =>
      event.name.includes('Polygon')
    );
    const dublin = imported.body.data.events.find(
      (event: { timezone: string }) => event.timezone === 'Europe/Dublin'
    );
    const mardi = imported.body.data.events.find((event: { name: string }) =>
      event.name.includes('MARDI GRAS')
    );
    expect(polygon.slug).toBe('halloween-at-the-polygon-gallery-1');
    expect(dublin.timezone).toBe('Europe/Dublin');
    expect(dublin.timezone).not.toBe('America/St_Johns');
    const dublinRow = await prisma.event.findUniqueOrThrow({ where: { id: dublin.id } });
    expect(dublinRow.endDatetime && dublinRow.startDatetime).toBeTruthy();
    expect(dublinRow.endDatetime! > dublinRow.startDatetime!).toBe(true);
    expect(dublinRow.endDatetime! > new Date()).toBe(true);
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Dublin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(dublin.startDatetime));
    expect(local).toContain('17:15');

    const door = await prisma.ticketType.findFirst({
      where: { eventId: mardi.id, name: 'Door' },
    });
    expect(door).toBeTruthy();
    expect(Number(door?.price)).toBe(25);
    const saved = await request(app)
      .get(`/api/v1/organizations/${organizationId}/showpass`)
      .set(auth());
    expect(saved.body.data.festivals[0].ticketTypeMappings).toEqual(
      expect.arrayContaining([{ externalTicketTypeId: '4581610', tierName: 'Door' }])
    );

    const categorized = await request(app)
      .put(`/api/v1/events/${mardi.id}`)
      .set(auth())
      .send({ category: 'festival-notes' });
    expect(categorized.status).toBe(200);
    expect(categorized.body.data.category).toBe('festival-notes');
    expect(categorized.body.data.ticketingMode).toBe('EXTERNAL');
    const listed = await request(app)
      .get('/api/v1/events')
      .query({ page: 1, limit: 1, organizationId })
      .set(auth());
    expect(listed.status).toBe(200);
    expect(listed.body.data.pagination).toMatchObject({ page: 1, limit: 1 });
    process.env.SHOWPASS_FIXTURE_REVISION = 'current';

    const preview = await request(app)
      .get(`/api/v1/organizations/${organizationId}/showpass/preview`)
      .query({ vendorVenueId: 'fixture' })
      .set(auth());
    expect(preview.status).toBe(200);
    const statuses = Object.fromEntries(
      preview.body.data.events.map((event: { fixtureId: string; status: string }) => [
        event.fixtureId,
        event.status,
      ])
    );
    expect(statuses['sp-evt-1530323']).toBe('new');
    expect(statuses['sp-evt-1545631']).toBe('existing');
    expect(statuses['sp-evt-1563243']).toBe('changed');
    expect(statuses['sp-evt-1543494']).toBe('existing');

    const beforeCount = await prisma.event.count({ where: { organizationId } });
    const synced = await request(app)
      .post(`/api/v1/organizations/${organizationId}/showpass/sync`)
      .set(auth());
    expect(synced.status).toBe(200);
    expect(synced.body.data.status).toBe('ACTIVE');
    expect(await prisma.event.count({ where: { organizationId } })).toBe(beforeCount);
    const updated = await prisma.event.findUniqueOrThrow({
      where: { id: mardi.id },
      include: { ticketTypes: true },
    });
    expect(updated.name).toContain('Late Show');
    expect(updated.category).toBe('festival-notes');
    expect(updated.slug).toBe(mardi.slug);
    expect(updated.ticketTypes.filter((ticket) => ticket.name === 'Door')).toHaveLength(1);
    expect(Number(updated.ticketTypes.find((ticket) => ticket.name === 'Door')?.price)).toBe(30);

    const parent = await request(app)
      .post(`/api/v1/organizations/${organizationId}/showpass/import`)
      .set(auth())
      .send({ vendorVenueId: 'fixture', externalItemIds: ['1530323'] });
    expect(parent.status).toBe(201);
    expect(await prisma.vendorEventLink.count({ where: { externalItemId: '1530323' } })).toBe(1);
    const giantId = parent.body.data.events[0].id as string;
    const giantCounts = await request(app)
      .get(`/api/v1/organizations/${organizationId}/showpass/sold-counts`)
      .query({ eventId: giantId })
      .set(auth());
    expect(giantCounts.status).toBe(200);
    expect(giantCounts.body.data.length).toBeGreaterThan(0);
    expect(
      giantCounts.body.data.every((row: { soldCount: number | null }) => row.soldCount === null)
    ).toBe(true);
    expect(JSON.stringify(giantCounts.body)).not.toContain('"soldCount":0');

    const cloned = await request(app).post(`/api/v1/events/${dublin.id}/clone`).set(auth());
    expect(cloned.status).toBe(201);
    expect(cloned.body.data.ticketingMode).toBe('EXTERNAL');
    const clonedTypes = await prisma.ticketType.findMany({
      where: { eventId: cloned.body.data.id },
    });
    expect(clonedTypes.length).toBeGreaterThan(0);
    expect(
      clonedTypes.every((ticket) => ticket.status === 'HIDDEN' && ticket.quantityTotal === 0)
    ).toBe(true);

    const madeUp = `TICKET:00000000-0000-4000-8000-000000000000:MADE-UP:${dublin.id}`;
    const scanner = await request(app)
      .post('/api/v1/scanners/register')
      .set(auth())
      .send({ name: 'QA gate', organizationId });
    expect(scanner.status).toBe(201);
    const scan = await request(app)
      .post('/api/v1/scanners/scan')
      .set('Authorization', `Bearer ${scanner.body.data.apiKey}`)
      .send({ qrData: madeUp, scanType: 'ENTRY' });
    expect(scan.status).toBe(403);
    expect(scan.body.data).toEqual({ code: 'EXTERNAL_TICKETING', capability: 'scan' });
    const offline = await request(app)
      .post('/api/v1/scanners/validate')
      .set('Authorization', `Bearer ${scanner.body.data.apiKey}`)
      .send({
        scans: [{ qrData: madeUp, scannedAt: new Date().toISOString(), scanType: 'ENTRY' }],
      });
    expect(offline.status).toBe(403);
    expect(offline.body.data.code).toBe('EXTERNAL_TICKETING');
    expect(await prisma.ticket.count({ where: { eventId: dublin.id } })).toBe(0);
    expect(await prisma.order.count({ where: { eventId: dublin.id } })).toBe(0);
    expect(await prisma.waitlist.count({ where: { eventId: dublin.id } })).toBe(0);
    expect(await prisma.scanLog.count({ where: { eventId: dublin.id } })).toBe(0);

    const promos = await request(app)
      .get('/api/v1/promo-codes')
      .query({ organizationId, eventId: dublin.id })
      .set(auth());
    expect(promos.status).toBe(200);
    expect(promos.body.data.pagination.total).toBe(0);
    const orders = await request(app)
      .get('/api/v1/orders')
      .query({ eventId: dublin.id })
      .set(auth());
    expect(orders.status).toBe(200);
    expect(orders.body.data.pagination.total).toBe(0);
    const waitlist = await request(app)
      .get('/api/v1/waitlists/status')
      .query({ eventId: dublin.id })
      .set(auth());
    expect(waitlist.status).toBe(200);
    expect(waitlist.body.data).toBeNull();
    const scanners = await request(app)
      .get('/api/v1/scanners')
      .query({ organizationId, eventId: dublin.id })
      .set(auth());
    expect(scanners.status).toBe(200);
    expect(scanners.body.meta.total).toBe(0);
    const sessions = await request(app)
      .get('/api/v1/scanners/logs')
      .query({ eventId: dublin.id })
      .set(auth());
    expect(sessions.status).toBe(200);
    expect(sessions.body.meta.total).toBe(0);

    const counts = await request(app)
      .get(`/api/v1/organizations/${organizationId}/showpass/sold-counts`)
      .query({ eventId: mardi.id })
      .set(auth());
    expect(counts.status).toBe(200);
    expect(counts.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fixtureId: 'sp-evt-1563243',
          externalTicketTypeId: '4581612',
          soldCount: 40,
        }),
        expect.objectContaining({
          fixtureId: 'sp-evt-1563243',
          externalTicketTypeId: '4581610',
          soldCount: 250,
        }),
      ])
    );

    const publicEvent = await request(app).get(`/api/v1/events/public/${dublin.slug}`);
    expect(publicEvent.status).toBe(200);
    expect(publicEvent.body.data.ticketingMode).toBe('EXTERNAL');
    expect(publicEvent.body.data.externalPurchaseUrl).toBe(
      'https://www.showpass.com/pumpkins-after-dark-2026-6/'
    );

    const task = await request(app)
      .post('/api/v1/tasks')
      .set(auth())
      .send({ title: 'Gate plan', eventId: dublin.id, priority: 'HIGH', tag: 'OPS' });
    expect(task.status).toBe(201);
    expect(task.body.eventId).toBe(dublin.id);
    const filtered = await request(app)
      .get('/api/v1/tasks')
      .query({ eventId: dublin.id })
      .set(auth());
    expect(filtered.body.map((item: { id: string }) => item.id)).toContain(task.body.id);

    const refused = async (method: 'post', url: string, body: Record<string, unknown>) => {
      const response = await request(app)[method](url).set(auth()).send(body);
      expect(response.status).toBe(403);
      expect(response.body.data.code).toBe('EXTERNAL_TICKETING');
    };
    await refused('post', '/api/v1/promo-codes', {
      code: 'SHOWPASS10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      organizationId,
      eventId: dublin.id,
    });
    await refused('post', '/api/v1/waitlists/join', { eventId: dublin.id });
    await refused('post', '/api/v1/orders', {
      items: [{ ticketTypeId: door!.id, quantity: 1 }],
    });
    await refused('post', '/api/v1/scanners/register', {
      name: 'Gate',
      organizationId,
      eventId: dublin.id,
    });

    const raw = fixture('webhooks/invoice-purchase.mardi-gras.json').toString('utf8');
    const payload = JSON.parse(raw);
    const signature = createHmac('sha1', secret).update(payload.id, 'utf8').digest('hex');
    const firstHook = await request(app)
      .post('/api/v1/vendors/showpass/webhook')
      .set('x-showpass-signature', signature)
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(firstHook.status).toBe(200);
    expect(firstHook.body.data.duplicate).toBe(false);
    const secondHook = await request(app)
      .post('/api/v1/vendors/showpass/webhook')
      .set('x-showpass-signature', signature)
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(secondHook.body.data.duplicate).toBe(true);
    const afterHook = await prisma.vendorSoldCountSnapshot.findFirstOrThrow({
      where: { eventId: mardi.id, externalTicketTypeId: '4581610' },
    });
    expect(afterHook.soldCount).toBe(253);
    const tampered = JSON.parse(raw) as {
      data: { invoice_items: Array<{ quantity: number }> };
    };
    tampered.data.invoice_items[0].quantity = 9;
    const rejected = await request(app)
      .post('/api/v1/vendors/showpass/webhook')
      .set('x-showpass-signature', signature)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(tampered));
    expect(rejected.status).toBe(409);
    const afterTamper = await prisma.vendorSoldCountSnapshot.findFirstOrThrow({
      where: { eventId: mardi.id, externalTicketTypeId: '4581610' },
    });
    expect(afterTamper.soldCount).toBe(253);
    const stored = JSON.stringify(await prisma.vendorWebhookInbox.findMany());
    expect(stored).not.toContain('buyer@example.com');
    expect(stored).not.toContain('DO-NOT-STORE');

    process.env.SHOWPASS_ADAPTER = 'fixture';
    const switched = await request(app)
      .put(`/api/v1/organizations/${organizationId}/showpass/fixtures`)
      .set(auth())
      .send({ revision: 'baseline', revokedKeys: [] });
    expect(switched.status).toBe(200);
    expect(switched.body.data).toMatchObject({ revision: 'baseline', revokedKeys: [] });
    process.env.SHOWPASS_FIXTURE_REVISION = 'current';

    process.env.SHOWPASS_FIXTURE_REVOKED_KEYS = 'sp_demo_valid_key';
    const failed = await request(app)
      .post(`/api/v1/organizations/${organizationId}/showpass/sync`)
      .set(auth());
    expect(failed.status).toBe(200);
    expect(failed.body.data.status).toBe('REVOKED');
    expect(failed.body.data.lastError).toBe('Invalid token.');
    const alert = await prisma.notification.findFirst({
      where: { userId, subject: 'Showpass sync failed' },
    });
    expect(alert?.message).toContain('rejected the API key');
  });
});
