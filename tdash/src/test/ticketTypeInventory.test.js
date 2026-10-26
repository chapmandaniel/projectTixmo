import { describe, expect, it } from 'vitest';
import { presentTicketType, ticketSoldCount, ticketSoldPercent, ticketTotalCount } from '../lib/ticketTypeInventory';

describe('ticket type inventory fields', () => {
    it('reads quantitySold and quantityTotal ahead of the old sold and quantity names', () => {
        const ticket = { quantitySold: 30, sold: 1, quantityTotal: 100, quantity: 2, quantityAvailable: 70 };
        expect(ticketSoldCount(ticket)).toBe(30);
        expect(ticketTotalCount(ticket)).toBe(100);
        expect(presentTicketType(ticket)).toMatchObject({ sold: 30, quantity: 100, quantitySold: 30 });
        expect(ticketSoldPercent(ticket)).toBe(30);
    });

    it('keeps a zero sold count and a missing total from becoming a blank or unbounded bar', () => {
        expect(ticketSoldCount({ quantitySold: 0, quantityTotal: 80 })).toBe(0);
        expect(ticketSoldPercent({ quantitySold: 4 })).toBe(0);
        expect(ticketSoldPercent({ quantitySold: 150, quantityTotal: 100 })).toBe(100);
        expect(ticketSoldCount({ sold: 9 })).toBe(9);
        expect(ticketTotalCount({ quantity: 12 })).toBe(12);
    });
});
