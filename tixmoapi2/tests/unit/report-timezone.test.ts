import { offlineAdmissionTime } from '../../src/api/scanners/offline-time';
import {
  effectiveEventCapacity,
  firstValidZone,
  organizationTimeZone,
  sharedTimeZone,
  withZoneDesignator,
} from '../../src/api/reports/time-zone';
import { receiptSellerName } from '../../src/utils/receiptSeller';

describe('receipt seller line', () => {
  it('defaults to Tixmo Ltd. and names the event organization', () => {
    expect(receiptSellerName({})).toBe('Tixmo Ltd.');
    expect(
      receiptSellerName({
        configuredSellerName:
          'Tixmo Ltd., as ticketing agent for Quincy Enterprises Ltd. (Mighty Quinton Concerts), the event organizer',
        organizationName: 'Tixmo QA Staging',
      })
    ).toBe('Tixmo Ltd., as ticketing agent for Tixmo QA Staging');
    expect(
      receiptSellerName({
        configuredSellerName: 'Quincy Enterprises Ltd. (Mighty Quinton Concerts)',
        organizationName: 'Tixmo QA Staging',
      })
    ).toBe('Tixmo Ltd., as ticketing agent for Tixmo QA Staging');
    expect(
      receiptSellerName({
        configuredSellerName: 'Tixmo Ltd.',
        organizationName: 'Tixmo QA Staging',
      })
    ).toBe('Tixmo Ltd., as ticketing agent for Tixmo QA Staging');
  });
});

describe('report capacity and timezone', () => {
  it('prefers the event capacity over ticket quantities and the venue', () => {
    expect(effectiveEventCapacity(50, [80, 100])).toBe(50);
    expect(effectiveEventCapacity(null, [30, 20])).toBe(50);
    expect(effectiveEventCapacity(0, [])).toBe(0);
  });

  it("labels a St. John's hour with the half-hour offset", () => {
    expect(withZoneDesignator('2026-10-01T23:00:00.000', 'America/St_Johns')).toBe(
      '2026-10-01T23:00:00.000-02:30'
    );
    expect(withZoneDesignator('2026-10-02T04:00:00.000', 'UTC')).toBe('2026-10-02T04:00:00.000Z');
    expect(firstValidZone('Not/A Zone', 'America/St_Johns')).toBe('America/St_Johns');
    expect(organizationTimeZone({ timezone: 'Europe/London' })).toBe('Europe/London');
    expect(organizationTimeZone({ timezone: 'drop table' })).toBeNull();
    expect(sharedTimeZone(['America/St_Johns', ' America/St_Johns '])).toBe('America/St_Johns');
    expect(sharedTimeZone(['America/St_Johns', 'Europe/London'])).toBeNull();
  });
});

describe('offline admission time', () => {
  const now = new Date('2026-10-02T18:00:00.000Z');

  it('keeps a plausible device time and falls back when the stamp is unusable', () => {
    expect(offlineAdmissionTime('not-a-time', now)).toBeNull();
    expect(offlineAdmissionTime('2026-10-02T17:00:00.000Z', now)?.toISOString()).toBe(
      '2026-10-02T17:00:00.000Z'
    );
    expect(offlineAdmissionTime('2026-10-03T18:00:00.000Z', now)?.toISOString()).toBe(
      now.toISOString()
    );
    expect(offlineAdmissionTime('2001-01-01T00:00:00.000Z', now)?.toISOString()).toBe(
      now.toISOString()
    );
  });
});
