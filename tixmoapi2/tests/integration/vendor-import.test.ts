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
    const disabledRead = await request(app)
      .get(`/api/v1/organizations/${organizationId}/showpass/fixtures`)
      .set(auth());
    expect(disabledRead.status).toBe(404);
    expect(disabledRead.body.code).toBe('FIXTURE_CONTROL_DISABLED');

    process.env.SHOWPASS_ADAPTER = 'fixture';

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
    expect(connected.body.data.webhookPath).toMatch(
      /^\/api\/v1\/vendors\/showpass\/hooks\/[0-9a-f-]{36}$/i
    );
    const webhookPath = connected.body.data.webhookPath as string;
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
    expect(dublinRow.currency).toBe('EUR');
    const festivalCurrency = await prisma.vendorFestivalConfig.findFirstOrThrow({
      where: { organizationId },
    });
    expect(festivalCurrency.currency).toBe('CAD');
    const mardiCurrency = await prisma.event.findUniqueOrThrow({ where: { id: mardi.id } });
    expect(mardiCurrency.currency).toBe('CAD');
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

    const remapped = await request(app)
      .put(`/api/v1/organizations/${organizationId}/showpass/config`)
      .set(auth())
      .send({
        vendorVenueId: 'fixture',
        ticketTypeMappings: [{ externalTicketTypeId: '4581610', tierName: 'Late Door' }],
      });
    expect(remapped.status).toBe(200);

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
    expect(updated.ticketTypes.filter((ticket) => ticket.name === 'Late Door')).toHaveLength(1);
    expect(Number(updated.ticketTypes.find((ticket) => ticket.name === 'Late Door')?.price)).toBe(
      30
    );
    expect(updated.ticketTypes.filter((ticket) => ticket.name === 'Door')).toHaveLength(0);

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

    const refusedList = async (url: string, query: Record<string, string>, capability: string) => {
      const response = await request(app).get(url).query(query).set(auth());
      expect(response.status).toBe(403);
      expect(response.body.data).toEqual({ code: 'EXTERNAL_TICKETING', capability });
    };
    await refusedList('/api/v1/promo-codes', { organizationId, eventId: dublin.id }, 'promo_codes');
    await refusedList('/api/v1/orders', { eventId: dublin.id }, 'orders');
    await refusedList('/api/v1/tickets', { eventId: dublin.id }, 'attendees');
    await refusedList('/api/v1/waitlists/status', { eventId: dublin.id }, 'waitlists');
    await refusedList('/api/v1/scanners/logs', { eventId: dublin.id }, 'scan');

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
    expect(publicEvent.body.data.currency).toBe('EUR');

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

    const sign = (invoiceId: string, hookSecret = secret) =>
      createHmac('sha1', hookSecret).update(invoiceId, 'utf8').digest('hex');
    const postHook = (body: string, hookSecret = secret, path = '/api/v1/vendors/showpass/webhook') => {
      const invoiceId = (JSON.parse(body) as { id: string }).id;
      return request(app)
        .post(path)
        .set('x-showpass-signature', sign(invoiceId, hookSecret))
        .set('Content-Type', 'application/json')
        .send(body);
    };
    const sold = () =>
      prisma.vendorSoldCountSnapshot.findFirstOrThrow({
        where: { eventId: mardi.id, externalTicketTypeId: '4581610' },
      });

    const raw = fixture('webhooks/invoice-purchase.mardi-gras.json').toString('utf8');
    type InvoiceBody = {
      id: string;
      event_type: string;
      data: { invoice_items: Array<{ quantity: number }> };
    };
    const firstHook = await postHook(raw);
    expect(firstHook.status).toBe(200);
    expect(firstHook.body.data.duplicate).toBe(false);
    const secondHook = await postHook(raw);
    expect(secondHook.body.data.duplicate).toBe(true);
    expect((await sold()).soldCount).toBe(253);
    const tampered = JSON.parse(raw) as {
      data: { invoice_items: Array<{ quantity: number }> };
    };
    tampered.data.invoice_items[0].quantity = 9;
    const rejected = await postHook(JSON.stringify(tampered));
    expect(rejected.status).toBe(409);
    expect(rejected.body.message).toBe(
      'Showpass webhook quantities do not match the recorded invoice'
    );
    expect((await sold()).soldCount).toBe(253);

    const secondInvoice = fixture('webhooks/invoice-purchase.mardi-gras-2.json').toString('utf8');
    const routed = await postHook(secondInvoice, secret, webhookPath);
    expect(routed.status).toBe(200);
    expect(routed.body.data.duplicate).toBe(false);
    expect((await sold()).soldCount).toBe(255);
    const routedAgain = await postHook(secondInvoice);
    expect(routedAgain.body.data.duplicate).toBe(true);
    expect((await sold()).soldCount).toBe(255);
    const wrongRoute = await postHook(secondInvoice, secret, `${webhookPath}nope`);
    expect(wrongRoute.status).toBe(401);

    const refund = JSON.parse(raw) as InvoiceBody;
    refund.event_type = 'invoice.refund';
    refund.data.invoice_items[0].quantity = 1;
    const refunded = await postHook(JSON.stringify(refund));
    expect(refunded.status).toBe(200);
    expect((await sold()).soldCount).toBe(254);
    const tooLarge = JSON.parse(JSON.stringify(refund)) as InvoiceBody;
    tooLarge.data.invoice_items[0].quantity = 100;
    const oversized = await postHook(JSON.stringify(tooLarge));
    expect(oversized.status).toBe(409);
    expect(oversized.body.message).toBe('Refund quantity exceeds the recorded purchase');
    expect((await sold()).soldCount).toBe(254);
    const unknownRefund = JSON.parse(JSON.stringify(refund)) as InvoiceBody;
    unknownRefund.id = 'mg-2026-refund-without-purchase';
    const missingPurchase = await postHook(JSON.stringify(unknownRefund));
    expect(missingPurchase.status).toBe(409);
    expect(missingPurchase.body.message).toBe(
      'No recorded purchase for this invoice on this connection'
    );
    const otherType = JSON.parse(raw) as InvoiceBody;
    otherType.event_type = 'invoice.transfer';
    const rejectedType = await postHook(JSON.stringify(otherType));
    expect(rejectedType.status).toBe(400);
    expect(rejectedType.body.message).toBe('Showpass webhook event type is not accepted');
    const longId = JSON.parse(raw) as InvoiceBody;
    longId.id = 'x'.repeat(129);
    const tooLong = await postHook(JSON.stringify(longId));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.message).toBe('Showpass invoice id is too long');
    expect((await sold()).soldCount).toBe(254);
    const voided = JSON.parse(JSON.stringify(refund)) as InvoiceBody;
    voided.event_type = 'invoice.void';
    voided.data.invoice_items[0].quantity = 1;
    const voidedHook = await postHook(JSON.stringify(voided));
    expect(voidedHook.status).toBe(200);
    expect((await sold()).soldCount).toBe(253);

    const other = await registerUser(app, {
      email: 'vendor-import-other@example.com',
      role: 'OWNER',
    });
    const otherOrg = await createOrganization(app, other.accessToken, {
      name: 'Other Festival',
      slug: 'other-festival',
    });
    const otherSecret = 'sp_demo_webhook_secret_b';
    const otherConnection = await request(app)
      .post(`/api/v1/organizations/${otherOrg.id}/showpass/connection`)
      .set({ Authorization: `Bearer ${other.accessToken}` })
      .send({ apiKey: 'sp_demo_valid_key', vendorVenueId: 'fixture', webhookSecret: otherSecret });
    expect(otherConnection.status).toBe(201);
    const crossInvoice = JSON.parse(secondInvoice) as InvoiceBody;
    crossInvoice.id = 'mg-2026-purchase-cross-org';
    const crossBody = JSON.stringify(crossInvoice);
    const otherOnly = await postHook(crossBody, otherSecret);
    expect(otherOnly.status).toBe(200);
    expect(otherOnly.body.data.duplicate).toBe(false);
    expect((await sold()).soldCount).toBe(253);
    const otherReplay = await postHook(crossBody, otherSecret);
    expect(otherReplay.body.data.duplicate).toBe(true);
    const firstOrgCross = await postHook(crossBody, secret);
    expect(firstOrgCross.status).toBe(200);
    expect(firstOrgCross.body.data.duplicate).toBe(false);
    expect((await sold()).soldCount).toBe(255);
    const otherStillOnce = await prisma.vendorWebhookInbox.findFirst({
      where: {
        organizationId: otherOrg.id,
        signedInvoiceId: 'mg-2026-purchase-cross-org',
        eventType: 'invoice.purchase',
        status: 'PROCESSED',
      },
    });
    expect(otherStillOnce).toBeTruthy();
    expect(
      await prisma.vendorWebhookInbox.count({
        where: { signedInvoiceId: 'mg-2026-purchase-cross-org', eventType: 'invoice.purchase' },
      })
    ).toBe(2);
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
    delete process.env.SHOWPASS_FIXTURE_REVISION;
    const fixtureRead = await request(app)
      .get(`/api/v1/organizations/${organizationId}/showpass/fixtures`)
      .set(auth());
    expect(fixtureRead.status).toBe(200);
    expect(fixtureRead.body.data.revision).toBe('baseline');
    expect(Array.isArray(fixtureRead.body.data.revokedKeys)).toBe(true);
    process.env.SHOWPASS_FIXTURE_REVISION = 'current';

    const removed = await request(app)
      .delete(`/api/v1/organizations/${organizationId}/showpass`)
      .set(auth());
    expect(removed.status).toBe(200);
    expect(removed.body.data).toEqual({ disconnected: true });
    const afterDelete = await request(app)
      .get(`/api/v1/organizations/${organizationId}/showpass`)
      .set(auth());
    expect(afterDelete.body).toEqual({ success: true, data: null });
    const kept = await prisma.event.findUniqueOrThrow({ where: { id: dublin.id } });
    expect(kept.ticketingMode).toBe('EXTERNAL');
    expect(kept.externalPurchaseUrl).toContain('showpass.com');
    expect(await prisma.vendorWebhookInbox.count({ where: { organizationId } })).toBe(0);
    expect(await prisma.vendorConnection.count({ where: { organizationId } })).toBe(0);
    const reconnected = await request(app)
      .post(`/api/v1/organizations/${organizationId}/showpass/connection`)
      .set(auth())
      .send({ apiKey: 'sp_demo_valid_key', vendorVenueId: 'fixture', webhookSecret: secret });
    expect(reconnected.status).toBe(201);
    expect(reconnected.body.data.webhookPath).toMatch(
      /^\/api\/v1\/vendors\/showpass\/hooks\/[0-9a-f-]{36}$/i
    );
    expect(reconnected.body.data.webhookPath).not.toBe(webhookPath);

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
