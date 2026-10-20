# Task 118: atomic cancellation transition

Base: `64a22b5d9514512407bdb0e1bda78c4ea683a83a` (accepted task 115).
Branch: `tixmo/task-118-double-cancel-fix`; isolated `worktrees/task-118`.
PM explicitly granted sole source and disposable-runtime ownership. Existing
Jest/Prisma libraries and accepted real-read race harness reused.

## Product change

Cancellation claims its observed status and paymentStatus atomically, scoped by
existing actor fence and optional buyer constraint, before inventory or tickets.
A lost claim yields ApiError 400. Pre-read PAID/CANCELLED/ownership/not-found
checks remain unchanged. This preserves existing eligibility for other statuses;
it adds no refund or broader lifecycle policy. The returned shape is the same
plain persisted order, now read after ticket/inventory updates. All changes share
the transaction, so inconsistent holds roll the claim back. Confirmation source
and its accepted guard are unchanged.

## Actual author verification

- Before edits: `bash /tmp/task115-runtime.sh > /tmp/task118-baseline.log 2>&1`,
  exit 1, 2 cancel failures / 2 confirm passes, 4 total, 6.355s.
  Both cancellations fulfilled; actual inventory `[10,0,0]` vs `[8,2,0]`.
- Final: `bash /tmp/task118-runtime.sh > /tmp/task118-fixed.log 2>&1`,
  exit 0, 3 suites / 35 tests passed, 6.603s. The helper differs only by adding
  `tests/orders-tenant.unit.test.ts` to the accepted helper's test command.
  Exact Jest command: `npm --prefix tixmoapi2 test -- --runInBand --runTestsByPath
  tests/integration/order-double-confirm.race.test.ts
  tests/integration/order-double-cancel.race.test.ts tests/orders-tenant.unit.test.ts`.
- Both normal and reversed cancellation schedules: inventory `[8,2,0]`, one
  success, one defined 400 loser, target/tickets CANCELLED, payment unchanged,
  unrelated same-type pending order and full ordered-ticket snapshot unchanged.
- Both confirmation schedules remain GREEN `[6,2,2]`, one success/one 400.
- Real DB inconsistent-hold test verifies full order/tickets/inventory unchanged
  after 500, proving rollback of the early cancellation claim.
- Two real DB stale snapshot tests persist PAID/SUCCEEDED or payment PROCESSING
  after the actual read; cancellation rejects 400 without changing any record.
  These test compare-and-set protection, not a new payment-state eligibility rule.
- Focused unit contracts: scoped stale claim rejects before side effects, paid
  and cancelled prechecks, wrong buyer forbidden, unchanged response shape;
  existing tenant, actor, handler and confirmation contracts pass.
- `npm --prefix tixmoapi2 run build > /tmp/task118-build.log 2>&1`: exit 0
  (Prisma generation, tsc, tsc-alias). `git diff --check`: exit 0.

## Runtime ownership and cleanup

Inspected approved helper `/tmp/task115-runtime.sh`, sha256
`e3f2ba99fe0f80bb93af36c6e25e2a04349bf55abce4949d5d5509ff3d26076a`;
expanded helper sha256 `f58d331ddc9fbe0607d9e31db4a8acd7378abe8c4857d00b56e3a5089dfc5938`.
Fresh native disposable PG/Redis only, exact UID/exe/PID/datadir/direct-child and
loopback listener checks before DB access, verification safety guard, no inherited
DATABASE_URL or unknown database. Exact-instance EXIT cleanup succeeded:

- Baseline PG845186/34765, Redis845199/40989.
- Initial fixed 33-test pass PG846077/28933, Redis846090/44936.
- Final 35-test pass PG847010/25514, Redis847023/59969.

Independent post-run `ss` checks all six ports empty; `ps` finds all six PIDs
absent. Final runtime postmaster.pid absent, PG shutdown and Redis exit logs
confirmed. Dependency symlink removed after verification, no dependency changes.

## Limits and handoff

Native PostgreSQL18/Redis8 rather than CI14/7; existing global Jest Redis mock.
Race tests use deterministic gated stale real reads, not simultaneous lock stress.
No full API/market gate, all lifecycle races, webhook recovery, browser, financial
refund, production, merge or deploy claims. No config/schema/lockfile edits.
Submit REVIEW only: independent exact-SHA QA AND lead acceptance required.
Task 118 and broader 68 must not be closed by author.
