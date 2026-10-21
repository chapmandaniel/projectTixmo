# Task 339 independent source-contract review

Result: **APPROVE - bounded source/test-contract scope only**.

Reviewed implementation: `232532dcbb143323d42d508a17bfc7ba8965bd23`.
Accepted base: `f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d`.
Reviewer: tixmo-lead; isolated branch `tixmo/task-339-source-review`.
No application/test edits, database access, services, runtime tests, merge or deployment performed.
This is not task323 closure, fresh SQL verification, full lifecycle acceptance or release approval.

## Independent findings

- Entire `tixmoapi2/src` and Prisma tree and accepted seven-case
  `order-cancel-stale-observation.test.ts` have no diff against accepted base.
  Public cancel still compares actual authorized pre-read status/payment to
  locked current state, refuses changed observations with400, and exempts
  already-CANCELLED replay. No eligibility/source workaround was introduced.
- All four changed race files reviewed in full and against base. ON_SALE
  replaces ineligible default-DRAFT success fixtures; expiry is not widened.
  Ticket comparisons retain exact original identity/barcode/scalars, with only
  expected SOLD or RELEASED/CANCELLED and updatedAt changes. Exact stock
  counters remain [6,2,2] for sale and [8,2,0] for cancellation; distinct
  foreign-buyer order/ticket complete snapshots remain unchanged.
- Confirm/cancel covers both winning commits crossed with both public-read
  completion orders (four cases). Exactly one fulfillment and one rejection
  remain required, with exact400 stale-cancel or409 unfulfillable-confirm
  diagnostics. Duplicate cancel covers both commit/release orders with reversed
  reads; duplicate confirm retains both read-completion orders, with caller0
  committing first in each. Do not describe duplicate-confirm as two distinct
  commit orders or these pre-read gates as simultaneous transaction contention.
  The unchanged accepted328 NOWAIT case provides separate actual lock control.
- Duplicate operations now require *both* requests to fulfill with the correct
  order/status/payment, not merely any outcome. This matches unchanged source:
  confirm returns PAID before eligibility checks and cancel returns CANCELLED
  before effects. Exact inventory and target/foreign rows still prohibit double
  effects. No material conservation/ownership assertion was removed.
- Inconsistent-hold cancellation keeps full order/tickets and ticket-type
  snapshot rollback equality. Expected409 `Order inventory is inconsistent`
  is precise, not an arbitrary-error allowance. Existing stale PAID/PROCESSING
  rollback snapshots remain.
- Actual expiry `startOrderExpiryJob` callback is captured through setInterval;
  interval60000 is asserted and real scan/cancel logic executes. Date alone is
  controlled (native timers and SQL remain); before-expiry paid confirmation
  survives a later actual scan unchanged. After expiry all four release/read
  permutations require confirm409, actual job success without logged errors,
  exact one release and unchanged foreign buyer. Repeat scan equals full prior
  snapshot. This is callback qualification, not an elapsed wall-clock scheduler
  or production-worker qualification.
- Added stale-job case performs a separate committed SQL PROCESSING mutation
  after actual public observation; actual job catches/logs exact400, with full
  post-mutation fixture unchanged. Stable next scan cancels once; third scan is
  exact no-op. It does not claim payment-provider reconciliation correctness.

## Evidence checked (read-only)

Commands executed from the isolated review worktree:

- `git diff --exit-code f8bac3e 232532d -- tixmoapi2/src tixmoapi2/prisma tixmoapi2/tests/integration/order-cancel-stale-observation.test.ts`: exit0.
- `sha256sum -c docs/team/evidence/task-323/source-provenance.sha256`: exit0, all six entries OK.
- `git diff --check f8bac3e 232532d -- tixmoapi2/tests/integration`: exit0.
- Python parsed author final Jest JSON: success=true, five suites/24 tests,
  zero failed/pending/runtime-error suites; counts by suite5/6/7/4/2.
  This is inspected author evidence, NOT an independent rerun.

Read author README, runtime helper, final results, provenance and cleanup
records. Helper targets explicitly owned disposable local PG/Redis, scrubs
inherited environment, checks exact process/listener ownership, and uses a
preimport network guard; no claim of OS network isolation. Cleanup records
three runs with absent service PIDs/listeners/sockets and no remaining workers.
These are historical author records, not newly established live runtime facts.
Attempt1 compile failure and attempt2 23-pass history are disclosed, as is
whole-range diff-check exit2 from retained raw-log trailing whitespace.
Independent fresh SQL QA remains task340's responsibility.

## Explicit unresolved acceptance boundary

**Event-cancellation recovery remains unresolved and is NOT approved.**
`events/service.ts` cancelEvent commits event=CANCELLED first, then processes
orders and calls public cancelOrder for pending rows. A concurrent status or
payment change can make that public call reject after the event commit; this
review adds no event-level recovery/retry evidence, atomicity guarantee, or
financial policy decision. Although source permits re-entry for CANCELLED
and re-enumeration, that alone does not qualify the failure/recovery path.
PM must preserve this open acceptance gap; do not close broader lifecycle,
event cancellation, full API or launch gates using this approval. No source
changes requested within the four-fixture modernization scope.

Review-artifact commit note: initial commit attempts failed because this
isolated checkout has no Git author identity and the installed Husky hook
sources a missing `.husky/_/husky.sh`. Used command-scoped role identity and
`git -c core.hooksPath=/dev/null commit` for this documentation-only artifact;
no persisted Git configuration changed and no product checks claimed.
