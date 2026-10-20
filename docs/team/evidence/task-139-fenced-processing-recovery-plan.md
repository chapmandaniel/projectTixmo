# Task 139: bounded fenced PROCESSING recovery contract

Documentation only, 2026-10-20. Base `9ac6db3d6a9080e445af78fda743e26c44fe7092`;
branch `tixmo/task-139-fenced-recovery-plan`, isolated `worktrees/task-139`.
Refines, rather than replaces, task 68 plan at `977848bcd5bbe5ce0377cae4916bf0966e088f59`.
No production source/schema changes, runtime, database or service execution here.

## Evidence and existing solution

Jest, Prisma/Postgres, Stripe SDK and existing deferred/AsyncLocalStorage gates
are sufficient; no new dependency, lock service, scheduler or paid platform.
Task 137, independently repeated by 138, proves old ownerless PROCESSING skips
forever: one deliberate ancient recovery RED and one fresh duplicate GREEN.
This is test-artifact acceptance, not readiness or a passing recovery regression.
The year-2000 fixture is not a lease choice. Reference paths/lines at this base:

- `tixmoapi2/src/api/payments/service.ts:128-153`: boolean admission, handler,
  unconditional finish/catch; `156-203`: FAILED CAS already fixed in 134,
  PROCESSING still always skipped; `206-223`: ID-only completion/failure.
- Same file `236-262`: order read and unguarded missing-intent binding;
  `265-309`: same-intent paid no-op, confirm retries, postcommit email;
  `322-336`: failure read then ID-only status update can overwrite a newer
  SUCCEEDED status. Fencing only finish or handler entry cannot protect these.
- `tixmoapi2/src/api/orders/service.ts:353-441`: actor scope, PENDING CAS and
  inventory in one transaction. Preserve this winner contract. Its independent
  transaction cannot simply be nested beneath a webhook transaction.
- `tixmoapi2/prisma/schema.prisma:287-301`: event primary key, status string,
  timestamps, but no attempt generation. `processingStartedAt` is neither
  unique nor monotonic; JS millisecond timestamps can repeat, clocks can move
  backward. Reject timestamp-as-token, including same-timestamp FAILED retries.
- `tixmoapi2/tests/integration/payment-old-processing.baseline.test.ts:10-66`:
  signed public handleWebhook with real signature validation/real Prisma;
  two buyers, four tickets, counters 6/4/0. Lines 57-62 intentionally contradict
  final recovery oracle 63-65 and MUST be replaced for the future recovery test.
- `tixmoapi2/tests/integration/payment-failed-retry.race.test.ts:9-17,35-139`:
  bounded gates, reversed claimant, real DB observers and sequential retry.
  Also retain distinct-success, double-confirm and confirm/cancel/expiry suites.
- Existing evidence: `docs/team/evidence/task-137-old-processing-baseline.md`
  and `task-137-processing-snapshots.json`; do not rewrite historical snapshots.

## Selected finite lease and attempt identity

Proposed implementation contract, subject to independent design review: fixed
300-second lease, no renewal/heartbeat in this slice. Time eligibility derives
from PostgreSQL time sampled once at claim (not sender event time or wall-clock
sleep). `processingStartedAt <= dbNow - 300 seconds` is expired, including the
boundary; greater is fresh. Tests cover both sides and the boundary. Lease is
an admission deadline, not cancellation of JavaScript or a guaranteed retry
within 300 seconds. Recovery occurs only on signed redelivery, no new poller.

Smallest necessary migration: add non-null Prisma BigInt `attemptGeneration`
(mapped `attempt_generation`) default 0 to PaymentWebhookEvent, retaining every
row/timestamp/status. New claims start at 1; legacy rows start at 0 until next
claim. Each successful new/FAILED/expired claim increments generation exactly
once in PostgreSQL; use atomic `increment: 1` with observed generation CAS.
No reset, reuse or delete/recreate of event rows in this lifecycle. PostgreSQL
signed-bigint overflow must fail closed, never wrap. Thus (event ID, generation)
is provably unique within the retained event lifecycle, not globally unique
across event IDs. No UUID probability or timestamp precision assumption.
No index required for primary-key redelivery; no extra lease/token/outbox table.
Migration/schema SQL review and disposable migration execution are future work.

Admission returns `{eventId, generation}` or skipped, not boolean. Existing
row: read status/generation; atomic conditional update on ID + observed generation
and (FAILED OR PROCESSING expired at sampled cutoff). Set PROCESSING, increment,
clear error/processedAt, set processingStartedAt=dbNow. count=1 owns observed+1;
count=0 skips, never rereads and adopts someone else's token. New create writes
PROCESSING generation1; P2002 skips. PROCESSED skips. Fresh duplicates return
normal no-op without any durable write or notification. Same-ID contenders from
FAILED or expired PROCESSING have exactly one winner, even equal timestamps.
Missing ID is rejected before mutation: signed Stripe events require stable IDs;
the current no-ID unfenced escape must not survive in recovery-enabled code.

## Fencing beyond bookkeeping: required, not an entry-only promise

Finish uses updateMany(ID, status=PROCESSING, generation=mine); sets terminal
status/processedAt/error only if count=1. Zero means lost ownership: no fallback
ID-only write, no retry under the newer token, no marking successor FAILED.
An owner failure records FAILED only under its token, then propagates original
handler error for redelivery. FAILED recovery receives a new generation. A stale
invocation losing ownership exits as a duplicate/no-op; distinguish ownership
loss from a fulfillment error and never turn it into a new admission attempt.

A pre-handler check alone has TOCTOU and is insufficient. Require a small
webhook transaction helper: SELECT the event row FOR UPDATE using parameterized
SQL, then validate PROCESSING + my generation + live lease under that lock.
Every webhook order mutation must execute on that SAME transaction client
before releasing the event lock. Takeovers update the same row, so cannot pass
a lock held by admitted DB work. Lock order is event then order/inventory;
never wait for notifications, external calls, gates or retry backoff under it.
A transaction admitted before expiry may finish after expiry; takeover waits
for its commit, then rechecks eligibility/status. This is serialization, not
forced interruption. Ordinary DB transaction timeouts still apply.

Required bounded refactor: extract the existing confirmOrder transaction body
into an internal transaction-client operation reusable by the webhook helper;
public actor-aware confirmOrder keeps its own transaction, scope and response.
Do not create nested independent Prisma transactions. Within the fenced webhook
transaction re-read the order and validate existing intent match; missing-intent
binding must be conditional and transactional, not ID-only after stale read.
Retain PENDING CAS before inventory changes. Retry starts a fresh fenced
transaction; lease/ownership loss terminates retry rather than retrying five times.
Same-intent PAID/SUCCEEDED is the existing no-op; other terminal outcomes retain
manual/error behavior, never manufacture successful fulfillment.

Failure handler order updates also run under the event lock and conditional
order predicate (matching intent and not PAID/SUCCEEDED), so a stale failure read
cannot overwrite successful payment status. A distinct event can have its own
valid generation: per-event lock is not cross-event exclusion; use conditional
order writes/row locking for those races too. Keep existing mismatch/admin and
manual reconciliation semantics, not a new financial policy. Read-only work may
occur outside locks but cannot authorize later writes without transactional reread.
Completion can be a separate fenced update; a crash after order commit is
recovered through the same-intent paid no-op, without reconfirming inventory.

## Exact guarantees and exclusions

- Per event: a single current generation, fenced terminal writes and fenced DB
  admission; stale workers paused before a DB mutation or completion cannot
  mutate a successor. An old transaction that already acquired the lock commits
  before, not after, the successor acquires ownership.
- Per order: existing conditional PENDING transition/inventory transaction gives
  at most one confirmation effect, including distinct event IDs; it is not an
  event lease guarantee. Preserve full other-buyer state, counters and tickets.
- Email/admin: outside transactions. Only a successful transition winner attempts
  confirmation email; a paid no-op does not resend it. Ownership recheck before
  delivery can reduce stale sends but cannot atomically fence an external send.
  Crash after commit before email can lose email; provider acknowledgement gaps
  can make delivery ambiguous. No exactly-once delivery, durable email retry or
  exactly-once external side effects claimed. Payment-failure/admin notifications
  can repeat on redelivery. Outbox/provider dedupe is not part of this slice.
- No provider actions, refund, new paid-after-expiry behavior or authorization
  expansion. Preserve decision73: no-org ADMIN global only, no global OWNER;
  promoter scoped confirm/own-order cancel; late-paid explicit manual
  reconciliation without automatic refund. Keep tenant/actor/payment negatives.

## Before implementation: deterministic real-DB regression and mutation oracle

Next dispatch is TEST-ONLY stale-worker reproduction, with PM-assigned sole
owned disposable runtime and the reviewed 135/137 guards intact. No runtime
is assigned by this document. Reuse 137 signed payload/fixture/snapshots, not
mocked Prisma results; mocks only notifications. Use invocation-labelled bounded
deferred gates and real observer reads. No sleeps/fake claim result or fabricated
commit. Restore spies/release gates in finally; timeout is harness failure.

1. Preserve fresh PROCESSING full-row/order/inventory equality and zero-email
   control. Convert ancient test by removing ONLY contradictory lines57-62;
   assert PROCESSED/PAID/SUCCEEDED, 6/2/2, one email attempt, unchanged other
   buyer/tickets/cardinality, one event, conserved nonnegative inventory.
2. Pause A after actual claim commits but BEFORE handler DB admission. Use an
   explicit test-only clock seam or owned fixture timestamp update to expire its
   lease deterministically; record intervention. B redelivers same signed event,
   takes over and fulfills. Resume A. Assert no A handler mutation/notification,
   no second confirmation, and B's full event/target snapshot unchanged.
3. Pause A AFTER committed fulfillment but BEFORE finish (outside event lock).
   Expire lease; B takes over, sees PAID same intent and finishes without another
   email. Resume A success finish, then separate variant with A forced error
   finish: neither can alter B generation/status/error/processedAt. Compare full
   snapshots and actual attempted write counts, not just final PROCESSED status.
4. Failed recovery: B owns expired event but fails before order commit (bounded
   injected handler error, not a DB mock); expect FAILED with B token/error,
   original inventory and propagated error. C retries, gets strictly greater
   generation, succeeds once; late A/B success/failure writes affect zero rows.
   Include simultaneous expired claim contenders, reversed winner, fresh cutoff
   and exact cutoff, plus two FAILED claims with identical timestamps.
5. Handler TOCTOU: pause old failure worker after real order read; newer success
   commits, resume failure. Assert SUCCEEDED never overwritten. Under corrected
   lock placement gate BEFORE lock acquisition, not while holding event/order
   locks awaiting a successor. Also pause missing-intent binding read and resume
   after takeover; prove transactional ownership recheck prevents stale write.

Before recovery implementation commit, commit actual baseline failing assertions,
traces and snapshots for schedules possible on 9ac6db3 (old PROCESSING blocks B;
completion/failure remain unfenced). Do not pretend baseline can already acquire
a nonexistent generation: phase-specific tests may fail at takeover first. Once
candidate exists, prove later fencing assertions via bounded local mutations:
(a) skip expired admission => ancient recovery RED; (b) remove generation from
finish => stale success AND stale failure overwrite oracle RED; (c) remove
transactional handler fence => before-handler/missing-intent/failure-write RED;
(d) reuse generation across attempts => equal-time retry RED; (e) remove claim
CAS => two-claimant RED. A timeout is not a mutation kill. Run each mutation to
the relevant durable-state assertion; restore candidate byte-for-byte and rerun.
These are planned checks, not tests performed by task139.

## Smallest implementation slice and review handoff

Sequence: independent design review -> signed stale-worker TEST-ONLY reproduction
and exact-SHA QA -> bounded implementation -> exact-SHA lead + QA DB review.
Implementation owns payments/service.ts, extracted internal orders/service.ts
transaction body, one generation schema/migration, focused unit/integration tests
and evidence only. No generic lifecycle redesign, default merge or deployment.
Do not enable expired takeover as a bookkeeping-only patch: whole-handler DB
fencing above is a required acceptance condition, not deferred optimism.

Future checks: focused old-processing/stale-worker/FAILED-retry/distinct-success
suites, relevant signature/recovery/tenant/payment negatives, API build, disposable
migration validation; commands/actual outcomes and cleanup must be recorded.
Task139 actual verification: source/schema/test/board inspection and static
Markdown link/changed-path/whitespace checks only, recorded in board handoff.
No DB tests/build/migration executed; no concurrency or recovery success proved.
Task68 remains open, release remains NO-GO; PM alone may close reviewed139.
