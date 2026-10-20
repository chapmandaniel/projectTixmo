# Task 123: bookkeeping refund transition guard

Base: `ba2d92d7c695a9bc4e5df46438a07032148370d1`.
Branch: `tixmo/task-123-double-refund-fix`.

The existing Prisma transaction now conditionally claims the actor-scoped PAID
order with its observed payment status before reading eligible tickets or
mutating inventory. Exactly one conditional winner can release sold inventory.
A zero-count claim returns the existing PAID-only 400. Sold inventory decrements
require sufficient quantity; failure rolls back claim and ticket updates.
Response remains a scalar Order; payment status is untouched. VALID and
TRANSFERRED tickets are cancelled; USED tickets remain unchanged. No provider
refund, migration, configuration, dependency or financial operation is added.

## Actual author verification

Approved task57 native binaries and inspected `/tmp/task121-runtime.sh` were
used with only a fresh task123 disk-backed mktemp path and local commands;
UID/PID/executable/datadir/direct-child/readiness/listener/target guards and
bounded exact cleanup were preserved. Existing installed dependencies reused.

- Baseline `bash /tmp/task123-baseline.sh`: exit1; refund 2 RED and
  confirm/cancel 7 GREEN. `/tmp/task123-baseline.log`.
- Fixed `bash /tmp/task123-runtime.sh`: exit0; 3 suites, 13 tests GREEN.
  `/tmp/task123-fixed.log`. Runs existing normal/reverse real-DB refund,
  confirm and cancellation schedules, plus rollback, stale status/payment,
  response/eligibility and repeat-request checks. Both refund schedules produce
  `[6,2,2]`, one success/one400, REFUNDED/CANCELLED, payment unchanged; full
  unrelated distinct-buyer paid and pending order/ticket snapshots unchanged.
- `npm --prefix tixmoapi2 run build`: exit0 (`/tmp/task123-build.log`).
- Initial tenant-only attempt accidentally included `tests/security/tenant_scope.test.ts`
  (integration) with DB setup disabled in a temporary Jest config. Tenant unit
  tests passed30; security tests failed3 because DATABASE_URL was missing. No
  inherited URL or unknown DB was contacted. Log `/tmp/task123-unit.log`.
- Bounded correction: `bash /tmp/task123-final-runtime.sh`, same guarded fresh
  runtime, runs the three race suites plus `tests/orders-tenant.unit.test.ts`
  and `tests/security/tenant_scope.test.ts` under normal project Jest setup.
  Exit1: four focused suites passed43 tests; security suite failed3 during
  auth/register setup (500), with JWT/session fixture variables missing.
  No claim of broader security-suite acceptance; no further retry. Log
  `/tmp/task123-final.log`. Focused tenant service tests include conditional
  refund claim organization fences and organizationless ADMIN behavior.
- `git diff --check`: exit0.

Runtime cleanup: baseline PG869250/Redis869263, ports27295/52085;
fixed PG870242/Redis870255, ports36828/49906. Both harness cleanups exit0;
post-run `ps` finds none of those PIDs, `ss` finds no listeners on those ports.
Final correction PG871759/Redis871772, ports34523/48299 also stopped;
`ps` reports no exact PIDs and `ss` no listeners. No runtime is left active; fresh data directories/logs retained for inspection.

Limitations: native PG18.6/Redis8.0.5 are not CI PG14/Redis7 parity evidence;
Redis is globally mocked by the existing integration setup. Focused checks
are not a full API gate, provider refund evidence, deployment or launch approval.
Independent QA and lead must review the exact author commit before PM closure.
