import { describe, expect, it } from 'vitest';
import { attendeesToCsv, attendeeStatusBadges, canCheckIn, orderStateLabel, ticketMatches, ticketStatusLabel } from '../lib/attendees';

const openEvent = {
    status: 'ON_SALE',
    startDatetime: '2020-01-01T00:00:00.000Z',
    endDatetime: '2099-01-01T00:00:00.000Z',
};
const ticket = {
    user: { firstName: '=Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    ticketType: { name: 'General' },
    order: { orderNumber: 'ORD-1', status: 'PAID', refundStatus: 'NONE' },
    event: openEvent,
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
        expect(csv.startsWith('"Guest","Email","Ticket type","Status","Order state","Order"')).toBe(true);
        expect(csv).toContain('"\'=Ada Lovelace"');
        expect(csv).toContain('"ada@example.com"');
        expect(csv).toContain('"Confirmed"');
        expect(csv).toContain('"ORD-1"');
        expect(csv).not.toContain('Barcode');
        expect(csv).not.toContain('TIX-1');
        expect(csv).not.toContain('VALID');
        expect(csv.split('\r\n')).toHaveLength(2);
    });

    it('labels dispute and refund state and leaves the barcode out of the export', () => {
        const disputed = { ...ticket, status: 'VALID', order: { orderNumber: 'ORD-DISPUTE', status: 'PAID', refundStatus: 'DISPUTED' } };
        const closed = { ...ticket, status: 'CANCELLED', order: { orderNumber: 'ORD-CLOSED', status: 'PAID', refundStatus: 'DISPUTE_LOST' } };
        const refunded = { ...ticket, status: 'CANCELLED', order: { orderNumber: 'ORD-REFUND', status: 'REFUNDED', refundStatus: 'SUCCEEDED' } };
        const voided = { ...ticket, status: 'VOID_DISPUTED', order: { orderNumber: 'ORD-VOID', refundStatus: 'NONE' } };
        const csv = attendeesToCsv([disputed, closed, refunded, voided]);
        expect(orderStateLabel(disputed)).toBe('Disputed');
        expect(orderStateLabel(closed)).toBe('Dispute Lost');
        expect(orderStateLabel(refunded)).toBe('Refunded');
        expect(ticketStatusLabel('VOID_DISPUTED')).toBe('Void Disputed');
        expect(csv).toContain('"Disputed"');
        expect(csv).toContain('"Dispute Lost"');
        expect(csv).toContain('"Refunded"');
        expect(csv).toContain('"Void Disputed"');
        expect(csv).not.toContain('DISPUTED');
        expect(csv).not.toContain('DISPUTE_LOST');
        expect(csv).not.toContain('VOID_DISPUTED');
        expect(csv).not.toContain('SUCCEEDED');
        expect(csv).not.toContain('Barcode');
        expect(csv).not.toContain('TIX-1');
        expect(canCheckIn(ticket)).toBe(true);
        expect(canCheckIn({ ...ticket, order: { status: 'PAID', refundStatus: 'NONE' } })).toBe(true);
        expect(canCheckIn({ ...ticket, order: { status: 'PAID', refundStatus: 'FAILED' } })).toBe(true);
        const unpaidCancelled = { ...ticket, status: 'CANCELLED', order: { orderNumber: 'ORD-CANCEL', status: 'CANCELLED', refundStatus: 'NONE' } };
        expect(attendeeStatusBadges(unpaidCancelled)).toEqual(['Cancelled']);
        for (const blocked of [
            disputed,
            closed,
            refunded,
            voided,
            unpaidCancelled,
            { ...ticket, order: { status: 'REFUNDED', refundStatus: 'NONE' } },
            { ...ticket, order: { status: 'PAID', refundStatus: 'PROCESSING' } },
            { ...ticket, order: { status: 'PENDING', refundStatus: 'NONE' } },
            { ...ticket, status: 'USED' },
            { ...ticket, event: { ...openEvent, status: 'DRAFT' } },
            { ...ticket, event: { ...openEvent, deletedAt: '2026-01-01T00:00:00.000Z' } },
            { ...ticket, event: { ...openEvent, startDatetime: '2099-06-01T00:00:00.000Z' } },
            { ...ticket, event: { ...openEvent, endDatetime: '2020-01-02T00:00:00.000Z' } },
        ]) {
            expect(canCheckIn(blocked)).toBe(false);
        }
    });
});
