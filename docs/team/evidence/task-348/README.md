# Task348 independent fresh SQL QA

Bounded APPROVE exact candidate `2ac9a4b033638916f7fafe4fe49c1e07d76d0718`, 2026-10-21. Isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-348`, branch `tixmo/task-348-independent-qa`, based exactly on candidate. Only task348 evidence added; source, schema and tests unchanged. Parent325 remains PARTIAL REVIEW and must not be closed by this review.

## Actual independent execution

Read role/repository/team instructions, tasks348/325/347, final task-325-contention continuation (not stale initial task325 README), and lead347 artifact `9fb3aa58daf3273d33a484e3e7256c12e1c163ca`. Inspected entire current9case suite, runtime/guard, test setup and actual PaymentService reconciliation and OrderService finalization paths. No custom product solution needed; reused inspected offline runtime/test tooling.

Before startup independently checked author cleanup PIDs3011288/3011301/3012034/3012047/3012577/3012609 absent via /proc and ports29202/44872/36649/56913/26586/50814 empty via ss. Live process scan found no task runtime owner (only inspection command itself). PM sole disposable-local DB grant used.

Copied existing offline task325 API node_modules using `cp -a --reflink=auto ...`; independent writable generated client index linkcount1/mode600. No download, shared generated-client change or symlink dependency reuse. Inspected runtime then copied it to task348 evidence, changing only runtime disk root to task348 and output artifact directory. Synthetic fixture/database identifiers deliberately remain325. Guard copied unchanged. `bash -n runtime.sh` and `node --check network-guard.cjs` PASS.

Exact execution from this worktree:
`bash docs/team/evidence/task-348/runtime.sh > docs/team/evidence/task-348/runtime.log 2>&1` exit0.
Runtime uses env-i before imports, synthetic values only, preimport nonloopback denyguard, mode0700 disk directory under authorized task348 path, fresh owned loopback PostgreSQL18 and Redis, 100s Jest command limit and inert Stripe/notification mocks only. Redis exists but is globally mocked in suite, not real Redis behavior qualification.

Fresh actual SQL: **1 suite,9PASS,0FAIL,0SKIP,6.783s** (suite6.514s); raw JSON/log retained. Target9case test file unchanged, verified `git diff --exit-code 2ac9a4b -- tixmoapi2/src tixmoapi2/tests tixmoapi2/prisma` exit0; hash retained.

## What the fresh pass establishes

Actual PostgreSQL transaction holds order row FOR UPDATE. Query observes at least2 blocked order-lock queries through pg_blocking_pids, allowing queue chains; provider has not been called under block. Both provider create invocations enter before either response gate opens. Exactly2 invocation keys match the single durable ledger; inert keyed Map yields1 synthetic effect. Both requests fulfill; one ledger SUCCEEDED amount2000, counters10available/0held/0sold, ticket every checks CANCELLED/RELEASED; full subsequent replay snapshot equality and no third create. This demonstrates application key reuse and local once-only finalization, not one provider invocation or real Stripe idempotency.

Foreign buyer has distinct event/type; complete foreign order including sorted tickets, stock and refund ledger before/after equal in both new cases. InsufficientSOLD case rejects409, preserves complete stock/ticket rows, order equal except refundStatusPROCESSING/updatedAt, and exactly1 durable SUCCEEDED refund with correct amount/order/intent/reason. This is local finalization rollback with durable provider evidence intentionally preserved, not external money rollback.

## Chronology and sensitivity limitations

Independently parsed preserved author initial7PASS2FAIL/successfalse; compile0tests/successfalse; final9PASS/successtrue. Initial direct-blocker-only probe missed queue chain; failed-test undrained calls caused subsequent provider-ID collision. Final query allows blocker chains, finally releases/drains, unused blockerPid removal resolves TS6133. Existing7cases unchanged; no product repair in candidate. Historical failures are retained in candidate evidence, not relabeled current failures or omitted.

Explicitly concur with lead347 limitations: overlap every(ticket) has NO independent ticket cardinality, IDs or full changed-row assertions; empty/deleted tickets can pass that line. Earlier sequential length2 does not cure this overlap-specific gap. Snapshot equality after replay only protects the already-observed poststate. No independent mutation/sensitivity run performed; bounded demonstrated current-source path only, not comprehensive ticket preservation qualification.

Foreign controls exclude event-row snapshots, shared-stock isolation and intermediate/transient effects. Waiter probe is not exact targetPID/order scoped; adequate isolated single-suite positive-path observation, not general diagnostic. Unexpected blocker rejection in finally can skip settled drain; no universal failure-cleanup proof. No inverse schedule, slow-provider terminal-monotonicity, broader rollback tiers/promos/recovery, route actor matrix, manual/fairness, fullAPI/fullgate or release acceptance inferred. No live provider guarantee.

## Independent cleanup and boundaries

Runtime trap stopped owned PG3021349/Redis3021404. Independently checked both /proc PIDs absent, ports36459/44086 no listeners, socket/pidfiles absent, no process command references exact owned run directory; cleanup.json records this and0blocked network records. Runtime directory retained mode0700 on disk. Database RELEASED; unrelated services untouched.

`git diff --check` PASS. Commit uses command-scoped synthetic Git identity and core.hooksPath=/dev/null for known missing Husky bootstrap; no hook-gate success claimed and no persistent Git config changed. No source/test edits, secret access, real Stripe/email/provider calls, cloud/spend/config/scheduler/push/merge/deploy. Only348 scoped independent review may finish;325 broader work remains open.
