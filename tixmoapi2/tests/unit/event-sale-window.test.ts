import { eventSaleTiming } from '../../src/api/events/event-sale-window';

// Same boundary as prisma/lib/upcoming.cjs: COALESCE(end, start) <= now.
const { isUpcoming } = require('../../prisma/lib/upcoming.cjs');

const at = (iso: string) => new Date(iso);

describe('event sale timing', () => {
  const now = at('2026-11-05T01:00:00.000Z');

  test('a passed end instant is ended, including the exact boundary', () => {
    expect(
      eventSaleTiming(
        {
          startDatetime: at('2026-11-04T22:00:00.000Z'),
          endDatetime: at('2026-11-05T00:59:59.000Z'),
        },
        now
      )
    ).toEqual({ ended: true, undated: false });
    expect(
      eventSaleTiming(
        {
          startDatetime: at('2026-11-04T22:00:00.000Z'),
          endDatetime: now,
        },
        now
      )
    ).toEqual({ ended: true, undated: false });
  });

  test('no end instant and a passed start instant is ended', () => {
    expect(
      eventSaleTiming({ startDatetime: at('2026-11-05T00:59:59.000Z'), endDatetime: null }, now)
    ).toEqual({ ended: true, undated: false });
    expect(eventSaleTiming({ startDatetime: now, endDatetime: null }, now)).toEqual({
      ended: true,
      undated: false,
    });
  });

  test('a future dated event and an in-progress event stay open', () => {
    expect(
      eventSaleTiming(
        {
          startDatetime: at('2026-11-05T02:00:00.000Z'),
          endDatetime: at('2026-11-05T04:00:00.000Z'),
        },
        now
      )
    ).toEqual({ ended: false, undated: false });
    expect(
      eventSaleTiming(
        {
          startDatetime: at('2026-11-04T22:00:00.000Z'),
          endDatetime: at('2026-11-05T03:00:00.000Z'),
        },
        now
      )
    ).toEqual({ ended: false, undated: false });
    expect(
      eventSaleTiming({ startDatetime: at('2026-11-05T02:00:00.000Z'), endDatetime: null }, now)
    ).toEqual({ ended: false, undated: false });
  });

  test('no start instant is undated, unless the end instant has already passed', () => {
    expect(eventSaleTiming({ startDatetime: null, endDatetime: null }, now)).toEqual({
      ended: false,
      undated: true,
    });
    expect(
      eventSaleTiming({ startDatetime: null, endDatetime: at('2026-11-06T00:00:00.000Z') }, now)
    ).toEqual({ ended: false, undated: true });
    expect(
      eventSaleTiming({ startDatetime: null, endDatetime: at('2026-11-04T00:00:00.000Z') }, now)
    ).toEqual({ ended: true, undated: true });
  });

  test('compares instants, not the UTC calendar date or a local wall-clock label', () => {
    // 2026-11-05T02:30:00Z is 23:00 NST on Nov 4. Server now is already Nov 5 UTC
    // and still Nov 4 in St. John's, and the end instant has not passed.
    const stJohnsEvening = at('2026-11-05T01:00:00.000Z');
    expect(stJohnsEvening.toISOString().slice(0, 10)).toBe('2026-11-05');
    expect(
      eventSaleTiming(
        {
          startDatetime: at('2026-11-04T22:30:00.000Z'),
          endDatetime: at('2026-11-05T02:30:00.000Z'),
        },
        stJohnsEvening
      )
    ).toEqual({ ended: false, undated: false });

    // Newfoundland falls back at 02:00 NDT (04:30Z) on 2026-11-01. 01:30 occurs
    // twice. The first 01:30 is 04:00Z; 04:30Z is 01:00 NST, which looks earlier
    // on a wall clock but is after that stored end instant.
    const firstHalfPastOne = at('2026-11-01T04:00:00.000Z');
    const afterFallback = at('2026-11-01T04:30:00.000Z');
    expect(
      eventSaleTiming(
        { startDatetime: at('2026-11-01T02:00:00.000Z'), endDatetime: firstHalfPastOne },
        afterFallback
      )
    ).toEqual({ ended: true, undated: false });
    expect(
      eventSaleTiming(
        { startDatetime: at('2026-11-01T02:00:00.000Z'), endDatetime: firstHalfPastOne },
        new Date(firstHalfPastOne.getTime() - 1)
      )
    ).toEqual({ ended: false, undated: false });
  });

  test('uses the same end-or-start boundary as the shared upcoming rule', () => {
    const samples = [
      {
        startDatetime: at('2026-11-04T22:00:00.000Z'),
        endDatetime: at('2026-11-05T00:00:00.000Z'),
      },
      {
        startDatetime: at('2026-11-05T02:00:00.000Z'),
        endDatetime: at('2026-11-05T04:00:00.000Z'),
      },
      { startDatetime: now, endDatetime: null },
      { startDatetime: at('2026-11-05T02:00:00.000Z'), endDatetime: null },
      { startDatetime: null, endDatetime: null },
      { startDatetime: null, endDatetime: at('2026-11-04T00:00:00.000Z') },
      { startDatetime: null, endDatetime: at('2026-11-06T00:00:00.000Z') },
    ];
    for (const sample of samples) {
      const timing = eventSaleTiming(sample, now);
      const boundary = sample.endDatetime ?? sample.startDatetime;
      expect(timing.ended).toBe(boundary !== null && !isUpcoming(sample, now));
      expect(timing.undated).toBe(sample.startDatetime === null);
    }
  });

  test('accepts ISO strings and ignores an unusable start', () => {
    expect(
      eventSaleTiming(
        {
          startDatetime: '2026-11-05T02:00:00.000Z',
          endDatetime: '2026-11-05T04:00:00.000Z',
        },
        now
      )
    ).toEqual({ ended: false, undated: false });
    expect(eventSaleTiming({ startDatetime: 'not-a-date', endDatetime: null }, now)).toEqual({
      ended: false,
      undated: true,
    });
  });
});
