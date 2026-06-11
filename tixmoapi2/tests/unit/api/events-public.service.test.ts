import { EventService } from '../../../src/api/events/service';
import prisma from '../../../src/config/prisma';

jest.mock('../../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findFirst: jest.fn(),
    },
  },
}));

describe('EventService public event detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads public event details from the database so checkout does not use stale ticket IDs', async () => {
    const event = {
      id: 'event-fresh',
      name: 'Fresh Checkout Event',
      slug: 'fresh-checkout-event',
      status: 'ON_SALE',
      ticketTypes: [
        {
          id: 'ticket-fresh',
          name: 'General Admission',
          quantityAvailable: 20,
          tiers: [],
        },
      ],
    };
    (prisma.event.findFirst as jest.Mock).mockResolvedValue(event);

    const eventService = new EventService();
    const result = await eventService.getPublicEventBySlug('fresh-checkout-event');

    expect(result).toBe(event);
    expect(prisma.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: 'fresh-checkout-event',
      }),
      include: expect.objectContaining({
        ticketTypes: expect.any(Object),
      }),
    }));
  });
});
