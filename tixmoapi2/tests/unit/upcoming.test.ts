import fs from 'node:fs';
import path from 'node:path';

const { isUpcoming, UPCOMING_SQL, ENDED_SQL } = require('../../prisma/lib/upcoming.cjs');

const now = new Date('2026-10-26T15:00:00Z');

describe('shared upcoming rule', () => {
  it('does not treat a no-end past-start event as upcoming', () => {
    expect(
      isUpcoming({ endDatetime: null, startDatetime: new Date('2026-10-01T00:00:00Z') }, now)
    ).toBe(false);
    expect(
      isUpcoming({ endDatetime: null, startDatetime: new Date('2026-11-01T00:00:00Z') }, now)
    ).toBe(true);
    expect(
      isUpcoming(
        {
          endDatetime: new Date('2026-10-01T00:00:00Z'),
          startDatetime: new Date('2026-09-01T00:00:00Z'),
        },
        now
      )
    ).toBe(false);
    expect(isUpcoming({ endDatetime: null, startDatetime: null }, now)).toBe(false);
    expect(UPCOMING_SQL).toBe('COALESCE(end_datetime, start_datetime) > now()');
    expect(ENDED_SQL).toBe('COALESCE(end_datetime, start_datetime) <= now()');
  });

  it('uses the same predicate in the reconcile CLI and the runbook SQL', () => {
    const cli = fs.readFileSync(
      path.join(__dirname, '../../prisma/reconcile-ticket-inventory.js'),
      'utf8'
    );
    const doc = fs.readFileSync(
      path.join(__dirname, '../../docs/ops/demo-data-inventory.md'),
      'utf8'
    );
    expect(cli).toContain("require('./lib/upcoming.cjs')");
    expect(cli).not.toContain('function isUpcoming');
    expect(doc).toContain(UPCOMING_SQL);
    expect(doc).toContain(ENDED_SQL);
    expect(doc).toContain('skipped: table payment_attempts absent');
    expect(doc).toContain('skipped: table payment_webhook_events absent');
    expect(doc).toContain('t.inventory_state::text');
    expect(doc).toContain('t.status::text');
    expect(doc).toContain('u.role::text');
    expect(doc).toContain('pa.currency::text');
  });
});
