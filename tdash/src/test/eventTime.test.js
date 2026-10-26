import { describe, expect, it } from 'vitest';
import { fromEventLocalInput, toEventLocalInput, formatEventDate, resolveEventTimeZone } from '../lib/eventTime';

describe('Event timezone inputs', () => {
    it('preserves an untouched Newfoundland timestamp including seconds', () => {
        const instant = '2026-10-04T21:30:15.000Z';
        const input = toEventLocalInput(instant, 'America/St_Johns');
        expect(input).toBe('2026-10-04T19:00');
        expect(fromEventLocalInput(input, 'America/St_Johns', instant)).toBe(instant);
        expect(fromEventLocalInput(input, 'America/St_Johns')).toBe('2026-10-04T21:30:00.000Z');
    });
    it('uses the event zone across DST and rejects missing or ambiguous new wall times', () => {
        expect(fromEventLocalInput('2026-01-10T19:00', 'America/St_Johns')).toBe('2026-01-10T22:30:00.000Z');
        expect(() => fromEventLocalInput('2026-03-08T02:30', 'America/St_Johns')).toThrow('does not exist');
        expect(() => fromEventLocalInput('2026-11-01T01:30', 'America/St_Johns')).toThrow('occurs twice');
        for (const instant of ['2026-11-01T04:00:00.000Z', '2026-11-01T05:00:00.000Z']) {
            expect(fromEventLocalInput(toEventLocalInput(instant, 'America/St_Johns'), 'America/St_Johns', instant)).toBe(instant);
        }
    });
    it('resolves Nov 9 using the date-specific standard offset, not the current offset', () => {
        expect(fromEventLocalInput('2026-11-09T12:00', 'America/St_Johns')).toBe('2026-11-09T15:30:00.000Z');
        expect(fromEventLocalInput('2026-10-21T12:00', 'America/St_Johns')).toBe('2026-10-21T14:30:00.000Z');
    });
    it('defaults a blank timezone to America/St_Johns and preserves an explicit one', () => {
        expect(resolveEventTimeZone(undefined)).toBe('America/St_Johns');
        expect(resolveEventTimeZone(null)).toBe('America/St_Johns');
        expect(resolveEventTimeZone('')).toBe('America/St_Johns');
        expect(resolveEventTimeZone('   ')).toBe('America/St_Johns');
        expect(resolveEventTimeZone('America/Halifax')).toBe('America/Halifax');
        expect(resolveEventTimeZone(' UTC ')).toBe('UTC');
    });
    it('formats the actual event zone and rejects invalid timezone names', () => {
        expect(formatEventDate('2026-10-04T21:30:00Z', 'America/Los_Angeles')).toMatch(/2:30|14:30/);
        expect(() => fromEventLocalInput('2026-02-30T19:00', 'America/St_Johns')).toThrow();
        expect(() => fromEventLocalInput('2026-10-04T19:00', 'invalid-zone')).toThrow('timezone');
    });
});
