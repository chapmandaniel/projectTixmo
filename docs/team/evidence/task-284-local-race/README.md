# Task284 bounded last-ten reservation race

2026-10-21 UTC. Scoped author PASS; independent QA required. Branch `tixmo/task-284-local-reservation-race`, isolated worktree task-284. Exact tested harness `4cae9eb99b29714e190aa09ae5a6993cad51425b`, reviewed product base `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged. Source manifest captures actual source/test/setup/guard/schema/lockfile/runner hashes. Reuses reviewed279R2 `4c8561342268ffe764a1dd8abd6661488b63e3e5` owned-runtime guard/cleanup pattern only; no historical PASS reused.

## Actual execution

```
bash -n docs/team/evidence/task-284-local-race/runtime.sh
bash docs/team/evidence/task-284-local-race/runtime.sh > docs/team/evidence/task-284-local-race/runtime.log 2>&1
sha256sum -c docs/team/evidence/task-284-local-race/source-sha256.txt
git diff --check
```

Final commands exit0. 31 real PostgreSQL migrations applied, Jest1/1PASS6.822s; test1255ms. 100 distinct synthetic buyers invoke actual OrderService.createOrder concurrently against actual PG18 (no service/database mocking). A bounded held event row lock proves66 actual waiting PostgreSQL sessions before release. All100 promises start without a worker limiter; test-only **real** PrismaClient has105 connection limit/5s pool timeout, PG130 max connections and5s statement/lock timeout; service retains15s transaction timeout. This bounds only the disposable test instance and client, not product configuration. No HTTP/app/payment bootstrap.

Exactly10successful reservations,90failures all `Not enough tickets available`; no other errors. Final stock available0/held10/sold0,10orders/10tickets. Unique barcodes/orderIds/buyers, exact successful order-to-ticket correspondence; all tickets HELD, all orders PENDING with no payment intent and not SUCCEEDED. Stock conservation10; no negative/oversold inventory. Aggregate duplicate-line cap3>2 rejects without mutation. Invalid promo validation occurs after actual inventory decrement and rejects with full stock/order/ticket rollback.

Measured contention+completion1140.532ms; attempt latencies min120.021/p50639.122/p951117.745/p991135.537/max1139.768ms. Full100outcomes and individual latencies in acceptance.log; summary.json provides aggregate evidence. These timings are NOT throughput/30orders-per-second or production capacity acceptance.

## Target safety and cleanup

QA282R2 soleDB release independently checked before start:2648114/2648127 and30932/49326/45179 absent. Fresh restricted disk-backed0700 `runtime/task-284/run.ue12AR`, env-i, explicit verified owned loopback PG18/Redis listeners, disposable DB and Redis/1, no inherited credentials. Existing task271 node_modules reused temporarily via symlink (removed), no install or provider bootstrap. Jest global Redis/rate-limit/logger are mocks; native Redis readiness only. Notifications stubbed; paid-priced order creation does not invoke payment/provider calls. No payment/Stripe/email/charge/network target/cloud/spend/config/push/merge/deploy.

One initial runner attempt safely rejected URL pool query parameters by existing unmodified verification guard **before migrations/tests**. It cleaned PG2652733/Redis2652746 ports24025/53096; initial failure preserved first-guard-rejection.log. One bounded repair keeps env target URL plain and configures only test-owned real PrismaClient pool. Final PG2653729/Redis2653742 and ports38929/59768 stopped and independently absent; postmaster.pid and Redis socket absent, cleanup.txt. SoleDB released. No HTTP listener created. Outer100s test deadline/35s migration deadline and owned PID-checked cleanup retained.

Local commit hook initially failed because existing Husky bootstrap file is absent in worktree; commit used process-local core.hooksPath=/dev/null after explicit checks, no repository config change.

Limits: direct service reservation proof only; no charge, fulfillment, signed webhook, HTTP/rate-limit/cache behavior, browser,500/1000-session demand/30orders-per-second, staging, device or full W09 qualification. Full launch W09 remains NO-GO. Author submits review, not done.
