import { describe, expect, it } from 'vitest';
import {
    eventAddress,
    eventArtwork,
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
