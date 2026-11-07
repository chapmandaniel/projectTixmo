import { describe, expect, it } from 'vitest';
import { isExternalTicketing, vendorEventAllows } from '../lib/ticketingMode';

describe('ticketing mode', () => {
    it('keeps vendor-sold events off for ticket operations and on for tasks', () => {
        const event = { ticketingMode: 'EXTERNAL' };
        expect(isExternalTicketing(event)).toBe(true);
        expect(vendorEventAllows(event, 'tasks')).toBe(true);
        expect(vendorEventAllows(event, 'event_page')).toBe(true);
        expect(vendorEventAllows(event, 'checkout')).toBe(false);
        expect(vendorEventAllows(event, 'orders')).toBe(false);
        expect(vendorEventAllows(event, 'attendees')).toBe(false);
        expect(vendorEventAllows(event, 'tickets')).toBe(false);
        expect(vendorEventAllows(event, 'scanners')).toBe(false);
        expect(vendorEventAllows(event, 'promo_codes')).toBe(false);
        expect(vendorEventAllows(event, 'waitlists')).toBe(false);
        expect(vendorEventAllows(event, 'security_monitoring')).toBe(false);
        expect(vendorEventAllows({ ticketingMode: 'TIXMO' }, 'checkout')).toBe(true);
    });
});
