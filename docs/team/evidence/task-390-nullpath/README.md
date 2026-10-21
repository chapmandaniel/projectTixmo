# Task390 NEW null-path runtime qualification - scoped PASS, awaiting independent QA

Exact source `971275ba7c87b7d6d3d8831d6334922dcf618a05`, dual-reviewed
lead402 `cb1490caca36f4257df1cd633e013fa0d529986f` and QA403 `b0e7c5ab`
(report prefix from PM handoff). Isolated branch `tixmo/task-390-nullpath`,
worktree `/home/daniel/projects/projectTixmo/worktrees/task-390-nullpath`.
Fresh sole disposable-DB grant on task390 inspected and task claimed before run.
Old task390 failure evidence and shared main preserved. No product/source edits.

## Actual single execution

Reviewed runner, network guard, runtime-path, process-cleanup, integration test,
setup and verification-safety read before execution. Existing installed task57
binaries and task354 dependencies reused; exact lock SHA and generated-client
schema whitespace-equivalence retained in provenance.json. Worktree-local
node_modules symlink only. No install, download, generation or shared writes.
Runner scrubs environment with env-i; synthetic fixtures only, pre-import
loopback guard and exact PID-owned listener checks. Existing adequate reviewed
Jest/Supertest harness reused, no custom framework.

Command, from isolated worktree:

```
TASK379_PM_RUNTIME_GRANT=source-reviewed-sole-owner timeout --signal=TERM --kill-after=12s 170s bash docs/team/evidence/task-379/runtime.sh
```

2026-10-21 13:44:43Z to 13:45:05Z, exit **0**. Migration and schema setup
succeeded. Jest one test/suite PASS (18.452s total, test 11.694s).
Disk runtime retained owned0700:
`/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.w3oFCn`.

## Acceptance actually exercised

- Actual 100 GET200 + 100 POST201, exactly200 results; 100 arrived/completed,
  maxActive2 (cap30), maxQueue1, measured3380.875ms.
- Read p50/p95/p99/max: 10.149/19.542/24.096/31.652ms.
- Order p50/p95/p99/max: 18.803/34.232/35.924/42.278ms.
- Passing exact-source assertions verify100 unique order IDs/numbers/users,
 100 PENDING orders with no payment intent;100 unique barcodes and HELD tickets,
  stock available/held/sold0/100/0. Finally iterates all100 PENDING orders through
  actual OrderService.cancelOrder and asserts restored100/0/0 and zero leases.
  These state/cancellation assertions are evidenced by unchanged inspected test
  and Jest PASS; no separate per-cancellation/state snapshot artifact exists.
- 63 monitor samples: peak3 PG connections,0 lock waiters,0 ungranted locks,
  peak2 leases/backlog, RSS1094664192 bytes. Last sampled cumulative CPU since
  test start user11547959us/system631080us; not isolated route-only CPU.
  Full CPU/RSS/Redis keys/leases/arrival/queue samples retained in measurement.
- No HTTP failures or cleanupErrors; partial.json retained even on success.

## Complete owned cleanup and raw receipts

Runner current-invocation-bound process cleanup errors[]; serverListening false.
Exact PG3291903:38404, Redis3291916:55714, Jest/API3292058:32911. Independent
post-run /proc absence for all three, ss exit0/empty for all three ports,
postmaster.pid and PG socket absent. See independent-cleanup.json plus raw
jest-identity/http-listener/process-cleanup receipts and runner.log.
Unrelated postgres7071/7502 and redis7194/7620 not connected to or touched.
Raw migration/initdb/Postgres/Redis/Jest logs, measurement/partial/cleanup and
SHA256 artifact manifest copied byte-for-byte from retained runtime.

## Scope and handoff

Actual Node24.21.0, PostgreSQL18.6 Ubuntu build, Redis8.0.5. **NONPARITY**:
not task245 version-parity, staging or production capacity acceptance.
Independent QA must verify exact evidence commit, actual results and cleanup
before PM closes390. Author submits REVIEW, never self-closes.
Full246 remains OPEN: wider session ramp, soak,60sec burst, provider,
fulfillment/recovery and production rate-limit budgets are unproved.
No fullAPI/provider/mail/third-party/target/envsecret/config/spend/push/merge/
deploy; no guard bypass or weakened assertions. Evidence commit uses
command-local identity/hooksPath only (installed hook lacks husky.sh); no
persistent Git config changes. git diff --check performed before commit.
