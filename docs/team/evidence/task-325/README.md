# Task325 bounded checkpoint: PARTIAL, not full refund-race acceptance

Base product f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d; branch tixmo/task-325-refund-races. Sole disposable DB owner after reading task340 cleanup and independently checking current PIDs/listeners. Existing container PG/Redis services were not touched. Runtime scripts/guard inspected and adapted from task323; writable node_modules copied with cp --reflink=auto -a (not shared symlink), no downloads or shared generation.

## Source findings / retained guarantees

Read task324 exact1eeb38eb87c765f79894cf44223e8d106c30b261 and task319 exact8cced1c93fc0abc488ba122803297be667d31b13 slice3. Current OrderService.refundOrder only performs findFirst with actorId. No-actor requests delegate directly to PaymentService transaction lock/findUnique. Old no-actor findFirst barriers are obsolete. Historical stale observed status/paymentStatus refusal is NOT categorical SUCCEEDED eligibility. Old order-double-refund.race.test.ts and assertions are entirely unchanged. No new blanket payment-status eligibility rule or source repair introduced.

Current finalization requires matching SUCCEEDED ORDER_REFUND ledger and remains intact. New qualification uses VALID/SOLD owned tickets, future ON_SALE event, bound synthetic intent and inert mocked Stripe methods; no real provider call. Separate USED and TRANSFERRED controls are refused before any provider access and leave full order/tickets/inventory/refund ledger unchanged.

## Actually executed

Command: bash docs/team/evidence/task-325/runtime.sh > docs/team/evidence/task-325/runtime.log 2>&1

Exit0. env-i startup; new mode0700 disk runtime under tixmo-pm/runtime/task325; owned PG18+Redis loopback identity checks; preimport network guard for node including Prisma bootstrap; synthetic keys only. Setup validates disposable local DB and applies schema through existing tests/setup.ts bootstrap. Provenance hashes retained.

Jest exact command is in runtime.sh, --runInBand --runTestsByPath tixmoapi2/tests/integration/order-refund-current-path.test.ts. Result: 1 suite PASS, 4/4 tests PASS, no skipped tests (6.287 seconds). Positive full refund verifies confirmed ledger, fixed provider idempotency key, one create across sequential retry, exact inventory release. Pending provider preserves PAID and SOLD ledger. No baseline full-suite run or regression suite run is claimed. Guard blocked-record count0; mocked provider makes no network calls.

Cleanup trap completed with exit0. Independent cleanup.json confirms no live owned PID, TCP listener, Unix socket, postmaster/Redis pidfile, or Jest worker. Runtime retained on disk for audit. Services stopped before handoff.

## Explicit remaining acceptance gaps

This bounded six-minute checkpoint does NOT implement or qualify real simultaneous refund contention, request observation/revalidation stale-payment red/green, foreign-buyer snapshots, inverse schedules, insufficient sold finalization rollback, concurrent provider idempotency, slow-provider terminal monotonicity, or focused manual/fairness regressions. Sequential retry is not race evidence. Existing old tests remain known stale and were not run here. No product regression has been reproduced in this checkpoint; source analysis alone is not a green repair.

Review only as partial reusable fixture/current-path evidence. Task325 must remain OPEN pending continuation plus independent lead+QA exact-SHA acceptance. No sharedmain modifications, integration, merge, push, deployment, cloud, real provider, customer messaging, config/scheduler or spend.
