# Task287 local synthetic reservation pressure

Author scoped verification only; independent QA required. Branch `tixmo/task-287-local-pressure`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-287`. Reviewed unchanged product `4ec8594850eb547dafc145a14bb1b85cdeaa235c`; harness `4b3dcd8` (full SHA in provenance.json). Reuses only inspected task284 runtime guard pattern, not historical logs or PASS results.

One initial compile-only failure (TS6133 unused VIP binding) ran zero tests and cleaned its owned services. One bounded harness-only repair removed the unused binding; initial rejection and cleanup retained in initial-*.log.

## Scope and reproducibility

Actual `OrderService.createOrder` against disposable native PostgreSQL18. Synthetic 2000-ticket event (1800 GA/200 VIP), CAD, cap4. 1800 distinct synthetic buyers each request2 GA at evenly scheduled30 arrivals/sec for60seconds. This is attempted service-call arrival rate, **not 30 successful orders/sec**, HTTP throughput or500/1000 concurrent sessions. No forced initial lock contention; `pg_stat_activity` sampled at approximately100ms records observed SQL lock waiting. Sampling can miss short waits. `timeline.json` records target/actual arrival, invocation/completion, queue/backlog and sampled SQL state. Sample `active` is active SQL sessions; summary `maxActive` is active service calls.

Test-only real Prisma client35 connections, service-call concurrency30, queue capacity1800. PG130max connections, statement/lock timeout5seconds, unchanged product transaction timeout15seconds. Arrival/completion deadlines85/90seconds, Jest100seconds, runner110seconds; migration35seconds; cleanup bounded with exact owned PID checks. Latencies include harness queue; service latency reported separately. Timer lateness and event-loop histograms are measurements, not production SLA acceptance.

Fresh0700 disk-backed `runtime/task-287/` (exact final run in runtime.log), `env -i`, explicit owned verified127.0.0.1 listeners before DB access. Previous QA286 cleanup checked before startup. PG/Redis private cached binary hashes and dependency cache identity captured in provenance; no install, host configuration change, inherited credentials, cloud or spend. Jest schema bootstrap uses existing unmodified fail-closed guard. Native Redis readiness verified, but Jest Redis/rate-limiter/logger are existing mocks; notification module stubbed. No app/HTTP/provider/payment/email bootstrap. Actual orders stay PENDING/HELD with no payment intent, never fulfillment proof.

Commands:

```
bash -n docs/team/evidence/task-287-local-pressure/runtime.sh
git diff --check
bash docs/team/evidence/task-287-local-pressure/runtime.sh > docs/team/evidence/task-287-local-pressure/runtime.log 2>&1
sha256sum -c docs/team/evidence/task-287-local-pressure/source-sha256.txt
```

Source manifest covers harness/runner/setup/guard/schema/lockfile and all product TypeScript. Reused dependency symlink removed after checks. Commits use process-local author identity and `core.hooksPath=/dev/null` because isolated worktree lacks configured identity and existing Husky bootstrap; no persistent Git config modified.

Full W09 staging capacity, real provider fulfillment, HTTP/rate limiting, browser/client mix,500/1000-session load and launch qualification remain **NO-GO / unproven**. No push, merge, deployment, live financial action or production migration.

## Fresh results

Final runner exit0, migrations31 applied, Jest1/1PASS66.064s (test60.462s). Exactly1800 arrivals/completions,900 reservations/900 `Not enough tickets available`, no unexpected errors. GA available0/held1800/sold0; VIP available200/held0/sold0.900pending CAD orders,1800HELD tickets, unique1800barcodes/900order numbers/900buyers; exactly2tickets per successful order and no payment intent. All assertions passed.

Measured load+monitor drain60.087seconds, max active service calls2/max queued1/max backlog2/final backlog0. Latency p50=13.531ms/p95=24.871ms/p99=25.560ms/max39.624ms.590SQL samples observed max0lock waiters (not proof of zero transient locks). Event-loop histogram p99=11.764ms. Timers allow small early arrivals: signed lateness min-2.153ms/p99=1.202ms/max15.230ms; rate-buckets.json supplies actual arrivals/completions per second instead of asserting exact30in every bucket.

Final owned PG2665548/Redis2665561 on31771/59333 cleanly stopped; first compile attempt PG2663911/Redis2663924 on28611/45616 also stopped. Independent post-run process/listener/socket/postmaster checks in cleanup.txt. SoleDB released. Summary/timeline and logs are fresh task287 evidence, not replayed results.
