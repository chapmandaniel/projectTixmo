# Task 137: stranded crashed PROCESSING baseline

Test-only artifact, 2026-10-20. Base `3d9d84d2ec1bef44e1bcf5e7518fc7acd141f86a`;
branch `tixmo/task-137-old-processing-baseline`; parent task 68 remains open.
Reuse: task68 plan `977848b`, reviewed FAILED retry Jest/Prisma/Stripe harness.
No new framework or production-source/schema/config/policy changes.

## Execution

Worktree `/home/daniel/projects/projectTixmo/worktrees/task-137`.
Inspected status/worktrees before creation; shared main untracked docs preserved.
Reused node_modules symlink to task65. Inspected approved review135 runtime helper;
created `.task137-runtime.sh` with only owned runtime paths, labels and test/build
tail adapted. Removed its obsolete production mutation/red-restoration tail entirely.
All UID/PID/executable/datadir/direct-child/listener/loopback/readiness/target and
bounded cleanup guards retained. No inherited database used; no unrelated services touched.

Exact invocation: `bash .task137-runtime.sh > .task137-runtime.log 2>&1`.
Exact test command inside validated disposable runtime:

```sh
npm --prefix tixmoapi2 test -- --cacheDirectory "$PWD/.jest-cache" --runInBand --runTestsByPath tests/integration/payment-old-processing.baseline.test.ts > .task137-baseline.log 2>&1
npm --prefix tixmoapi2 run build > .task137-build.log 2>&1
```

Runtime disk directory `.runtime137.r92tnn`; PostgreSQL owned PID 960418,
loopback port 36283, database `tixmo_disposable_57`; Redis owned direct child
PID 960431, loopback port 43848, database /1. Target guards succeeded before
schema bootstrap. Synthetic local Stripe signing fixture only; no provider call.
Jest setup mocks Redis/logger; database and Stripe signature verification are real.
Email/admin delivery boundaries mocked; no financial action.

Results: test exit **1**, **1 suite / 2 tests: 1 GREEN fresh control,
1 deliberate RED ancient recovery oracle**. API build exit **0**.
No harness timeout or infrastructure failure. Fresh case is full no-op; ancient
case is seeded PROCESSING at 2000-01-01, no worker ever invoked, target PENDING
and payment PROCESSING with two existing tickets and second buyer's same-type
hold. Timestamp is fixture evidence of age, not a chosen product lease duration.

Ancient failure at line 63: expected event PROCESSED / order PAID / payment
SUCCEEDED / inventory [available,held,sold]=[6,2,2] / one email; observed
PROCESSING / PENDING / PROCESSING / [6,4,0] / zero email. Pre-oracle full event,
order/tickets/inventory equality assertions prove durable skip, not fulfillment.
Both cases assert full other-buyer order/tickets equality, unchanged target
tickets, cardinality four, one webhook row, nonnegative conserved inventory.
Full exact before/after committed snapshots: `task-137-processing-snapshots.json`.

Cleanup helper exit 0: PostgreSQL fast stop confirmed, Redis exact owned child
stopped/reaped; final listener query empty on both ports and neither PID alive.
`git diff --check` passed before commit. Logs/runtime/helper retained untracked
in this worktree for independent reproduction; only tests and evidence committed.

## Limits and handoff

Deliberate RED is a reproduction artifact, not a passing readiness gate. Baseline
observation assertions intentionally document current skip; later recovery work
must replace those observations with a reviewed recovery contract. No policy,
lease duration, takeover or fencing implementation selected. Stale active owner
fencing still requires a separate deterministic reproduction before a fix.
No full-market/launch acceptance, default merge, deploy, provider, refund or
production action. Decision73 manual reconciliation/no financial refund unchanged.
Independent QA must inspect/rerun exact artifact SHA before test-only closure;
author submits review, never closes137 or68.
