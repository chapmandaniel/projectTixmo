import { describe, expect, it } from 'vitest';
import { fromEventLocalInput } from '../lib/eventTime';
import { ticketSalesWindowInput, ticketSalesWindowIso } from '../lib/ticketSalesWindow';

const eventZone = 'America/St_Johns';
const browserZone = 'America/Los_Angeles';

describe('ticket sales window conversion', () => {
    it.each([
        ['NST', '2026-01-15T22:30:45.000Z', '2026-01-15T19:00'],
        ['NDT', '2026-07-15T21:30:45.123Z', '2026-07-15T19:00'],
    ])('round-trips a %s instant when the browser zone is not the event zone', (_label, stored, wall) => {
        expect(ticketSalesWindowInput(stored, eventZone)).toBe(wall);
        expect(ticketSalesWindowIso(wall, eventZone, stored)).toBe(stored);
        expect(ticketSalesWindowIso(wall, eventZone)).not.toBe(fromEventLocalInput(wall, browserZone));
    });

    it('leaves an unedited sales window exactly unchanged', () => {
        const start = '2026-01-15T22:30:45.000Z';
        const end = '2026-07-15T21:30:45.123Z';
        const fields = {
            salesStart: ticketSalesWindowInput(start, eventZone),
            salesEnd: ticketSalesWindowInput(end, eventZone),
        };
        expect(ticketSalesWindowIso(fields.salesStart, eventZone, start)).toBe(start);
        expect(ticketSalesWindowIso(fields.salesEnd, eventZone, end)).toBe(end);
        expect(fromEventLocalInput(fields.salesStart, browserZone)).not.toBe(start);
        expect(fromEventLocalInput(fields.salesEnd, browserZone)).not.toBe(end);
    });
});
