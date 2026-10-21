import { describe, expect, it } from 'vitest';
import {
    festivalDayKey,
    festivalDays,
    festivalEvents,
    festivalPasses,
    passCoveredEvents,
} from '../lib/festivalProgram';
import { festivalPreview } from '../data/festivalPreview';

describe('festival program and pass coverage', () => {
    it('groups a late Friday show under Friday in the festival timezone, despite its Saturday UTC timestamp', () => {
        expect(festivalDayKey('2027-11-20T02:30:00Z', 'America/St_Johns')).toBe(
            '2027-11-19',
        );
        const days = festivalDays(festivalPreview);
        expect(days.map((day) => [day.key, day.events.length])).toEqual([
            ['2027-11-19', 2],
            ['2027-11-20', 3],
            ['2027-11-21', 1],
        ]);
        expect(days[0].events.map((event) => event.name)).toEqual([
            'Opening Night',
            'After Dark',
        ]);
    });

    it('does not expose drafts or deleted members and keeps unscheduled public events at the end', () => {
        const original = festivalPreview.events[0];
        const events = festivalEvents({
            events: [
                { ...original, id: 'draft', status: 'DRAFT' },
                { ...original, id: 'deleted', deletedAt: '2026-01-01' },
                { ...original, id: 'tba', startDatetime: null },
                original,
            ],
        });
        expect(events.map((event) => event.id)).toEqual([original.id, 'tba']);
        expect(
            festivalDays({ events, timezone: festivalPreview.timezone }).at(-1)
                .key,
        ).toBe('tba');
    });

    it('omits pass products when pass sales are disabled even if pass records exist', () => {
        expect(
            festivalPasses({ ...festivalPreview, passesEnabled: false }),
        ).toEqual([]);
        expect(
            festivalPasses({ ...festivalPreview, passesEnabled: undefined }),
        ).toEqual([]);
        expect(festivalPasses(festivalPreview)).toHaveLength(2);
    });

    it('uses explicit covered event IDs and never assumes every festival event is included', () => {
        const saturday = festivalPreview.passes[1];
        expect(
            passCoveredEvents(festivalPreview, saturday).map(
                (event) => event.id,
            ),
        ).toEqual(['afternoon-sessions', 'neon-nights-preview']);
        expect(
            passCoveredEvents(festivalPreview, { eventIds: ['unknown-event'] }),
        ).toEqual([]);
        expect(passCoveredEvents(festivalPreview, null)).toEqual([]);
    });
});
