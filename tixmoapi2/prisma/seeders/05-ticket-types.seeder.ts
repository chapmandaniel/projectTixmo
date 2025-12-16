import { PrismaClient, TicketTypeStatus, Event } from '@prisma/client';
import { seedLogger } from '../utils/seed-logger';
import { createTicketTypeData } from '../factories/ticket-type.factory';

export async function seedTicketTypes(prisma: PrismaClient, events: Event[]) {
  seedLogger.info('Seeding ticket types...');

  const ticketTypes = [];

  // Create 3-4 ticket types per event
  for (const event of events) {
    // Determine status based on event status
    let status: TicketTypeStatus = TicketTypeStatus.ACTIVE;
    if (event.status === 'SOLD_OUT') {
      status = TicketTypeStatus.SOLD_OUT;
    } else if (event.status === 'DRAFT' || event.status === 'CANCELLED') {
      status = TicketTypeStatus.HIDDEN;
    }

    // General Admission
    const ga = await prisma.ticketType.create({
      data: createTicketTypeData({
        eventId: event.id,
        name: 'General Admission',
        price: 50,
        quantity: 500,
        status,
      }),
    });
    ticketTypes.push(ga);

    // VIP
    const vip = await prisma.ticketType.create({
      data: createTicketTypeData({
        eventId: event.id,
        name: 'VIP',
        price: 150,
        quantity: 100,
        status,
      }),
    });
    ticketTypes.push(vip);

    // Early Bird (for some events)
    if (Math.random() > 0.5) {
      const earlyBird = await prisma.ticketType.create({
        data: createTicketTypeData({
          eventId: event.id,
          name: 'Early Bird',
          price: 35,
          quantity: 200,
          status: TicketTypeStatus.SOLD_OUT, // Early bird typically sells out
        }),
      });
      ticketTypes.push(earlyBird);
    }
  }

  seedLogger.success(`Created ${ticketTypes.length} ticket types`);
  seedLogger.info(`✓ Created ${ticketTypes.length} ticket types total`);
  return ticketTypes;
}
