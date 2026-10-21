# Independent technical review 366 - scoped SOURCE ACCEPT

Reviewed implementation harness `aea662245990c72a83395eb6720c375b394715f9`
and final author evidence `aba01c99de824638c5bbee96232cad1bb74dc518`.
Isolated branch/worktree `tixmo/task-366-old-window-source-review`, `task-366`,
base exact tested harness. No implementation authorship or runtime rerun.

## Findings

No blocking findings for the narrowly assigned local criterion:

- Compared accepted311 check.cjs with364 in full. Original controls retained;
  only task names/guard, same-row SQL aging/readback and truthful result label
  materially added. Worker create fsyncs file+directory then sends IPC before
  unresolved create promise returns. Parent deep SQL equals before snapshot
  (REQUESTED/null provider ID/PAID/SOLD) before killing exact fork handle.
- Awaited SIGKILL exit/reap precedes raw parameterized created_at UPDATE of SAME
  healthy refund. Readback proves >23h, metadata matches same ID, and deep
  equality of every other refund/order/ticket/inventory field. Recovery eligibility
  updatedAt remains unchanged by raw SQL. Separate old unmatched control remains.
- Replacement distinct owned process shares same DB/ledger. Provider call trace
  requires healthy list and zero creates; actual PaymentService recovery,
  reconcileRefund and OrderService finalization unmocked. Current source lists
  metadata match before applying 23h no-create cutoff, validates financial identity,
  and finalizes under order lock. Stock [1,0,0]/RELEASED, ledger cardinality one,
  replay zero transport/deep SQL equality/manual73 equality asserted.
- Product src/Prisma/scripts exactly match80c6710b. Changed refund ingress
  observation fence is not invoked by recoverRefunds; reviewed current real
  reconciliation/finalizer compatible. No shared client generation or install is
  invoked. Author records read-only task362 dependency reuse/schema normalization;
  dependency link already removed, so this reviewer does not independently claim
  generated-client bytes were checked or resolve dependencies anew.
- Runtime scrubbed env-i before imports; safety validator and owned loopback PID
  listener checks precede clients; fresh0700 disk runtime. Network guard is JS-only,
  not namespace isolation. Exact fork children, shell-owned Redis and PG identity
  fences plus bounded cleanup reviewed. Stripe transport/logger replaced and
  notification fail guard; no Prisma/financial-handler mocks.

## Evidence and actual checks

Fresh reviewer static commands exit0: bash -n runtime.sh; node --check check.cjs;
node --check network-guard.cjs; git diff --check80c6710b..aea6622;
git diff --exit-code80c6710b..aea6622 -- tixmoapi2/src tixmoapi2/prisma scripts;
git diff --exit-code aea6622..aba01c99 -- three harness files.

Inspected final author README and author acceptance/runtime/cleanup/hash artifacts
in task364 checkout. Four recorded worker PIDs distinct; replacement only intent/list,
replay zero calls, final unknown retry intent/list. Aged readback
2026-10-20T08:27:55.440Z remains REQUESTED/nullID before replacement.
Author runtime records PG3102139 Redis3102152 ports30080/55590. Fresh reviewer
ps found those, all workers3102244/3102267/3102290/3102313 and initial services
3101604/3101617 absent; ss current listeners empty; stat runtime mode700.
Socket/pidfile absence and blocked-attempt absence are inspected author cleanup
claims, not independently rechecked here.

README honestly discloses initial createdAt vs mapped created_at42703 failure,
one harness-only repair, overwritten original failure logs unavailable (not
fabricated). Schema maps createdAt to created_at and reviewed repair is correct.
No product bug or unexplained success assertion suppression found.

Verdict SOURCE ACCEPT only. Runtime logs are author evidence, not independent
QA or a fresh reviewer runtime pass. QA exact final SHA remains mandatory before
#364 closure. SQL aging is not elapsed24h/provider retention or listing completeness;
synthetic ledger is not Stripe/external money exactly-once, actual SDK timeout,
host restart, delivered fulfillment, concurrency or operational-owner acceptance.
#241 remains open; #231 integration ownership and #61/#250 gates preserved.

## Final evidence successor addendum

Final reviewed author evidence is `750b59836de3a294fb4bf7068730bb4ef3c5f754`.
Its sole change from aba01c99 is README correction: final artifact diff-check
is NOT clean because raw migrate.log:103 preserves trailing whitespace.
Fresh full commit-range diff-check reproduced exit2 at that exact line; three
harness files remain exactly aea6622 (diff exit0). This raw artifact whitespace
is nonblocking for SOURCE ACCEPT, not a claimed final diff-check PASS. The
source-only verdict and mandatory QA367 fresh runtime requirement are unchanged.
