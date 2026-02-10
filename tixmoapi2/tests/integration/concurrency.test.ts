import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';

describe('Concurrency Tests', () => {
  let authToken: string;
  let organizationId: string;
  let venueId: string;
  let eventId: string;
  let ticketTypeId: string;
  const TOTAL_TICKETS = 20;

  beforeAll(async () => {
    // Clean up database
    await cleanupTestData();

    // Create test user (customer)
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      email: 'concurrency@example.com',
      password: 'Test123!',
      firstName: 'Concurrency',
      lastName: 'Test',
      role: 'CUSTOMER',
    });

    authToken = registerRes.body.data.accessToken;

    // Create promoter user to setup event
    const promoterRes = await request(app).post('/api/v1/auth/register').send({
      email: 'promoter@example.com',
      password: 'Test123!',
      firstName: 'Promoter',
      lastName: 'User',
      role: 'PROMOTER'
    });
    const promoterToken = promoterRes.body.data.accessToken;

    // Create organization
    const orgRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${promoterToken}`)
      .send({
        name: 'Concurrency Org',
        slug: 'concurrency-org',
        type: 'PROMOTER',
      });

    organizationId = orgRes.body.data.id;

    // Create venue
    const venueRes = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${promoterToken}`)
      .send({
        organizationId,
        name: 'Concurrency Venue',
        address: {
          street: '123 St',
          city: 'City',
          state: 'ST',
          country: 'US',
          postalCode: '12345'
        },
        capacity: 1000,
      });

    venueId = venueRes.body.data.id;

    // Create event
    const eventRes = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${promoterToken}`)
      .send({
        organizationId,
        venueId,
        title: 'Concurrency Event',
        startDateTime: new Date(Date.now() + 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 172800000).toISOString(),
        status: 'DRAFT',
        capacity: 1000,
      });

    eventId = eventRes.body.data.id;

    // Publish event
    await request(app)
      .post(`/api/v1/events/${eventId}/publish`)
      .set('Authorization', `Bearer ${promoterToken}`);

    // Create ticket type with limited quantity
    const ticketTypeRes = await request(app)
      .post('/api/v1/ticket-types')
      .set('Authorization', `Bearer ${promoterToken}`)
      .send({
        eventId,
        name: 'Limited Tickets',
        price: 10.0,
        quantity: TOTAL_TICKETS,
        maxPerOrder: 1,
      });

    ticketTypeId = ticketTypeRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should handle concurrent order creation correctly', async () => {
    // Attempt to buy more tickets than available concurrently
    const REQUEST_COUNT = 30; // 30 requests for 20 tickets
    const requests = [];

    // All requests use the same user token, which is realistic for concurrent users if we used different tokens,
    // but here we just want to test API concurrency. Using same user is fine, just means one user makes many orders.
    // If there's per-user rate limiting or max per user logic (orders per user?), it might trigger.
    // The ticket type has maxPerOrder=1. It doesn't seem to have maxPerUser (unless logic exists).

    // To be safer and simulate real load better, let's create separate users if possible.
    // But creating 30 users is slow.
    // Let's assume using same user is fine for checking inventory race conditions.

    for (let i = 0; i < REQUEST_COUNT; i++) {
      requests.push(
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            items: [{ ticketTypeId, quantity: 1 }],
          })
      );
    }

    const responses = await Promise.all(requests);

    const successCount = responses.filter((res) => res.status === 201).length;
    const failCount = responses.filter((res) => res.status === 400).length;
    const conflictCount = responses.filter((res) => res.status === 409).length; // System busy


    console.log(`Success: ${successCount}, Fail: ${failCount}, Conflict: ${conflictCount}`);

    // Check that we didn't oversell
    expect(successCount).toBeLessThanOrEqual(TOTAL_TICKETS);

    // We expect exactly TOTAL_TICKETS to be sold because we have more requests than tickets
    expect(successCount).toBe(TOTAL_TICKETS);

    // Check that remaining failed with "Not enough tickets" (400) not "System busy" (409)
    // Since we removed the lock, we expect 0 conflicts.
    expect(conflictCount).toBe(0);
    expect(failCount).toBe(REQUEST_COUNT - TOTAL_TICKETS);

    // Verify database state
    const ticketType = await prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
    });

    expect(ticketType?.quantityAvailable).toBe(0);
    expect(ticketType?.quantityHeld).toBe(TOTAL_TICKETS);
  });
});
