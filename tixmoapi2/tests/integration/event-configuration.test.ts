import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';
import { saveEventConfiguration } from '../../src/api/events/configuration.service';
import { eventService } from '../../src/api/events/service';
import { orderService } from '../../src/api/orders/service';
import { generateAccessToken } from '../../src/utils/jwt';

describe('Atomic event configuration and lifecycle', () => {
  let org: any, venue: any, owner: any, token: string;
  beforeEach(async () => {
    await cleanupTestData();
    org = await prisma.organization.create({
      data: { name: 'Configuration fixture', slug: randomUUID(), type: 'PROMOTER' },
    });
    venue = await prisma.venue.create({
      data: {
        organizationId: org.id,
        name: 'Venue',
        capacity: 100,
        address: {},
        timezone: 'America/St_Johns',
      },
    });
    owner = await prisma.user.create({
      data: {
        organizationId: org.id,
        role: 'OWNER',
        email: 'configuration@test.com',
        firstName: 'Test',
        lastName: 'Owner',
        passwordHash: 'synthetic',
      },
    });
    token = generateAccessToken({ userId: owner.id, email: owner.email, role: owner.role });
  });
  afterAll(cleanupTestData);
  const input = (): any => ({
    event: {
      title: 'Atomic event',
      description: '',
      organizationId: org.id,
      venueId: venue.id,
      startDateTime: new Date(Date.now() + 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 90000000).toISOString(),
      timezone: 'America/St_Johns',
      capacity: 10,
      tags: ['fixture'],
    },
    ticketTypes: [
      {
        name: 'Admission',
        price: 10,
        quantity: 10,
        status: 'ACTIVE',
        tiers: [{ name: 'Early', price: 8, quantityLimit: 5, sortOrder: 0, isActive: true }],
      },
    ],
    publish: true,
  });

  it('publishes a complete configuration in one HTTP operation', async () => {
    const response = await request(app)
      .post('/api/v1/events/configuration')
      .set('Authorization', `Bearer ${token}`)
      .send(input());
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('PUBLISHED');
    const type = await prisma.ticketType.findFirstOrThrow({
      where: { eventId: response.body.data.id },
      include: { tiers: true },
    });
    expect(type.tiers).toHaveLength(1);
    expect(type.quantityAvailable).toBe(10);
    expect(response.body.data.tags).toEqual(['fixture']);
  });

  it('rolls back event, ticket and tier writes when a later configuration entry fails', async () => {
    const data = input();
    data.ticketTypes.push({
      name: 'Invalid',
      price: 10,
      quantity: 5,
      status: 'ACTIVE',
      tiers: [{ id: randomUUID(), name: 'Foreign tier', price: 8, isActive: true, sortOrder: 0 }],
    });
    await expect(saveEventConfiguration(data)).rejects.toThrow('does not belong');
    expect(await prisma.event.count()).toBe(0);
    expect(await prisma.ticketType.count()).toBe(0);
    expect(await prisma.ticketTier.count()).toBe(0);
  });

  it('preserves public event and stock state when an edit would remove an allocation', async () => {
    const data = input(),
      event = await saveEventConfiguration(data);
    const type = await prisma.ticketType.findFirstOrThrow({
      where: { eventId: event.id },
      include: { tiers: true },
    });
    await orderService.createOrder(owner.id, { items: [{ ticketTypeId: type.id, quantity: 2 }] });
    data.event.title = 'Must roll back';
    data.ticketTypes = [
      {
        id: type.id,
        name: 'Changed',
        price: 30,
        quantity: 1,
        status: 'ACTIVE',
        tiers: type.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          price: Number(t.price),
          sortOrder: 0,
          isActive: true,
        })),
      },
    ];
    await expect(saveEventConfiguration(data, event.id)).rejects.toThrow('Cannot reduce quantity');
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).name).toBe(
      'Atomic event'
    );
    expect((await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).name).toBe(
      'Admission'
    );
    data.ticketTypes = [];
    await expect(saveEventConfiguration(data, event.id)).rejects.toThrow(
      'Cannot remove an allocated'
    );
  });

  it('blocks generic status bypasses and requires configured tickets for publication', async () => {
    const data = input();
    data.publish = false;
    data.ticketTypes = [];
    const event = await saveEventConfiguration(data);
    await expect(eventService.updateEvent(event.id, { status: 'PUBLISHED' })).rejects.toThrow(
      'dedicated event status'
    );
    await expect(eventService.publishEvent(event.id)).rejects.toThrow('ticket configuration');
    await expect(eventService.transitionEventStatus(event.id, 'DELETED')).rejects.toThrow(
      'dedicated delete'
    );
    data.ticketTypes = input().ticketTypes;
    await saveEventConfiguration(data, event.id);
    await eventService.publishEvent(event.id);
    const type = await prisma.ticketType.findFirstOrThrow({ where: { eventId: event.id } });
    const order = await orderService.createOrder(owner.id, {
      items: [{ ticketTypeId: type.id, quantity: 2 }],
    });
    const cancelled = await request(app)
      .post(`/api/v1/events/${event.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'CANCELLED'
    );
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).quantityHeld
    ).toBe(0);
  });

  it('rejects invalid timezone and tier windows without retaining partial writes', async () => {
    const badZone = input();
    badZone.event.timezone = 'invalid/timezone';
    await expect(saveEventConfiguration(badZone)).rejects.toThrow('IANA');
    const dates = input();
    dates.ticketTypes[0].tiers[0].startsAt = '2027-01-02T00:00:00Z';
    dates.ticketTypes[0].tiers[0].endsAt = '2027-01-01T00:00:00Z';
    await expect(saveEventConfiguration(dates)).rejects.toThrow('Tier end time');
    expect(await prisma.event.count()).toBe(0);
  });
});
