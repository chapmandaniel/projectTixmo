import { EventService } from '../../../src/api/events/service';
import prisma from '../../../src/config/prisma';
import { receiptDisclosure } from '../../../src/utils/receipt';

jest.mock('../../../src/config/prisma', () => ({
  __esModule: true,
  default: { event: { findFirst: jest.fn() } },
}));

const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock('../../../src/config/redis', () => ({
  getRedisClient: jest.fn(() => ({ get: mockGet, set: mockSet, isOpen: true })),
}));

const eventFixture = () => ({
  id: 'event-fresh',
  name: 'Fresh Checkout Event',
  slug: 'fresh-checkout-event',
  status: 'ON_SALE',
  ticketTypes: [
    {
      id: 'ticket-fresh',
      name: 'General Admission',
      quantityAvailable: 20,
      _count: { tiers: 0 },
      tiers: [],
    },
  ],
});

const publicQuery = {
  where: {
    slug: 'fresh-checkout-event',
    deletedAt: null,
    status: { in: ['PUBLISHED', 'ON_SALE', 'SOLD_OUT'] },
  },
  include: {
    organization: { select: { id: true, name: true, slug: true } },
    venue: { select: { id: true, name: true, address: true } },
    ticketTypes: {
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: {
        _count: { select: { tiers: true } },
        tiers: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    },
  },
};

describe('EventService public event detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.event.findFirst as jest.Mock).mockReset();
  });

  it('reads successive ticket IDs and availability from the database without caching', async () => {
    const event = eventFixture();
    const nextEvent = {
      ...event,
      ticketTypes: [{ ...event.ticketTypes[0], id: 'ticket-recreated', quantityAvailable: 3 }],
    };
    (prisma.event.findFirst as jest.Mock)
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(nextEvent);
    const service = new EventService();

    const first = await service.getPublicEventBySlug(event.slug);
    const second = await service.getPublicEventBySlug(event.slug);

    expect(first).toEqual({
      ...event,
      receiptDisclosure: receiptDisclosure(),
      ticketTypes: [
        {
          id: 'ticket-fresh',
          name: 'General Admission',
          quantityAvailable: 20,
          tiers: [],
          hasConfiguredTiers: false,
        },
      ],
    });
    expect(second).toEqual({
      ...nextEvent,
      receiptDisclosure: receiptDisclosure(),
      ticketTypes: [
        {
          id: 'ticket-recreated',
          name: 'General Admission',
          quantityAvailable: 3,
          tiers: [],
          hasConfiguredTiers: false,
        },
      ],
    });
    expect(first?.ticketTypes[0]).not.toHaveProperty('_count');
    expect(second?.ticketTypes[0]).not.toHaveProperty('_count');
    expect(prisma.event.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.event.findFirst).toHaveBeenNthCalledWith(1, publicQuery);
    expect(prisma.event.findFirst).toHaveBeenNthCalledWith(2, publicQuery);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('exposes schedule presence without counts or inactive tier rows', async () => {
    const event = eventFixture();
    event.ticketTypes[0]._count.tiers = 2;
    // Prisma filters inactive rows but counts the complete configured schedule.
    (prisma.event.findFirst as jest.Mock).mockResolvedValue(event);

    const result = await new EventService().getPublicEventBySlug(event.slug);

    expect(result).toEqual({
      ...event,
      receiptDisclosure: receiptDisclosure(),
      ticketTypes: [
        {
          id: 'ticket-fresh',
          name: 'General Admission',
          quantityAvailable: 20,
          tiers: [],
          hasConfiguredTiers: true,
        },
      ],
    });
    expect(result?.ticketTypes[0]).not.toHaveProperty('_count');
    expect(prisma.event.findFirst).toHaveBeenCalledWith(publicQuery);
  });
});
