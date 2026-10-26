import { beforeEach, expect, test, vi } from 'vitest';
// Real public service + frontend helper; only persistence and unused order import mocked.
vi.mock('../src/config/prisma', () => ({
  __esModule: true,
  default: { event: { findFirst: vi.fn() } },
}));
vi.mock('../src/api/orders/service', () => ({ orderService: {} }));
import prisma from '../src/config/prisma';
import { EventService } from '../src/api/events/service';
import { checkoutTicketState } from '../../tdash/src/lib/checkoutEligibility.js';
const now = Date.parse('2026-11-09T13:30:00Z');
let tiers: any[];
let query: any;
const event = {
  id: 'event',
  status: 'ON_SALE',
  deletedAt: null,
  startDatetime: new Date(now + 10000),
};
const ticket = {
  id: 'ga',
  status: 'ACTIVE',
  tierInventoryStatus: 'READY',
  price: '25',
  quantityAvailable: 8,
  maxPerOrder: 4,
};
const tier = (id: string, extra = {}) => ({
  id,
  sortOrder: 0,
  isActive: true,
  price: '12',
  quantityLimit: 2,
  quantitySold: 0,
  quantityHeld: 1,
  ...extra,
});
const load = async () =>
  JSON.parse(JSON.stringify(await new EventService().getPublicEventBySlug('synthetic')));
beforeEach(() => {
  vi.clearAllMocks();
  tiers = [];
  query = undefined;
  // Emulate Prisma's requested filters/order/count against deliberately reversed rows.
  (prisma.event.findFirst as vi.Mock).mockImplementation(async (args) => {
    query = args;
    const include = args.include.ticketTypes.include;
    let returned = tiers.filter((row) => !include.tiers.where?.isActive || row.isActive);
    const order = Array.isArray(include.tiers.orderBy)
      ? include.tiers.orderBy
      : [include.tiers.orderBy];
    returned = [...returned].sort((a, b) => {
      for (const rule of order) {
        const field = Object.keys(rule)[0];
        if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1;
      }
      return 0;
    });
    return {
      ...event,
      ticketTypes: [
        {
          ...ticket,
          tiers: returned,
          ...(include._count ? { _count: { tiers: tiers.length } } : {}),
        },
      ],
    };
  });
});
test('actual filtered-empty DTO blocks all-inactive configured schedule without exposing inactive rows', async () => {
  tiers = [tier('private-inactive-tier', { isActive: false, price: '99' })];
  const dto = await load();
  expect(dto.ticketTypes[0].tiers).toEqual([]);
  expect(checkoutTicketState(dto, dto.ticketTypes[0], now).max).toBe(0);
  expect(dto.ticketTypes[0].hasConfiguredTiers).toBe(true);
  expect(JSON.stringify(dto)).not.toContain('private-inactive-tier');
  expect(dto.ticketTypes[0]).not.toHaveProperty('_count');
});
test('genuinely unconfigured DTO keeps base price', async () => {
  const dto = await load();
  expect(dto.ticketTypes[0].hasConfiguredTiers).toBe(false);
  expect(checkoutTicketState(dto, dto.ticketTypes[0], now)).toEqual({ price: 25, max: 4 });
});
test('actual public query uses server sortOrder/id tie break for price and capacity', async () => {
  tiers = [tier('b', { price: '50', quantityLimit: 8, quantityHeld: 0 }), tier('a')];
  const dto = await load();
  expect(dto.ticketTypes[0].tiers.map((row: any) => row.id)).toEqual(['a', 'b']);
  expect(checkoutTicketState(dto, dto.ticketTypes[0], now)).toEqual({ price: 12, max: 1 });
  expect(query.include.ticketTypes.orderBy).toEqual([
    { sortOrder: 'asc' },
    { createdAt: 'asc' },
    { id: 'asc' },
  ]);
  expect(query.include.ticketTypes.include.tiers.orderBy).toEqual([
    { sortOrder: 'asc' },
    { id: 'asc' },
  ]);
});
test('exhausted first tied tier advances to the same next tier and capacity', async () => {
  tiers = [
    tier('b', { price: '50', quantityLimit: 3, quantityHeld: 1 }),
    tier('a', { quantitySold: 1 }),
  ];
  const dto = await load();
  expect(checkoutTicketState(dto, dto.ticketTypes[0], now)).toEqual({ price: 50, max: 2 });
});
test('missing public events stay null', async () => {
  (prisma.event.findFirst as vi.Mock).mockResolvedValueOnce(null);
  expect(await new EventService().getPublicEventBySlug('missing')).toBeNull();
});
