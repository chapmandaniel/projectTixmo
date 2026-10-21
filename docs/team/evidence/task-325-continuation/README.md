# Task325 continuation - partial RED/GREEN checkpoint

Branch tixmo/task-325-refund-races, starting exact65b75bc1ea35f63df9c3171ae2faaf2414385fd6; accepted product base f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d. Existing owned claim continued. Read task324 historical contract and existing tests before changes; historical order-double-refund assertions untouched.

## Actual defect and minimal repair

Real scoped ADMIN request reads valid PAID/SUCCEEDED order. Spy calls actual Prisma findFirst, then commits separate paymentStatus FAILED update before returning actual snapshot. Baseline rejects assertion: expected400, received REFUNDED/paymentFAILED/refundSUCCEEDED. 1 suite:4PASS1FAIL (6.729s), runtime exit1, retained jest-red artifacts. This is an observed semantic failure, not barrier timeout or missing hook.

OrderService now retains actual scoped observation (also reads for no-actor ingress) and passes it to PaymentService. PaymentService establishes its own real preflight for direct callers and checks observed status/paymentStatus against locked current row before ledger/provider writes. Equality is NOT constant SUCCEEDED eligibility. Existing matching provider verification, durable intent and SUCCEEDED ledger before finalization remain unchanged. Sequential retry first observing REFUNDED remains idempotent; overlapping status change may reject400, not proven here. Snapshot is service boundary, not HTTP route-entry snapshot; earlier controller/ticket checks are not captured by this change.

## Commands and fresh results

`bash docs/team/evidence/task-325-continuation/runtime.sh > docs/team/evidence/task-325-continuation/runtime-red.log 2>&1` exit1:4PASS1FAIL on baseline product.

Same command redirected runtime-green.log on repaired product initially exit1:5PASS1FAIL; new pending ledger expectation incorrectly used PENDING rather than service mapping PROCESSING. Retained jest-intermediate.log, corrected to actual explicit source mapping (payments service status mapping), no product change for this assertion.

Final same runtime command exit0:1 suite7PASS0FAIL0SKIP,6.518s. Includes actual scoped stale observation400/no dependent writes; direct PaymentService preflight stale observation400/full target snapshots; stableFAILED with matching inert provider success allowed; USED/TRANSFERRED denied; exact pending ledger order/intent/amount2000/currencycad/reasonORDER_REFUND/statusPROCESSING/providerID/errornull; provider-confirmed success with sequential retry.

`git diff --check` exit0. No fullAPI gate/build/manual/fairness run claimed.

## Runtime/cleanup

Read342 cleanup and corroborated both PIDs absent/ports empty before soleDB start; existing system/container services untouched. Inspected reused bounded harness; only fresh0700 disk runs under /home/daniel/.openclaw/workspace/tixmo-pm/runtime/task325-continuation. env-i, synthetic credentials, loopback PG18Redis, preimport node network guard, fakeStripe only. Existing task325 writable copied dependencies reused (not shared generated client). Guard blocked records0. Every runtime trap stopped its owned PG/Redis. cleanup.json verifies actual PIDs/listeners/socket/pidfile/worker absence (includes intermediate failed run PID/listener verification). Audit directories retained; no unrelated processes stopped.

## Still OPEN

No genuine overlapping SQL lock contention/concurrent provider-idempotency proof, inverse schedules, foreign-buyer snapshots, insufficient-SOLD finalization rollback, slow-provider terminal monotonicity, route-entry observation test, or manual/fairness regressions. InsufficientSOLD future test must preserve prior durable SUCCEEDED provider ledger while rolling back local finalization, not pretend external refund rolls back. Direct preflight sensitivity test is fresh green only; scoped boundary has actual baseline RED. No full acceptance, no push/merge/deploy/config/cloud/spend/provider access. Requires independent lead+QA exactSHA before acceptance;325 remains review/open.
