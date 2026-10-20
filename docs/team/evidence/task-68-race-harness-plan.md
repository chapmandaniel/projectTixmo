# Task 68: deterministic lifecycle race preparation

2026-10-19; lead documentation-only slice. Source baseline:
`3299e0cb569e7f7b042671370b2fbf4802445828`.
Branch `tixmo/task-68-race-plan`; no implementation or runtime claim.
Task 57 still blocks disposable-DB execution; task 73 owns paid-after-expiry
policy. Backend task 70 owns order-service changes concurrently. Rebase line
references deliberately before implementation, after its reviewed integration.

## Inspected evidence and reuse

Paths below are relative to the repository and line numbers refer to the base.

- `tixmoapi2/src/api/orders/service.ts:338-385`: confirm reads PENDING
  outside its transaction, decrements held conditionally, then updates order
  by ID only. Other orders' holds can satisfy the second decrement.
- Same file `468-529`: cancel checks status before its transaction; inventory
  and tickets change before an ID-only order update. `604-650`: bookkeeping
  refund snapshots PAID/tickets, decrements sold without lower-bound predicate,
  then updates order by ID. This method does not perform a financial refund.
- `tixmoapi2/src/api/payments/service.ts:164-179`: FAILED webhook reclaim
  is read then unconditional update. `182-183` skips PROCESSING regardless of
  age. `215-221` completes by ID without fencing. `236-275` reads the order
  before confirmation; different event IDs bypass per-event deduplication.
- `tixmoapi2/src/jobs/order-expiry.job.ts:14-34`: selects expired PENDING
  orders then calls cancelOrder. This is the expiry race entry, not a new
  eligibility policy. Its 30-minute comment differs from creation's 15-minute
  value (`orders/service.ts:210`); do not resolve that policy in this task.
- `tixmoapi2/prisma/schema.prisma:204-207,258-301,304-324`: available,
  held, sold counters; webhook ID primary key, processingStartedAt and updatedAt;
  tickets default VALID, including pending orders (do not assume pending means
  a distinct ticket status).
- Existing maintained dependencies suffice: Jest 29, Prisma 5/Postgres,
  Supertest 6, Stripe SDK, fake-timers 15 (`tixmoapi2/package.json`). No new
  harness library, orchestration service, lock service or paid platform needed.
- Reuse fixtures in `tixmoapi2/tests/integration/orders.test.ts:20-79` and
  helpers `tests/utils/testUtils.ts:32-107`; sequential lifecycle expectations
  at `orders.test.ts:322-401` are not races. Existing
  `tests/integration/concurrency.test.ts:90-119` launches requests without
  deterministic barriers; it cannot establish this stale-read interleaving.
- `tests/orders-tenant.unit.test.ts:1-35` fully mocks Prisma. Preserve its
  actor-fence regressions but never count it as DB evidence.
  `tests/unit/payments.webhook-recovery.test.ts:40-80` supplies fake signed-event
  construction/notification boundaries and sequential FAILED recovery examples;
  reuse external-boundary mocks, not its in-memory Prisma implementation.
- `tests/setup.ts:6-7` bootstraps schema through verification-safety. Read
  `scripts/verification-safety.cjs` and the local readiness gate before later
  execution. Do not invoke Jest merely to discover tests while 57 is blocked.

## Proposed deterministic real-DB harness

Add a focused integration suite only after runtime 57 is approved, with one
coordinated DB owner and an explicitly disposable local target accepted by the
existing safety guard. Use normal Jest runInBand, but two asynchronous service
calls and enough real Prisma connections for overlapping transactions. Mock
only Stripe event parsing and email/admin delivery; no mocked query results,
transaction commits, counters or status writes.

Use a test-local deferred gate with `arrived`, named `release`, bounded timeout,
and finally cleanup. Wrap the real Prisma read, await its actual result, signal
arrival, and delay returning that immutable snapshot to its caller. Both calls
must report the same expected original status before either proceeds. For the
base, gate each operation's initial order.findFirst; for FAILED retry gate
paymentWebhookEvent.findUnique after both fetched FAILED. Preserve and restore
original bound methods; filter gates by fixture IDs and expected call phase so
retry loops and observer queries cannot accidentally wait. Record phase traces.

Release A, await A's real commit, release B's stale result, then await both with
Promise.allSettled. Reverse releases in a separate case for competing actions.
This deliberately overlapping invocation/serialized-commit schedule reproduces
stale reads without timing luck. Also run a both-release case against real
Postgres row contention. Never hold a two-party gate after one participant has
acquired the order row lock: a corrected CAS would otherwise deadlock the test.
For a fix that moves reads into the transaction, put the admission gate before
transactions/conditional claims, not after locks. Assert gate arrival counts;
timeouts are harness failures, never acceptable lifecycle losers. No sleeps.

Fresh fixture per case: one ticket type with total 10, target A holding 2 and
unrelated pending B holding 2: available=6, held=4, sold=0. B must remain pending,
its tickets unchanged and held=2 after exactly one A terminal transition. For
refund cases first make A PAID (available=6, held=2, sold=2), retain B's hold.
Add a second paid order of the same type in a refund variant so a duplicate
refund can remain nonnegative yet still steal another order's sold inventory.
No assertions should rely on negativity alone.

## Case matrix and precise oracles

| Case | Forced overlap | Required post-fix result / loser |
| --- | --- | --- |
| Double confirm | Both read A PENDING | One effect: (available,held,sold)=(6,2,2), A PAID/SUCCEEDED, A tickets remain VALID; direct loser rejects stale transition with explicit conflict/bad-request contract, never mutates B. |
| Double cancel | Both read A PENDING | One effect: (8,2,0), A CANCELLED and all A tickets CANCELLED; direct loser rejects already-changed order. |
| Double bookkeeping refund | Both read A PAID/eligible tickets | One effect: (8,2,0), A REFUNDED, eligible A tickets CANCELLED; direct loser rejects non-PAID. USED-ticket handling remains existing behavior, tested separately without inventing policy. |
| Confirm versus cancel | Both read A PENDING; run each commit order | Exactly one terminal winner: paid tuple (6,2,2) with no cancelled A tickets OR cancelled tuple (8,2,0) with all A tickets cancelled. Loser explicit stale-transition rejection; never PAID with CANCELLED tickets. |
| Confirm versus expiry | Gate expiry candidate selection, then the cancel/confirm stale read boundary; both release orders | Same atomic one-winner safety oracle as above under existing eligibility only. Observe current winner, do not prescribe business precedence or permit paid-after-expiry; final policy acceptance waits on 73. Job catches/logs cancellation rejection, so inspect DB and captured error rather than requiring job promise rejection. |
| Distinct success event IDs | Two events, same intent/order; both reach order PENDING snapshot/confirm boundary | Both event rows durable; only one order effect. Losing webhook may succeed as an explicitly verified already-PAID/same-intent no-op, otherwise remains FAILED/retryable until reconciliation; never mark failed fulfillment PROCESSED. Capture exact selected contract before implementation. |
| Simultaneous FAILED retry | Same event ID, both read FAILED | One claimant executes fulfillment; other skips active claim without writing completion. One durable event row, one order effect, final PROCESSED after successful owner. |
| Crashed PROCESSING | Seed old PROCESSING row with unfulfilled pending A; no running worker | Base currently skips forever: document that reproduction. Proposed bounded lease recovery must reclaim exactly once, fulfill once and finish PROCESSED. Fresh PROCESSING must not be reclaimed. |
| Stale worker after recovery | Pause first owner before completion, expire lease, allow replacement then resume first | Old owner cannot finish/fail newer claim; verify fencing in DB plus no duplicate order effect. |

For every case read committed state through an ungated observer after both
settle. Assert each counter >=0 and available+held+sold=quantityTotal; exact
counter deltas; B's row/ticket snapshot unchanged; ticket cardinality unchanged;
no ticket creation/deletion; terminal order/ticket agreement. Compare expected
held and sold against all fixture orders, not just aggregate conservation:
double cancellation/confirmation can preserve conservation while corrupting
ownership. Refund eligibility currently counts only VALID/TRANSFERRED tickets;
include mixed statuses without asserting USED tickets become CANCELLED.
Capture return/rejection codes, event rows, phase trace, original/final snapshots
and exact tested SHA. Baseline must fail the regression oracle for the forced
schedule before any patch; a passing mock or nondeterministic Promise.all is
not reproduction evidence.

## Narrow transition proposals (not implemented)

After recorded reproduction, claim terminal status inside the same transaction
using conditional order.updateMany on id + actor scope + expected source status
(PENDING -> PAID/CANCELLED; PAID -> REFUNDED). Require count=1 before any
inventory/ticket effect. Throw on zero and roll back the transaction. Keep
existing actor authorization and response shape; fetch the resulting row when
needed. Restricting cancellation beyond current statuses requires explicit
contract review, not an incidental eligibility change. Guard sold decrements
with gte as defense in depth, not a substitute for the order claim.

FAILED reclaim should be conditional updateMany(status=FAILED), count=1 owns
processing. A stale PROCESSING proposal uses a finite lease and a fenced claim
version/token (or proven unique generation), conditional takeover, and completion
conditional on that generation. Existing processingStartedAt can be part of a
CAS but timestamp precision/uniqueness must be proven; never assume it is an
adequate fencing token. Lease duration/retry behavior needs an explicit reviewed
operational contract, and a paused owner must not overwrite a successor.
Per-event fencing does not replace per-order atomicity for different event IDs.
No financial refund call, scheduler/config change or expiry-policy adjustment.

## Actual verification and remaining work

Performed: source/test/schema/dependency inspection only. Documentation diff
whitespace and changed-path checks are recorded with the commit in task 68.
Not performed: DB reproduction, integration/unit test execution, source fixes,
lease implementation or proof of any concurrency invariant. Task 68 remains
TODO after this bounded slice; 57 blocks execution, 73 blocks expiry-policy
acceptance. Future implementation needs exact-SHA lead and QA reviews.
