import request from 'supertest';
import { UserRole } from '@prisma/client';

process.env.NODE_ENV = 'test';

const isPlaceholderCredential = (value?: string) => {
  const lowerValue = value?.trim().toLowerCase() || '';
  return (
    !lowerValue ||
    lowerValue.includes('your_') ||
    lowerValue.includes('_your') ||
    lowerValue.includes('change-this') ||
    lowerValue.includes('placeholder')
  );
};

if (isPlaceholderCredential(process.env.STRIPE_SECRET_KEY)) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_v1_smoke';
}
if (isPlaceholderCredential(process.env.STRIPE_WEBHOOK_SECRET)) {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_v1_smoke';
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lZp8eQAAAABJRU5ErkJggg==',
  'base64'
);

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockImplementation(async ({ metadata }) => ({
        id: `pi_v1_smoke_${metadata.orderId}`,
        client_secret: `pi_v1_smoke_${metadata.orderId}_secret`,
        metadata,
      })),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

jest.mock('../../src/services/upload.service', () => ({
  uploadService: {
    uploadMultiple: jest.fn().mockImplementation(async (files, folder = 'smoke') =>
      files.map((file: Express.Multer.File, index: number) => ({
        s3Key: `${folder}/v1-smoke-${index}-${file.originalname}`,
        s3Url: `https://test-storage.local/${folder}/v1-smoke-${index}-${file.originalname}`,
        filename: `v1-smoke-${index}-${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      }))
    ),
    resolveFileUrl: jest.fn().mockImplementation(async (key, url) => url || `https://test-storage.local/${key}`),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  },
}));

const app = require('../../src/app').default;
const {
  cleanupTestData,
  createOrganization,
  prisma,
  registerUser,
} = require('../utils/testUtils');

const expectSuccess = (response: request.Response, status: number, label: string) => {
  if (response.status !== status) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }
};

describe('V1 market readiness smoke', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('runs the operator, checkout, scanner, asset, approval, and analytics path', async () => {
    const organizer = await registerUser(app, {
      email: 'v1-smoke-organizer@test.com',
      firstName: 'V1',
      lastName: 'Organizer',
      role: UserRole.PROMOTER,
    });

    const organization = await createOrganization(app, organizer.accessToken, {
      name: 'V1 Smoke Org',
      slug: `v1-smoke-${Date.now()}`,
      type: 'PROMOTER',
    });

    const venueResponse = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        organizationId: organization.id,
        name: 'V1 Smoke Venue',
        address: {
          street: '10 Market Street',
          city: 'St. John\'s',
          state: 'NL',
          country: 'Canada',
          postalCode: 'A1A 1A1',
        },
        capacity: 500,
        timezone: 'America/St_Johns',
      });
    expectSuccess(venueResponse, 201, 'Create venue');
    const venue = venueResponse.body.data;

    const eventResponse = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        organizationId: organization.id,
        venueId: venue.id,
        title: 'V1 Smoke Event',
        description: 'End-to-end smoke event for market readiness.',
        startDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        capacity: 500,
      });
    expectSuccess(eventResponse, 201, 'Create event');
    const event = eventResponse.body.data;

    const generalTicketResponse = await request(app)
      .post('/api/v1/ticket-types')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        eventId: event.id,
        name: 'General Admission',
        price: 25,
        quantity: 100,
        maxPerOrder: 4,
      });
    expectSuccess(generalTicketResponse, 201, 'Create general ticket type');

    const vipTicketResponse = await request(app)
      .post('/api/v1/ticket-types')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        eventId: event.id,
        name: 'VIP',
        price: 60,
        quantity: 25,
        maxPerOrder: 2,
      });
    expectSuccess(vipTicketResponse, 201, 'Create VIP ticket type');

    const publishResponse = await request(app)
      .post(`/api/v1/events/${event.id}/publish`)
      .set('Authorization', `Bearer ${organizer.accessToken}`);
    expectSuccess(publishResponse, 200, 'Publish event');
    expect(publishResponse.body.data.status).toBe('PUBLISHED');

    const onSaleResponse = await request(app)
      .post(`/api/v1/events/${event.id}/status`)
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({ status: 'ON_SALE' });
    expectSuccess(onSaleResponse, 200, 'Move event on sale');
    expect(onSaleResponse.body.data.status).toBe('ON_SALE');

    const publicEventsResponse = await request(app)
      .get('/api/v1/events/public')
      .query({ search: 'V1 Smoke Event' });
    expectSuccess(publicEventsResponse, 200, 'List public events');
    expect(publicEventsResponse.body.data.events.some((item: { id: string }) => item.id === event.id)).toBe(true);

    const attendee = await registerUser(app, {
      email: 'v1-smoke-attendee@test.com',
      firstName: 'V1',
      lastName: 'Attendee',
    });

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${attendee.accessToken}`)
      .send({
        items: [
          { ticketTypeId: generalTicketResponse.body.data.id, quantity: 1 },
          { ticketTypeId: vipTicketResponse.body.data.id, quantity: 1 },
        ],
      });
    expectSuccess(orderResponse, 201, 'Create multi-ticket order');
    expect(orderResponse.body.data.status).toBe('PENDING');
    expect(Number(orderResponse.body.data.totalAmount)).toBe(85);

    const paymentIntentResponse = await request(app)
      .post('/api/v1/payments/create-intent')
      .set('Authorization', `Bearer ${attendee.accessToken}`)
      .send({ orderId: orderResponse.body.data.id });
    expectSuccess(paymentIntentResponse, 200, 'Create payment intent');
    expect(paymentIntentResponse.body.data.paymentIntentId).toContain(orderResponse.body.data.id);

    const { paymentService } = require('../../src/api/payments/service');
    paymentService.stripe.webhooks.constructEvent.mockReturnValue({
      id: `evt_v1_smoke_${orderResponse.body.data.id}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntentResponse.body.data.paymentIntentId,
          metadata: {
            orderId: orderResponse.body.data.id,
          },
        },
      },
    });

    const webhookResponse = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'v1-smoke-signature')
      .send(Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' })));
    expectSuccess(webhookResponse, 200, 'Process payment webhook');

    const paidOrder = await prisma.order.findUnique({
      where: { id: orderResponse.body.data.id },
      include: { tickets: true },
    });
    expect(paidOrder?.status).toBe('PAID');
    expect(paidOrder?.tickets).toHaveLength(2);

    const scannerResponse = await request(app)
      .post('/api/v1/scanners/register')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        name: 'Main Gate Scanner',
        organizationId: organization.id,
        eventId: event.id,
      });
    expectSuccess(scannerResponse, 201, 'Register scanner');
    const scannerApiKey = scannerResponse.body.data.apiKey;

    const scannerAuthResponse = await request(app)
      .post('/api/v1/scanners/auth')
      .send({ apiKey: scannerApiKey });
    expectSuccess(scannerAuthResponse, 200, 'Authenticate scanner');

    const syncResponse = await request(app)
      .get('/api/v1/scanners/sync')
      .set('Authorization', `Bearer ${scannerApiKey}`)
      .query({ eventId: event.id });
    expectSuccess(syncResponse, 200, 'Sync scanner tickets');
    expect(syncResponse.body.data.tickets).toHaveLength(2);

    const ticketToScan = paidOrder!.tickets[0];
    const scanResponse = await request(app)
      .post('/api/v1/scanners/scan')
      .set('Authorization', `Bearer ${scannerApiKey}`)
      .send({
        qrData: `TICKET:${ticketToScan.id}:${ticketToScan.barcode}:${event.id}`,
        scanType: 'ENTRY',
      });
    expectSuccess(scanResponse, 200, 'Scan paid ticket');
    expect(scanResponse.body.data.success).toBe(true);

    const analyticsResponse = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .query({ organizationId: organization.id });
    expectSuccess(analyticsResponse, 200, 'Load dashboard analytics');
    expect(analyticsResponse.body.data.sales.totalOrders).toBeGreaterThanOrEqual(1);

    const folderResponse = await request(app)
      .post('/api/v1/assets/folders')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        name: 'V1 Smoke Assets',
        eventId: event.id,
        category: 'smoke',
      });
    expectSuccess(folderResponse, 201, 'Create asset folder');

    const uploadResponse = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .field('folderId', folderResponse.body.folder.id)
      .attach('files', tinyPng, {
        filename: 'v1-smoke.png',
        contentType: 'image/png',
      });
    expectSuccess(uploadResponse, 201, 'Upload asset');
    expect(uploadResponse.body.assets).toHaveLength(1);

    const shareResponse = await request(app)
      .post(`/api/v1/assets/folders/${folderResponse.body.folder.id}/shares`)
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        recipientLabel: 'Smoke Reviewer',
        expiresInDays: 7,
      });
    expectSuccess(shareResponse, 201, 'Create asset share link');
    const shareUrl = shareResponse.body.share.shareUrl;
    const shareToken = shareUrl.split('/').pop();
    expect(shareToken).toBeTruthy();

    const sharedFolderResponse = await request(app).get(`/api/v1/assets/shares/${shareToken}`);
    expectSuccess(sharedFolderResponse, 200, 'Open shared asset folder');
    expect(sharedFolderResponse.body.assets).toHaveLength(1);

    const approvalResponse = await request(app)
      .post('/api/v1/approvals')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .field('eventId', event.id)
      .field('title', 'V1 Smoke Poster Approval')
      .field('description', 'Creative approval smoke item.')
      .field('deadline', new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString())
      .field(
        'reviewers',
        JSON.stringify([{ email: 'reviewer-v1-smoke@test.com', association: 'MANAGEMENT' }])
      )
      .attach('files', tinyPng, {
        filename: 'v1-approval.png',
        contentType: 'image/png',
      });
    expectSuccess(approvalResponse, 201, 'Create approval request');
    expect(approvalResponse.body.reviewers[0].reviewUrl).toContain('/review/');

    const reviewToken = approvalResponse.body.reviewers[0].reviewUrl.split('/').pop();
    const reviewResponse = await request(app).get(`/api/v1/review/${reviewToken}`);
    expectSuccess(reviewResponse, 200, 'Open external review link');

    const decisionResponse = await request(app)
      .post(`/api/v1/review/${reviewToken}/decisions`)
      .send({
        decision: 'APPROVED',
        note: 'Smoke approval accepted.',
        revisionId: reviewResponse.body.approval.latestRevision.id,
      });
    expectSuccess(decisionResponse, 200, 'Submit external approval decision');

    const refreshedApprovalResponse = await request(app)
      .get(`/api/v1/approvals/${approvalResponse.body.id}`)
      .set('Authorization', `Bearer ${organizer.accessToken}`);
    expectSuccess(refreshedApprovalResponse, 200, 'Refresh approval request');
    expect(refreshedApprovalResponse.body.status).toBe('APPROVED');
  });
});
