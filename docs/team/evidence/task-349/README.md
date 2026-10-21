# Task349 independent fresh SQL QA

Bounded APPROVE exact candidate `4a89e7c93c854a381a661d9e485e1dd47f3a4259`, 2026-10-21. Isolated new worktree `/home/daniel/projects/projectTixmo/worktrees/task-349`, branch `tixmo/task-349-independent-qa`, based exactly on candidate. Source/schema/tests untouched; only task349 evidence added. Task348 artifact preserved. Parent325 remains PARTIAL REVIEW; separate lead exact-new-SHA review required.

## Independent checks and execution

Read role/repository instructions,349/325 notes, final task-325-terminal README/runtime/guard, retained initial/final logs+JSON and complete candidate test diff from2ac9a4b. Earlier startup team workflow remains applicable. Reused inspected offline runtime and test tooling, no new product implementation.

Independently corroborated author cleanup before startup: PIDs3023482/3023495/3024051/3024064 absent in /proc; ss ports38668/42558/22131/50298 empty; live process scan no relevant owned task runtime (inspection processes excluded). Explicit PM soleDB grant used.

Independent writable API dependencies copied from prior independent task348 using cp -a --reflink=auto; generated-client index linkcount1/mode600. No downloads/shared generated-client changes. Runtime copied from candidate, only disk runtime root task349 and artifact output directory adjusted; synthetic identifiers remain325. Inspected preimport guard unchanged, bash -n and node --check PASS. env-i before imports, synthetic values only, nonloopback denyguard, owned0700disk loopback PG18+Redis and inert provider/notifications. Redis globally mocked by suite, not a Redis behavior proof.

Actual command from worktree:
`bash docs/team/evidence/task-349/runtime.sh > docs/team/evidence/task-349/runtime.log 2>&1` exit0.
Fresh real SQL **1suite11PASS0FAIL0SKIP7.422s** (suite7.171s). Raw logs/JSON/provenance retained. `git diff --exit-code 4a89e7c -- tixmoapi2/src tixmoapi2/tests tixmoapi2/prisma` PASS; product/schema diff2ac9a4b..4a89e7c empty. Candidate test hash retained. git diff --check PASS.

## Scoped behavior and sensitivity

Real order-row lock is held before both requests; probe observes >=2 blocked PostgreSQL order-lock queries while provider remains uncalled. After release both provider creations overlap and share ledger-derived key,1 synthetic effect,2 fulfilled calls,1 successful ledger and once-only stock counters; replay is full snapshot no-op. Stronger overlap checks now assert exact fixture ticket count, sorted IDs and complete ticket rows with only status CANCELLED/inventoryState RELEASED/updatedAt allowed changes. This addresses previously disclosed vacuous-every/cardinality/ID/full-row assertion gap. No mutation check performed; this is fresh demonstrated current-source behavior, not exhaustive sensitivity.

Snapshot helper includes complete foreign event row plus order/sorted tickets/stock/refunds, protecting distinct-event persistent foreign state in contention and rollback cases. InsufficientSOLD409 preserves complete stock/tickets and PAID order except PROCESSING bookkeeping/time while durable providerSUCCEEDED ledger survives; not external-money rollback.

Finally releases gates then allSettled([blocker,settled]) drains both blocker and requests before propagating blocker rejection. This source change addresses rejection bypass of request drain. No injected blocker rejection was executed, so universal failure-cleanup robustness is not certified.

Two parameterized response schedules exercise successful provider invocation0 and1 respectively. Both calls enter provider before responses; pre-response order PAID/PROCESSING, ledger REQUESTED/null providerID, stock/tickets unchanged. Fast success yields REFUNDED/SUCCEEDED, exact full ticket transitions and once-only stock. Slow pending response then cannot change entire terminal order/tickets/event/stock/refund snapshot including timestamps; both calls retain same key. These are two bounded inverse response orders, not exhaustive concurrency or live Stripe guarantees.

Author chronology independently parsed: initial9PASS2FAIL/successfalse7.591s, final11PASS/successtrue7.161s. Initial new assertions expected ledgerPROCESSING before response; schema paymentRefund status defaults REQUESTED (line378), while order is PROCESSING. Explicit REQUESTED assertion corrects mistaken expectation without deleting/loosening it or repairing product source. Existing9 passed both author runs. Raw historical failures remain in candidate task-325-terminal evidence; not a product red/green claim.

Remaining limits: lock probe not targetPID/order scoped; foreign snapshots distinct-event only, not shared stock or intermediate effects; no broader rollback tiers/promos/recovery, route actor matrix, manual/fairness, fullAPI/fullgate or release acceptance. No real-provider exactly-once guarantee. Parent325 stays open/partial.

## Cleanup and boundaries

Owned PG3025803 and Redis3025816 stopped; independently corroborated /proc absence, ports38287/56316 empty, sockets/pidfiles absent and no workers referencing exact run directory. cleanup.json records all checks and0blocked network records. Retained runtime directory is0700disk, DB RELEASED; unrelated services untouched.

Command-scoped Git identity/hooksPath=/dev/null bypass known missing Husky bootstrap only, no hook-gate success claim or persistent config edit. No .env/secrets/cloud/real provider/email/spend/config/scheduler/push/merge/deploy. Finish349 scoped review only, never325 broader acceptance.
