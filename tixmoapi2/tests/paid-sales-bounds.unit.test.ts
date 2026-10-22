import { paidSalesSource } from '../src/services/paid-sales-query';
test('normalizes bound parameters to UTC without wrapping indexed column or weakening filters', () => {
  const startDate = new Date('2026-11-01T04:00:00Z');
  const endDate = new Date('2026-11-01T05:00:00Z');
  const query = paidSalesSource({
    startDate,
    endDate,
    currency: 'CAD',
    organizationId: 'org',
    eventId: 'event',
  });
  expect(query.text).toMatch(/o.created_at >= \(\$\d+::timestamptz AT TIME ZONE 'UTC'\)/);
  expect(query.text).toMatch(/o.created_at <= \(\$\d+::timestamptz AT TIME ZONE 'UTC'\)/);
  expect(query.values).toEqual(['cad', startDate, endDate, 'event', 'org']);
  expect(query.text).toContain("o.status = 'PAID'");
  expect(query.text).toContain("t.inventory_state = 'SOLD'");
  expect(query.text).toContain('LEFT JOIN ticket_counts');
});
test('omitted bounds add no date predicates', () => {
  expect(paidSalesSource({}).text).not.toMatch(/created_at [<>]=/);
});
