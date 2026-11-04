import { describe, expect, it } from 'vitest';
import {
    comparePublicTicketTypes,
    earliestUpcomingTicketOnSale,
    eventAddress,
    eventArtwork,
    formatSaleCountdown,
    formatUpcomingOnSale,
    getEventSaleState,
    getPublicTicketOffer,
    initialTicketQuantities,
} from '../lib/publicEvent';

const now = Date.parse('2026-10-20T18:00:00Z');
const ticket = {
    id: 'ga',
    price: '35',
    quantityAvailable: 10,
    maxPerOrder: 4,
    status: 'ACTIVE',
};
const event = { status: 'ON_SALE', startDatetime: '2026-11-20T23:00:00Z' };

describe('public ticket selection', () => {
    it('selects the first current tier and clamps to its unheld inventory', () => {
        const offer = getPublicTicketOffer(
            {
                ...ticket,
                tiers: [
                    {
                        id: 'future',
                        isActive: true,
                        price: '90',
                        sortOrder: 0,
                        startsAt: '2026-12-01T00:00:00Z',
                    },
                    {
                        id: 'sold',
                        isActive: true,
                        price: '15',
                        sortOrder: 1,
                        quantityLimit: 10,
                        quantitySold: 8,
                        quantityHeld: 2,
                    },
                    {
                        id: 'current',
                        isActive: true,
                        price: '25',
                        sortOrder: 2,
                        quantityLimit: 5,
                        quantitySold: 2,
                        quantityHeld: 1,
                    },
                ],
            },
            now,
        );
        expect(offer).toMatchObject({ price: 25, max: 2, label: 'Available' });
    });

    it('does not fall back to base pricing when a configured schedule is closed', () => {
        expect(
            getPublicTicketOffer(
                {
                    ...ticket,
                    tiers: [
                        {
                            isActive: true,
                            price: '20',
                            endsAt: '2026-10-01T00:00:00Z',
                        },
                    ],
                },
                now,
            ).max,
        ).toBe(0);
        expect(
            getPublicTicketOffer(
                { ...ticket, tierInventoryStatus: 'REQUIRES_RECONCILIATION' },
                now,
            ).max,
        ).toBe(0);
    });

    it('shows sold-out tickets as sold out and not selectable', () => {
        expect(
            getPublicTicketOffer({ ...ticket, status: 'SOLD_OUT', quantityAvailable: 4 }, now),
        ).toMatchObject({ max: 0, label: 'Sold out' });
        expect(getPublicTicketOffer({ ...ticket, status: 'HIDDEN' }, now).max).toBe(0);
    });

    it('honors event and ticket sale boundaries', () => {
        expect(
            getEventSaleState(
                { ...event, salesStart: '2026-11-01T00:00:00Z' },
                now,
            ).label,
        ).toBe('On sale soon');
        expect(
            getEventSaleState(
                { ...event, salesEnd: '2026-10-20T18:00:00Z' },
                now,
            ).available,
        ).toBe(false);
        expect(
            getEventSaleState(
                { ...event, startDatetime: '2026-10-20T18:00:00Z' },
                now,
            ).available,
        ).toBe(false);
        expect(
            getPublicTicketOffer(
                { ...ticket, salesStart: '2026-11-01T00:00:00Z' },
                now,
            ).max,
        ).toBe(0);
        expect(
            getPublicTicketOffer(
                { ...ticket, salesEnd: '2026-10-20T18:00:00Z' },
                now,
            ).max,
        ).toBe(0);
    });

    it('treats URL quantities as untrusted and uses only current ticket IDs and limits', () => {
        expect(
            initialTicketQuantities([ticket], 'unknown:3,ga:999', now),
        ).toEqual({ ga: 4 });
        for (const invalid of ['ga:1.5', 'ga:-2', 'ga:Infinity', 'ga:nope'])
            expect(initialTicketQuantities([ticket], invalid, now)).toEqual({
                ga: 0,
            });
        expect(
            initialTicketQuantities(
                [{ ...ticket, quantityAvailable: 0 }],
                'ga:2',
                now,
            ),
        ).toEqual({ ga: 0 });
    });

    it('renders only supported artwork sources and human-readable addresses', () => {
        expect(eventArtwork({ images: { main: 'javascript:alert(1)' } })).toBe(
            '',
        );
        expect(
            eventArtwork({ images: { main: '//external.test/image.jpg' } }),
        ).toBe('');
        expect(eventArtwork({ images: { main: '/images/poster.jpg' } })).toBe(
            '/images/poster.jpg',
        );
        expect(
            eventAddress({
                address: {
                    line1: '123 Water St',
                    city: 'St. John’s',
                    province: 'NL',
                },
            }),
        ).toBe('123 Water St, St. John’s, NL');
    });
});

it('blocks a configured filtered-empty tier schedule without changing unconfigured base offers', () => {
    expect(getPublicTicketOffer({ ...ticket, hasConfiguredTiers: true, tiers: [] }, now)).toMatchObject({ max: 0, label: 'Currently unavailable' });
    expect(getPublicTicketOffer({ ...ticket, hasConfiguredTiers: false, tiers: [] }, now)).toMatchObject({ price: 35, max: 4, label: 'Available' });
    expect(initialTicketQuantities([{ ...ticket, hasConfiguredTiers: true, tiers: [] }], 'ga:2', now)).toEqual({ ga: 0 });
});
describe('public ticket type order', () => {
    const ticket = (id, sortOrder, createdAt) => ({ id, sortOrder, createdAt });

    it('uses sort order, then creation time, then id', () => {
        const rows = [
            ticket('id-z', 0, '2026-02-01T00:00:00.000Z'),
            ticket('id-a', 0, '2026-02-01T00:00:00.000Z'),
            ticket('id-m', 1, '2026-01-01T00:00:00.000Z'),
            ticket('id-b', 0, '2026-01-01T00:00:00.000Z'),
        ];
        expect(rows.slice().sort(comparePublicTicketTypes).map((row) => row.id)).toEqual([
            'id-b',
            'id-a',
            'id-z',
            'id-m',
        ]);
    });

    it('keeps API order when every ordering key ties', () => {
        const rows = [
            { id: 'same', sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', label: 'first' },
            { id: 'same', sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', label: 'second' },
        ];
        expect(rows.slice().sort(comparePublicTicketTypes).map((row) => row.label)).toEqual([
            'first',
            'second',
        ]);
    });

    it('does not reshuffle tied sort orders when only one creation time is present', () => {
        const rows = [
            { id: 'b', sortOrder: 0, label: 'first' },
            { id: 'a', sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', label: 'second' },
        ];
        expect(rows.slice().sort(comparePublicTicketTypes).map((row) => row.label)).toEqual([
            'first',
            'second',
        ]);
    });
});

describe('per-ticket onsale countdown', () => {
    const zone = { timezone: 'America/St_Johns' };

    it('uses the earliest future onsale and skips hidden, sold-out, and open tickets', () => {
        expect(
            earliestUpcomingTicketOnSale(
                [
                    { ...ticket, id: 'open', salesStart: '2026-10-01T00:00:00Z' },
                    { ...ticket, id: 'hidden', status: 'HIDDEN', salesStart: '2026-10-21T00:00:00Z' },
                    { ...ticket, id: 'sold', status: 'SOLD_OUT', quantityAvailable: 0, salesStart: '2026-10-21T00:00:00Z' },
                    { ...ticket, id: 'later', salesStart: '2026-11-05T22:30:00Z' },
                    { ...ticket, id: 'earliest', quantityAvailable: 0, salesStart: '2026-11-01T04:30:00Z' },
                ],
                now,
            ),
        ).toBe(Date.parse('2026-11-01T04:30:00Z'));
        expect(earliestUpcomingTicketOnSale([{ ...ticket, status: 'SOLD_OUT', salesStart: '2026-12-01T00:00:00Z' }], now)).toBeNull();
        expect(earliestUpcomingTicketOnSale([], now)).toBeNull();
    });

    it('formats Newfoundland onsale instants with the date-specific offset', () => {
        expect(formatUpcomingOnSale('2026-11-09T22:30:00Z', zone)).toBe('On sale Mon, Nov 9, 7:00 p.m. NST');
        expect(formatUpcomingOnSale('2026-10-31T22:30:00Z', zone)).toBe('On sale Sat, Oct 31, 8:00 p.m. NDT');
        // The repeated 1:00 a.m. hour: 04:00Z is still NDT, 04:30Z is the first NST instant.
        expect(formatUpcomingOnSale('2026-11-01T04:00:00.000Z', zone)).toBe('On sale Sun, Nov 1, 1:30 a.m. NDT');
        expect(formatUpcomingOnSale('2026-11-01T04:30:00.000Z', zone)).toBe('On sale Sun, Nov 1, 1:00 a.m. NST');
        expect(formatUpcomingOnSale('2026-03-08T05:29:00.000Z', zone)).toBe('On sale Sun, Mar 8, 1:59 a.m. NST');
        expect(formatUpcomingOnSale('2026-03-08T05:30:00.000Z', zone)).toBe('On sale Sun, Mar 8, 3:00 a.m. NDT');
    });

    it('counts real elapsed time across the Newfoundland fallback, not wall-clock labels', () => {
        const start = Date.parse('2026-11-01T03:00:00.000Z');
        const target = Date.parse('2026-11-01T05:30:00.000Z');
        expect(formatSaleCountdown(target, start)).toBe('in 2 hours 30 minutes');
        expect(formatSaleCountdown(start + 3_600_000, start)).toBe('in 1 hour');
        expect(formatSaleCountdown(start + 3_599_000, start)).toBe('in 59 minutes 59 seconds');
        expect(formatSaleCountdown(start + 86_400_000 * 2 + 3_600_000 + 60_000, start)).toBe('in 2 days 1 hour 1 minute');
        expect(formatSaleCountdown(start, start)).toBe('in 0 seconds');
    });
});

it.each(['PUBLISHED', 'ON_SALE'])('honors incoming sales pause for %s and preserves terminal lifecycle labels', status => {
    expect(getEventSaleState({ ...event, status, salesPaused: true }, now)).toEqual({ label: 'Sales paused', available: false });
    expect(getEventSaleState({ ...event, status: 'SOLD_OUT', salesPaused: true }, now).label).toBe('Sold out');
    expect(getEventSaleState({ ...event, status: 'CANCELLED', salesPaused: true }, now).label).toBe('Tickets unavailable');
    expect(getEventSaleState({ ...event, salesEnd: new Date(now).toISOString(), salesPaused: true }, now).label).toBe('Sales ended');
});
