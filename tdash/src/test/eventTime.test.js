import { describe, expect, it, vi } from 'vitest';
import { fromEventLocalInput, toEventLocalInput, formatEventDate, eventZoneAbbreviation, resolveEventTimeZone } from '../lib/eventTime';

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
        expect(formatEventDate('2026-11-09T22:30:00Z', 'America/St_Johns', { weekday: undefined, month: undefined, day: undefined, timeZoneName: 'short' })).toBe('7:00 p.m. NST');
        expect(formatEventDate('2026-10-31T22:30:00Z', 'America/St_Johns', { weekday: undefined, month: undefined, day: undefined, timeZoneName: 'short' })).toBe('8:00 p.m. NDT');
        expect(formatEventDate('2026-11-09T22:30:00Z', 'America/St_Johns', { timeZoneName: 'short' })).toBe('Mon, Nov 9, 7:00 p.m. NST');
        expect(eventZoneAbbreviation('2026-10-31T22:30:00Z', 'America/St_Johns')).toBe('NDT');
        expect(eventZoneAbbreviation('2026-11-09T22:30:00Z', 'America/St_Johns')).toBe('NST');
        expect(() => fromEventLocalInput('2026-02-30T19:00', 'America/St_Johns')).toThrow();
        expect(() => fromEventLocalInput('2026-10-04T19:00', 'invalid-zone')).toThrow('timezone');
    });
    it('uses the daylight abbreviation for a summer date and the standard abbreviation for a winter date', () => {
        expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'America/St_Johns')).toBe('NDT');
        expect(eventZoneAbbreviation('2026-01-15T18:00:00Z', 'America/St_Johns')).toBe('NST');
        expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'America/Halifax')).toBe('ADT');
        expect(eventZoneAbbreviation('2026-01-15T18:00:00Z', 'America/Toronto')).toBe('EST');
        expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'America/Vancouver')).toBe('PDT');
        expect(eventZoneAbbreviation('2026-01-15T18:00:00Z', 'America/Vancouver')).toBe('PST');
        expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'America/Whitehorse')).toBe('MST');
        expect(eventZoneAbbreviation('2026-01-15T18:00:00Z', 'America/Dawson')).toBe('MST');
        expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'Pacific/Marquesas')).toBe('UTC-9:30');
        expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'Asia/Kathmandu')).toBe('UTC+5:45');
    });
    it('maps GMT-style Newfoundland output to NDT in summer and NST in winter', () => {
        const Original = Intl.DateTimeFormat;
        vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function mockZoneName(locale, options) {
            const format = new Original(locale, options);
            const kind = options?.timeZoneName;
            if (kind !== 'short' && kind !== 'longOffset') return format;
            return {
                format: (...args) => format.format(...args),
                formatToParts(date) {
                    const winter = date.getUTCMonth() === 0;
                    const zone = options.timeZone;
                    const offset = zone === 'America/St_Johns'
                        ? (winter ? '-03:30' : '-02:30')
                        : zone === 'America/Halifax'
                            ? (winter ? '-04:00' : '-03:00')
                            : '-09:30';
                    const [, sign, hours, minutes] = offset.match(/([+-])(\d{2}):(\d{2})/);
                    const value = kind === 'short'
                        ? `GMT${sign}${Number(hours)}${minutes === '00' ? '' : `:${minutes}`}`
                        : `GMT${offset}`;
                    return [{ type: 'timeZoneName', value }];
                },
            };
        });
        try {
            expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'America/St_Johns')).toBe('NDT');
            expect(eventZoneAbbreviation('2026-01-15T18:00:00Z', 'America/St_Johns')).toBe('NST');
            expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'America/Halifax')).toBe('ADT');
            expect(eventZoneAbbreviation('2026-01-15T18:00:00Z', 'America/Halifax')).toBe('AST');
            expect(eventZoneAbbreviation('2026-07-15T18:00:00Z', 'Pacific/Kiritimati')).toBe('UTC-9:30');
        } finally {
            vi.restoreAllMocks();
        }
    });
});
