// Only loaded later with explicit PM DB slot. No application module imports at setup time.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const artifact = __dirname;
const contextFile = path.join(artifact, 'context-' + process.pid + '.json');
function setContext(phase) {
  const state = expect.getState();
  const testPath = path.relative(path.resolve(artifact, '../../../../tixmoapi2'), state.testPath || '');
  fs.writeFileSync(contextFile, JSON.stringify({ testPath, testName: state.currentTestName || null, phase }), { mode: 0o600 });
}
setContext('suite-load');
let restore;
beforeEach(() => {
  setContext('test');
  if (!expect.getState().testPath.endsWith('/smoke/v1-market-smoke.test.ts')) return;
  // Test-file mocks have already registered by the time beforeEach executes.
  const { analyticsService } = require('../../../../tixmoapi2/src/api/analytics/service');
  const prisma = require('../../../../tixmoapi2/src/config/prisma').default;
  const { paidSalesSource } = require('../../../../tixmoapi2/src/services/paid-sales-query');
  const { Prisma } = require('../../../../tixmoapi2/node_modules/@prisma/client');
  const original = analyticsService.getDashboardSummary;
  restore = jest.spyOn(analyticsService, 'getDashboardSummary').mockImplementation(async function (organizationId) {
    const appBefore = new Date().toISOString();
    const result = await original.call(this, organizationId);
    const startDate = new Date(result.period.startDate), endDate = new Date(result.period.endDate);
    const rows = await prisma.order.findMany({ select: { id: true, status: true, paymentStatus: true, currency: true, createdAt: true, eventId: true, event: { select: { organizationId: true } } } });
    const clock = await prisma.$queryRaw`SELECT CURRENT_TIMESTAMP::text AS database_now, clock_timestamp()::text AS database_wall, current_setting('TimeZone') AS timezone`;
    const exactCount = await prisma.$queryRaw(Prisma.sql`${paidSalesSource({ organizationId, startDate, endDate, currency: 'cad' })} SELECT COUNT(*)::text AS count FROM scoped_orders`);
    const direct = await this.getSalesAnalytics({ organizationId, startDate, endDate, currency: 'cad' });
    const data = { appBefore, appAfter: new Date().toISOString(), period: result.period, organizationId, currency: 'cad', databaseClock: clock, dashboardTotalOrders: result.sales.totalOrders, directTotalOrders: direct.totalOrders, exactSqlCount: exactCount, orders: rows.map(row => ({ ...row, predicates: { paid: row.status === 'PAID', currency: row.currency === 'cad', organization: row.event.organizationId === organizationId, createdAtGteStart: row.createdAt >= startDate, createdAtLteEnd: row.createdAt <= endDate } })) };
    fs.writeFileSync(path.join(artifact, 'smoke-predicates.json'), JSON.stringify(data, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n', { mode: 0o600 });
    return result; // Original dashboard payload, assertion/date/org/currency filters unchanged.
  });
});
afterEach(() => { if (restore) { restore.mockRestore(); restore = undefined; } setContext('after-test'); });
afterAll(() => { fs.rmSync(contextFile, { force: true }); });
