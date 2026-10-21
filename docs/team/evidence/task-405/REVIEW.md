# QA405 - scoped HTTP100 runtime ACCEPT

Independently reviewed report `441fad2b1d74b9564490262cdcf20d4836e852bb`
against source `971275ba7c87b7d6d3d8831d6334922dcf618a05`.
Branch `tixmo/review-405-nullpath-runtime`, isolated worktree review-405;
report-only ownership under docs/team/evidence/task-405. Shared main untouched.

## Actual checks

`env -i PATH=/usr/bin:/bin python3 docs/team/evidence/task-405/check.py`
completed exit0. Reproducible checker and output retained. All18 manifest hashes
match. Eleven raw artifacts byte-identical to retained owned0700 current-user
runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.w3oFCn`.
Seven orchestration/derived artifacts exist only in the committed report, not
inside that runtime: runner/provenance/exit/start/finish/independent-cleanup/summary.
These are hash-checked and corroborated, not misrepresented as raw duplicates.

- Independently counted exactly200 results,100 GET200 and100 POST201, each
  index0..99 exactly once per route;100 distinct order IDs. Partial matches
  results, active0, no failure. Arrived/completed100, maxActive2, maxQueue1,
  elapsed3380.875ms. This is100 scheduled buyer pairs, NOT100 simultaneous buyers.
- Recomputed every route percentile from raw results: read p9519.542ms,
  order p9534.232ms.63 monitor samples match report peaks: PGconnections3,
  lockwait/ungranted0, leases/backlog2, RSS1094664192. CPU is cumulative test
  process use, not route-only. Active cap30 is an upper bound, not achieved load.
- Inspected unchanged source assertions and success path:100 unique order
  IDs/numbers/users, PENDING/no payment intent;100 unique HELD barcodes and
  stock available/held/sold0/100/0. Finalizer fetches pending orders and invokes
  actual OrderService.cancelOrder, then asserts100/0/0 and zero leases. Jest
  one test PASS and cleanupErrors[] support completion of100 cancellations;
  no separate per-cancel or state snapshot exists. No direct DB reread by QA.
- Native identity/listener/cleanup/observer receipts agree on current64hex runId,
  runtimeRoot, PID3292058/PPID3292057/executable/startStat and exact listener
 127.0.0.1 IPv4:32911. errors[], pidAbsent, empty listener rows, serverListening
  false. Reviewed runner passes shell-held fresh invocation challenge to observer.
- Source hashes logged for runner/guard/observer/test; isolated review and actual
  execution worktree files match exact971275ba. Actual installed task354 lock
  exact and generated schema whitespace-normalized equivalent independently
  verified. No dependency install/generation performed.
- Fresh independent local observations: PG3291903, Redis3291916, Jest/API3292058
  all /proc absent; ss exit0/empty for38404,55714,32911; retained postmaster.pid
  and .s.PGSQL.38404 absent. No connections, probes or signals performed.

## Command/provenance and limits

Author retained command:
`TASK379_PM_RUNTIME_GRANT=source-reviewed-sole-owner timeout --signal=TERM --kill-after=12s 170s bash docs/team/evidence/task-379/runtime.sh`.
Read runner verifies env-i reexec, synthetic-only fixtures, exact owned service
listeners, guards and bounded cleanup. Report says13:44:43Z–13:45:05Z exit0;
Jest PASS/migration/PGRedis logs and receipts corroborate. QA did not witness
historical launch or rerun it. Seven report-only artifacts limitation above.

Node24.21.0, PostgreSQL18.6, Redis8.0.5 NONPARITY: not245 parity, staging or
production capacity. No broader ramp, soak,60sec burst/provider/fulfillment/
recovery or full246 acceptance. No runtime rerun, DB access, services, network,
install, source changes, shared config, push, merge or deploy by QA.

Verdict: scoped ACCEPT, no blocking evidence discrepancy. QA405 may close;
PM alone decides390 closure. Full246 remains open. Report commit uses scoped
identity/hooksPath override for missing husky helper, not persistent Git config;
`git diff --check` passed. Prior checker attempt assumed all18 files inside raw
runtime and stopped on missing runner.log; corrected to distinguish11 raw from
7 report-only artifacts explicitly, not an underlying runtime failure.
