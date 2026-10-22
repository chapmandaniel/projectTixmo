# Independent lead #494 — FINDINGS, not approved

Exact target `2a3de901c2297381c9ef5cb816405b0ec981cf9e`, base
`6ab827bff6fdf67283b93f16612106f2217d4dc0`. Isolated branch
`tixmo/task-494-independent-lead`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-494`.
No implementation or author test files edited. Read actual #493/#494, author
HANDOFF/checker/test and existing fixture/barrier precedents, event/order service,
ActorScope, Prisma schema/client construction, Jest setup/config and bootstrap guard.
Prior role/repository/team instructions and actual BB248 scope retained.

## Required author repairs

1. **P2 — fixture ownership has no cleanup.**
   `tixmoapi2/tests/integration/event-sales-pause.sql.test.ts:25` creates a random
   organization, user, event and ticket type for every test; create paths also
   persist orders/tickets and controls persist audit rows. The only teardown at
   line51 disconnects the client. `tests/setup.ts` bootstraps with schema db push,
   not row reset; the SQL source therefore accumulates data across repeated
   execution and leaks partial fixtures if creation fails. UUID isolation avoids
   immediate collisions but is not cleanup. Track owned identifiers at creation
   time and clean only owned records in FK-safe order after owned operations
   settle (audit RESTRICT requires explicit audit cleanup before event), including
   partial setup failure. Alternatively supply an explicit owned disposable DB
   lifecycle that demonstrably drops the suite target after every run; none is
   currently part of this suite. Never use broad unscoped deleteMany as a repair.

2. **P2 — bounded barriers do not bound the final drain or ensure spy restoration.**
   At lines187-190, finally releases the gate then awaits unbounded
   `Promise.allSettled(requests)` before `spy.mockRestore()`. The 5s gate and 3s
   polling deadlines do not bound a stalled Prisma/connection call after release;
   Jest's 15s test timeout does not cancel that promise or execute remaining
   finally statements. The order transaction itself permits 15s, leaving no
   guaranteed teardown margin. Thus a failing harness can leave the global
   transaction spy installed while subsequent tests proceed. Use explicit bounded
   ownership/drain handling and guaranteed nested-finally restoration, with a
   documented fail-closed path for operations that cannot be drained; merely
   racing a timeout must not silently permit later tests/cleanup against live
   owned operations. Do not claim Promise.allSettled alone is bounded cleanup.

These are source-test readiness defects, not observed SQL failures. Return to the
original backend author; do not change product code or weaken existing assertions.

## Other contract observations

Fixture fields match current Prisma defaults: ACTIVE/READY ticket, default held0,
nonzero price and existing PENDING order creation. Actor organization/role match
service input; service-level tests do not qualify HTTP auth/tenant middleware.
Both lock orderings gate the post-lock event read, use the holder's actual backend
PID in pg_blocking_pids, assert blocking before release, then inspect final order,
stock and audit outcomes. This is meaningful planned real-SQL ordering rather
than a mocked lock; still NOT RUN. Requires spare pool capacity for holder, waiter
and observer in the future sole-disposable-DB execution environment.

FK injection reaches real audit create with nonexistent event UUID and expects
P2003. Because audit insertion precedes flag mutation, this is unchanged-state
failure atomicity, NOT proof that an already-written flag rolls back. Handoff is
accurate on this distinction. UUID historical replay after resume/conflict/new-key
no-op assertions match current service. Generic stale pause payload is sent after
committed pause and ignored by explicit update mapping; correctly bounded as
stale-payload coverage, not a separate overlapped writer-race proof.

## Actual checks and limits

- Inspected `check-source.cjs` before running: built-in fs/path/module/vm only;
  stripTypeScriptTypes plus unlinked/unevaluated SourceTextModule. No application
  imports or Jest evaluation.
- `node --experimental-vm-modules docs/team/evidence/task-493/check-source.cjs`:
  exit0, stripped syntax parse and ten static markers only. Node experimental
  warnings observed; no typecheck or behavior qualification.
- `git diff --check 6ab827bff6fdf67283b93f16612106f2217d4dc0 2a3de901c2297381c9ef5cb816405b0ec981cf9e`:
  exit0.
- Board claim and shared checkout/worktree state inspected before new isolation;
  main's unrelated untracked AGENTS/team files preserved.

SQL tests NOT RUN. No application imports/evaluation/Jest, runtime/services/DB,
generation/migration, network/install/env/secrets/config/scheduler/provider/
production/spend/push/merge/deploy. Type/client compatibility, actual rollback,
concurrency/auth/tenant/payment/access/scanner/recovery remain UNVERIFIED.
#493 stays REVIEW pending original-author repairs and exact-SHA independent lead
and QA review; no closure. Full #248/#243/launch remain OPEN.
