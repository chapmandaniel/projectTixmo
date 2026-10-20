# Task 132 - FAILED same-ID webhook retry reproduction

Base: `9122294b71a1ee6ac0a708906c2a1116d86d94d4`.
Branch: `tixmo/task-132-failed-webhook-race`; test-only, no production patch.
Reuses the task130 signed Stripe SDK harness and task68 plan `977848b`.

## Real database schedule and outcome

Two same-ID SDK-signed `payment_intent.succeeded` deliveries both read the same
real seeded FAILED row. The wrappers preserve real Prisma results and writes.
Call0 claim write and PENDING order snapshot complete, then call1 claim write
and PENDING snapshot complete, before either snapshot is returned to its handler.
Both PROCESSING writes succeed: two claimants instead of the required one.
Call0 then confirms the order. Call1 sees the stale PENDING handler snapshot,
but real confirmOrder rejects PAID with statusCode400, as in the existing contract.

- Success completion first: durable writes PROCESSING, PROCESSING, PROCESSED,
  FAILED. Final event FAILED, error `Cannot confirm order with status PAID`.
- Success completion last: durable writes PROCESSING, PROCESSING, FAILED,
  PROCESSED. Final event PROCESSED, null error. This gate is before the real
  completion write, after confirmation has committed; no fabricated result.

Both schedules assert one durable event row with exact context, timestamps,
status/error, call0 fulfillment and call1 rejection, PAID/SUCCEEDED same intent,
exact inventory [available6,held2,sold2], all four original tickets and full
unchanged distinct-buyer order/tickets. Email boundary called once. No provider
network calls or fabricated financial API results; signature parsing is real SDK.
Sequential FAILED retry rereads same-intent PAID, completes no-op PROCESSED;
a further delivery leaves the complete event/order/inventory snapshots unchanged.
This is the inspected current retry contract, not a proposed terminal-state policy.

The final single-claim invariant intentionally fails in both cases (expected1,
actual2). All preceding observation, once-fulfillment and recovery assertions pass.
This is a red regression retained for a separately scoped production fix, not a
passing implementation or closure. The harness is a baseline reproduction: a fix
may require admission-aware gating so the nonowner can skip without waiting for
an impossible second handler. Do not weaken its single-owner invariant.

## Verification and cleanup

Ran `bash .task132-runtime.sh` in task-132. A copy of the exact helper and full
output are beside this document. Fresh disk-backed initdb under
`.runtime132.p3WQGd`, loopback PostgreSQL36853 and Redis41707, verified ownership
and readiness before schema bootstrap; inherited connection environment replaced.
Helper preserved reviewed131/57 PID, UID, executable, datadir, direct-child,
listener, target guard, bounded exact cleanup assertions; only owned paths/cache,
log marker and the explicitly assigned test/build command tail adapted.

Focused command: `npm --prefix tixmoapi2 test -- --cacheDirectory /home/daniel/projects/projectTixmo/worktrees/task-132/.jest-cache --runInBand --runTestsByPath tests/integration/payment-failed-retry.race.test.ts tests/integration/payment-distinct-success.race.test.ts`.
Actual result exit1: 2 suites, 1 failed/1 passed; 6 tests, 2 deliberately failed/4
passed. No barrier timeout. Existing task130 suite passes all four cases.
`npm --prefix tixmoapi2 run build` exit0 (Prisma generation, tsc, tsc-alias).
Cleanup PostgreSQL PID933418 and Redis PID933432 stopped; port36853/41707 listener
query empty and bounded process checks passed. Whole helper exit1 preserves red test.
No default-branch mutations, live payments/refunds, config/scheduler or production
changes. Decision73 remains manual paid-after-expiry reconciliation/no auto refund.
Independent exact-SHA review required before PM closure; no self-closure.
