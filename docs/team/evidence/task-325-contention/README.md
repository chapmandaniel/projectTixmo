# Task325 contention continuation - partial qualification

Starting exact bc3384cf316c9efa86fc9510d6a905cd032fd52a, branch tixmo/task-325-refund-races. No product-source change. Existing historical tests preserved. Sole local DB use admitted after independent live corroboration345 PIDs3004157/3004170 and ports29034/59924 absent.

## Actual results

Command: `bash docs/team/evidence/task-325-contention/runtime.sh > docs/team/evidence/task-325-contention/runtime.log 2>&1` exit0. Fresh SQL 1suite9PASS0FAIL0SKIP,7.185s. Existing7 retained plus2 new meaningful cases.

Overlap: actual external PostgreSQL transaction holds the real order row FOR UPDATE; pg_blocking_pids observes at least2 blocked order-lock queries (including PostgreSQL queue chains). Provider not called while locked. Release permits both requests to reach synthetic provider create before either response returns. Two actual provider invocations share exact refund-ledger idempotency key; inert provider models one effect per key. This proves application key reuse and resulting single local effect, NOT real Stripe idempotency. Both requests fulfill; single ledger SUCCEEDED/amount2000, both tickets CANCELLED/RELEASED, stock8available/2sold ->10available/0sold. Sequential replay is full snapshot no-op and causes no third create. Distinct buyer/event order+sorted tickets+stock+refund ledger full snapshots unchanged.

Rollback: intentionally only1 SOLD counter for2 SOLD tickets. Provider success durable ledger committed first. Local finalization returns409; stock and both ticket snapshots unchanged; PAID order differs only refundStatus PROCESSING and updatedAt. Exactly1 SUCCEEDED refund remains with correct amount/order/intent/reason; one provider create. Distinct buyer/event full snapshots unchanged. No false claim that external money or durable provider evidence rolls back.

Initial run preserved initial-jest.log/json and initial-runtime.log:7PASS2FAIL. Test probe wrongly counted only immediate blocker, not second waiter queueing behind first. Finally initially did not drain in-flight requests after failed assertion, causing subsequent fixture unique provider-ID collision. Probe corrected to count blocked order-lock SQL and finally drains requests. Compile intermediate preserved compile-jest.log/json/runtime:unused blockerPid TypeScript failure,0tests. Final run clean9PASS. These were harness/test defects, not reproduced product defects; no source repair made.

## Safety / cleanup / limits

env-i before imports,0700 disk runtime under task325, fresh loopback PG18+Redis, synthetic inert provider only, preimport nonloopback denyguard0blocked. Existing independent writable copied dependencies reused; generated client index linkcount1, no shared generated client modification or download. All3 runs owned PIDs/ports/sockets/pidfiles/workers absent verified in cleanup.json; disk audit directories retained. Prior345 cleanup corroborated; unrelated services untouched. `git diff --check`PASS.

PARTIAL task325, not closure/fullAPIgreen. Inverse schedules, slow-provider terminal monotonicity, broader rollback matrix/tiers/promos, shared-stock foreignbuyer isolation, route-entry/actor matrix and manual/fairness regressions remain OPEN. Distinct event foreignbuyer snapshots are not shared-stock isolation proof. No live-provider guarantee. Independent exact-finalSHA lead+QA still required. No default branch change/merge/push/deploy/cloud/config/spend/external messaging.
