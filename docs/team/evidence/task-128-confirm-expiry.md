# Task128: confirmation versus actual expiry job

2026-10-20. Test-only child of68; branch `tixmo/task-128-confirm-expiry`,
base exactly `4dfb4c962092193450617e6ba1fe7f19d1d988d7`.
Existing task126 real-Prisma harness and977848b plan reused; no dependencies added.

## Observed contract and scope

`src/jobs/order-expiry.job.ts` privately selects up to50 expired PENDING orders,
then invokes cancellation, catching/logging each error. Tests capture the actual
registered interval callback (without running a scheduler or mocking DB results),
stop the registration immediately, invoke it and gate its real candidate query.
The expired target is selected; the distinct-buyer future-expiry order is not.
Both actual PENDING reads then complete before controlled commits. Matrix covers
both winners and natural/reversed read completion. Every case checks exact
available/held/sold, nonnegative conservation, full unrelated order/ticket
snapshot, unchanged total ticket cardinality and target ticket snapshots.

Observed confirmation winner: PAID/SUCCEEDED, VALID tickets, counters[6,2,2].
Both promises fulfill because the job swallows/logs the stale cancellation400
(`Cannot cancel order that has changed`). Confirmation response retains tickets,
event and user. Expiry winner: CANCELLED/PENDING, CANCELLED tickets,[8,2,0];
job fulfills, confirmation rejects400 (`Cannot confirm order that is no longer
pending`). No blanket job rejection assumption is made.

This is arbitration safety, NOT paid-after-expiry policy implementation acceptance.
Confirmation currently accepts a still-PENDING order whose timestamp has passed;
this test records that behavior, does not prescribe precedence or authorize late
fulfillment. Decision73 remains conservative explicit manual reconciliation,
no automatic financial refund. No payment provider, refund, production source,
policy, configuration, scheduler or main checkout change.

## Execution

Fresh disk-backed runtime through `/tmp/task128-runtime.sh`, derived from inspected
`/tmp/task126-runtime.sh`, preserving all PID/UID/executable/datadir/direct-child,
loopback listener, readiness, target safety and bounded exact cleanup guards.
Only worktree path/marker and test list changed; mutation block removed for green run.
Command: `bash /tmp/task128-runtime.sh > /tmp/task128-run.log 2>&1`.
Test command: `npm --prefix tixmoapi2 test -- --runInBand --runTestsByPath tests/integration/order-confirm-expiry.race.test.ts tests/integration/order-confirm-cancel.race.test.ts tests/integration/order-double-confirm.race.test.ts tests/integration/order-double-cancel.race.test.ts tests/integration/order-double-refund.race.test.ts tests/orders-tenant.unit.test.ts tests/security/tenant_scope.test.ts`.
Build: `npm --prefix tixmoapi2 run build`.

Independent exact-SHA review required. Parent68 remains open; webhook/lease races,
combined UI/API, full market gates and launch acceptance are not covered.

## Actual results and cleanup

Initial expanded run:6 suites passed/1 could not load,51 passing tests; seventh
suite failed with Jest transform-cache `/tmp/jest_rs` UNKNOWN write error. Not a
product assertion failure; build was not reached. Exact owned PG895823/Redis895853
stopped (PID absent, PG pidfile absent, loopback empty, Redis exit log).
One bounded repair: add `--cacheDirectory /home/daniel/projects/projectTixmo/worktrees/task-128/.jest-cache`
to Jest invocation and log on disk: `bash /tmp/task128-runtime.sh > .runtime128-repair.log 2>&1`.
PASS7/7 suites,54/54 tests (expiry matrix4/4), API build exit0.
Fresh disk cluster directory under this worktree; exact PG897136/Redis897149 ports20577/50887 stopped and listeners empty.

Historical sensitivity: `bash /tmp/task128-sensitivity.sh > .runtime128-sensitivity.log 2>&1`.
Same inspected57-derived guards, fresh disk cluster; existing126 Python finally
procedure temporarily loads historical `e6a752c0d39ec42ad3ef222011dd6d3c84d0c3fe`
order service, runs only expiry matrix with disk cache, restores exact bytes and
requires clean source diff. Actual4/4 RED, Jest exit1, no barrier timeouts;
expected winner safety fails (e.g. expiry winner overwritten back to PAID).
The outer sensitivity wrapper exits0 intentionally after recording inner1 and
successful restoration/cleanup; it is not a green regression pass.
Exact PG898544/Redis898557 ports25753/41553 stopped; no live PID/listeners.
Production source diff empty. Final `git diff --check` passes.

Logs/helpers remain local evidence only; committed paths are this evidence and
`tests/integration/order-confirm-expiry.race.test.ts`. Dependency symlink and
owned runtime/cache directories are untracked, not deliverable infrastructure.
