# Independent lead review 358

Verdict: **bounded APPROVE** exact target
`7e01d57fa90426ad37fd9837aa0a387f7f39ae1e`, compared with accepted baseline
`2d7490a45685f7dd66a50bf4d7bda1d38c2685ce`.
Reviewer: tixmo-lead; isolated branch `tixmo/review-358`, separate review-358
worktree. Reviewer did not implement this backend change. This approval is
source/evidence review only, not fresh SQL execution, full API acceptance,
parent task closure, integration or release authorization.

## Scope and preserved guarantees

Actual diff is one historical integration test plus task-325-legacy evidence.
Product source, Prisma schema/migrations and dependency manifests/locks have
empty diff. The existing 13-case current-path test is byte-for-byte identical;
manual/fairness test sources are also unchanged.

Reviewed the complete old and new historical suite and accepted OrderService,
PaymentService and inventory finalizer code. Both explicit observation-release
schedules retain two real scoped reads, both initial PAID snapshots, opposite
query/release ordering, exactly one fulfillment and one stale 400 rejection.
They retain exact paid and pending foreign-buyer order/ticket snapshots,
complete target ticket equality by original sorted rows, unchanged payment
status, nonnegative/conserved counters and exact final counters [6,2,2].
The new processor-bound SOLD fixtures and inert Stripe seam reach current
provider-confirmed finalization rather than bypassing it. New assertions demand
one provider create and a durable SUCCEEDED amount-2000 ORDER_REFUND ledger.
These schedules are observation overlap, not simultaneous lock-contention
proof; the unchanged current-path suite supplies separate real contention.

Both original stale status and stale paymentStatus cases retain complete
changed-order/ticket and stock row equality, and add absent ledger/provider
calls. No blanket SUCCEEDED payment eligibility rule is invented.

The rollback case now uses two valid SOLD tickets against only one sold unit,
reaching the accepted inventory conflict 409 rather than obsolete bookkeeping
500 or invalid-ticket precondition 400. Exact order/ticket equality is retained
except the explicitly durable PROCESSING marker/timestamp; complete stock row
is unchanged. Current source commits request marking and provider SUCCEEDED
ledger separately before transactional local finalization, so preserving that
ledger is correct and reverting external financial success would be wrong.

Success compares every original scalar/payment field with explicit terminal
refund status, every cancelled/released ticket field and exact inventory.
Retry idempotency matches accepted source: no second provider create, identical
scalar order and stock. Invalid mixed USED/TRANSFERRED success fixture was
replaced by valid tickets plus two separate explicit denial cases; those compare
entire original order/tickets and stock, absent ledger and zero provider calls.
This is current-contract coverage, not dropped security or financial assertions.

Minor evidence precision limit, non-blocking: retry tickets use arrayContaining,
not exact cardinality, and extracted retryEvent is not asserted. Original suite
had no successful retry DTO guarantee; exact persisted order, prior exact ticket
rows, no second provider effect and unchanged stock retain its financial intent.
Do not claim exhaustive relation-DTO validation from this assertion.

## Actual evidence inspected (not rerun)

Parsed committed raw JSON independently:

- initial-jest-result.json: 2 SQL suites, 20 pass, 1 fail, 0 skipped. Failure is
  the disclosed retry scalar equality receiving extra existing event/ticket
  relations, not a product failure. Initial raw log/runtime are retained.
- jest-result.json: 2 SQL suites, 21 pass, 0 fail, 0 skipped, success true;
  historical suite 8 and unchanged current suite 13.
- focused-result.json: 2 suites, 17 pass, 0 fail, 0 skipped, success true;
  recovery fairness 6 and manual late-paid 11. Combined final author count 38.

One bounded test-shape repair extracts retry scalars, compares them exactly and
checks returned tickets/persisted order. No hidden source repair is present.
External-refund six-case suite and full API gate were not freshly run here.

Reviewed runtime script, preimport guard and cleanup evidence: scrubbed env-i,
0700 fresh owned loopback PG/Redis DB1, synthetic-only values, inert provider,
existing independent writable deps/no installs or generation, timeouts,
identity-checked bounded service cleanup and fatal nonempty network-block log.
Guard is JavaScript accidental nonloopback defense, not OS-wide isolation.
Reviewed cleanup.json covers both attempts. Read-only live corroboration found
PIDs3066623/3066636/3067341/3067354 absent; ports29781/52632/26608/42314 had no
listeners, both recorded runtimes had no postmaster pidfile or socket remnants.
No DB/service/runtime started by reviewer; universal cleanup fault-injection
or concurrency/provider guarantee is not claimed.

## Reviewer checks

- Complete historical suite diff and accepted source paths inspected.
- Product/schema/dependency empty diff; current13 exact byte parity PASS.
- Existing manual/fairness source unchanged; both recorded lock/schema SHA256
  values independently recomputed and matched. Generated engine not read here.
- `git diff 2d7490a HEAD --check`: PASS.
- `bash -n docs/team/evidence/task-325-legacy/runtime.sh`: PASS.
- `node --check docs/team/evidence/task-325-legacy/network-guard.cjs`: PASS.
- Raw JSON counts and disclosed initial failure independently parsed.

Independent fresh SQL QA359 remains required before PM closes325. Composed
candidate/full API gate remains separate and was historically FAIL. No product
edits, runtime, DB connections, install, provider, cloud, config, spend,
merge/push/deploy or self-approval of task356 occurred in this review.
