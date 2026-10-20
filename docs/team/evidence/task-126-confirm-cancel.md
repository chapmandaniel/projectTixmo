# Task 126: confirm versus cancel real-Prisma schedules

2026-10-20 America/St_Johns. Test/evidence only, based on independently reviewed
`3dc4e3c189c31e04928d57b55061e60eb238e46f`.
Branch `tixmo/task-126-confirm-cancel`; worktree `worktrees/task-126`.
Reused existing double-confirm/cancel/refund integration fixtures and task68
plan `977848bcd5bbe5ce0377cae4916bf0966e088f59`; no new dependency.

## Harness and contracts

Four cases cross confirm-first/cancel-first commits with natural/forced-reversed
real-read completion. Invocation 0 is confirm, 1 cancel; IDs assigned before
awaiting actual Prisma reads. Both actual reads must return target PENDING
before either gate is released. Await selected operation commit before releasing
stale competitor. Five-second gate timeouts are harness failures, never accepted
product losers. Finally releases gates, awaits both outcomes and restores spy.
No database result, write, inventory or transaction mock; notification boundary
alone is mocked. Distinct unrelated buyer has another pending order on the same
ticket type. Its complete order/ticket snapshot must remain unchanged.

Exactly one fulfillment and one rejection with statusCode400 and exact existing
stale-transition message. Confirm winner: PAID/SUCCEEDED, VALID tickets,
[available,held,sold]=[6,2,2]. Cancel winner: CANCELLED order/CANCELLED tickets,
paymentStatus PENDING preserved, inventory[8,2,0]. PM explicitly clarified that
CANCELLED/CANCELLED means order/ticket states, not a new payment-status contract.
Checks include nonnegative/conserved total10, two tickets per order and total4,
full target ticket snapshots (only cancellation status/updatedAt may change).

## Actual commands and results

Sole PM-assigned owned disposable DB/services runner `/tmp/task126-runtime.sh`
adapts inspected `/tmp/task124-runtime.sh` only for fresh disk-backed task126
directory, output marker and test/build/sensitivity commands; every existing
PID/UID/executable/data-directory/direct-child/readiness/loopback/listener/
target-safety/exact bounded cleanup guard retained. No inherited DB used.

Command: `bash /tmp/task126-runtime.sh > /tmp/task126-final.log 2>&1`, exit0.
Inside guarded runtime:

```sh
npm --prefix tixmoapi2 test -- --runInBand --runTestsByPath tests/integration/order-confirm-cancel.race.test.ts tests/integration/order-double-confirm.race.test.ts tests/integration/order-double-cancel.race.test.ts tests/integration/order-double-refund.race.test.ts tests/orders-tenant.unit.test.ts tests/security/tenant_scope.test.ts
npm --prefix tixmoapi2 run build
```

Six suites, 50/50 tests PASS (11.914s); includes four new mixed schedules.
API build exit0. First run48/50 passed with two failures caused solely by the
author's initial incorrect cancellation payment-status expectation; corrected
per source/existing regression/PM clarification. Not a product defect.

Sensitivity: temporarily substituted only `src/api/orders/service.ts` from
`e6a752c0d39ec42ad3ef222011dd6d3c84d0c3fe`, ran only new mixed suite.
4/4 tests FAIL, exit1,4.627s, real terminal-state oracles, no timeout. Both calls
fulfilled and target tickets cancelled even when final order PAID. Python
try/finally restored exact candidate source; `git diff --exit-code --
tixmoapi2/src/api/orders/service.ts` exit0. No source change committed.

## Exact observed traces (first four candidate, last four sensitivity)

```text
TASK126_OBSERVED {"winnerIndex":0,"reverseReads":false,"trace":["read-1-PENDING","read-0-PENDING","call-0-committed","both-settled"],"outcomes":["fulfilled","rejected"],"counters":[6,2,2],"target":"PAID","payment":"SUCCEEDED","other":"PENDING","ticketStates":["VALID","VALID"]}
TASK126_OBSERVED {"winnerIndex":0,"reverseReads":true,"trace":["read-1-PENDING","read-0-PENDING","call-0-committed","both-settled"],"outcomes":["fulfilled","rejected"],"counters":[6,2,2],"target":"PAID","payment":"SUCCEEDED","other":"PENDING","ticketStates":["VALID","VALID"]}
TASK126_OBSERVED {"winnerIndex":1,"reverseReads":false,"trace":["read-0-PENDING","read-1-PENDING","call-1-committed","both-settled"],"outcomes":["rejected","fulfilled"],"counters":[8,2,0],"target":"CANCELLED","payment":"PENDING","other":"PENDING","ticketStates":["CANCELLED","CANCELLED"]}
TASK126_OBSERVED {"winnerIndex":1,"reverseReads":true,"trace":["read-1-PENDING","read-0-PENDING","call-1-committed","both-settled"],"outcomes":["rejected","fulfilled"],"counters":[8,2,0],"target":"CANCELLED","payment":"PENDING","other":"PENDING","ticketStates":["CANCELLED","CANCELLED"]}
TASK126_OBSERVED {"winnerIndex":0,"reverseReads":false,"trace":["read-0-PENDING","read-1-PENDING","call-0-committed","both-settled"],"outcomes":["fulfilled","fulfilled"],"counters":[8,0,2],"target":"CANCELLED","payment":"SUCCEEDED","other":"PENDING","ticketStates":["CANCELLED","CANCELLED"]}
TASK126_OBSERVED {"winnerIndex":0,"reverseReads":true,"trace":["read-1-PENDING","read-0-PENDING","call-0-committed","both-settled"],"outcomes":["fulfilled","fulfilled"],"counters":[8,0,2],"target":"CANCELLED","payment":"SUCCEEDED","other":"PENDING","ticketStates":["CANCELLED","CANCELLED"]}
TASK126_OBSERVED {"winnerIndex":1,"reverseReads":false,"trace":["read-0-PENDING","read-1-PENDING","call-1-committed","both-settled"],"outcomes":["fulfilled","fulfilled"],"counters":[8,0,2],"target":"PAID","payment":"SUCCEEDED","other":"PENDING","ticketStates":["CANCELLED","CANCELLED"]}
TASK126_OBSERVED {"winnerIndex":1,"reverseReads":true,"trace":["read-1-PENDING","read-0-PENDING","call-1-committed","both-settled"],"outcomes":["fulfilled","fulfilled"],"counters":[8,0,2],"target":"PAID","payment":"SUCCEEDED","other":"PENDING","ticketStates":["CANCELLED","CANCELLED"]}
```

## Cleanup and scope

Final guarded cleanup: PostgreSQL PID885281 and Redis PID885294 stopped;
ports20933/52466 listener output empty; runner verified both PIDs not alive.
First-run cleanup also verified PID884099/884112 stopped, ports27436/46853 empty.
Raw logs `/tmp/task126-results.log` and `/tmp/task126-final.log`; fresh directories
`.runtime126.OCZC8W` and `.runtime126.kkZPux` are untracked retained diagnostics.
Dependency symlink and generated build output are not committed.

No product/schema/config/lock/policy changes; no financial/provider operation,
expiry investigation, main merge, deploy, shared or unknown runtime. Broader68
expiry/webhook/recovery schedules remain open. Submit126 REVIEW for independent
exact-SHA lead review; this is not full lifecycle or launch acceptance.
