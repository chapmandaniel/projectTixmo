import { describe, expect, it } from 'vitest';
import { attendeesToCsv, ticketMatches } from '../lib/attendees';

const ticket = {
    user: { firstName: '=Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    ticketType: { name: 'General' },
    order: { orderNumber: 'ORD-1' },
    barcode: 'TIX-1',
    status: 'VALID',
};

describe('attendee search and export', () => {
    it('matches guest, email, order, and ticket type text that the list actually contains', () => {
        expect(ticketMatches(ticket, 'ada lovelace')).toBe(true);
        expect(ticketMatches(ticket, 'ADA@example.com')).toBe(true);
        expect(ticketMatches(ticket, 'ord-1')).toBe(true);
        expect(ticketMatches(ticket, 'general')).toBe(true);
        expect(ticketMatches({ ...ticket, user: undefined }, 'ada')).toBe(false);
        expect(ticketMatches({ ...ticket, user: undefined }, 'ORD-1')).toBe(true);
        expect(ticketMatches(ticket, 'missing person')).toBe(false);
    });

    it('exports attendee values as text and escapes spreadsheet formulas', () => {
        const csv = attendeesToCsv([ticket]);
        expect(csv).toContain('"\'=Ada Lovelace"');
        expect(csv).toContain('"ada@example.com"');
        expect(csv).toContain('"ORD-1"');
        expect(csv.split('\r\n')).toHaveLength(2);
    });
});
