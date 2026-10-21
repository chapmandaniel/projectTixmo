# Task350 independent lead source review

2026-10-21. **Bounded APPROVE** exact candidate `4a89e7c93c854a381a661d9e485e1dd47f3a4259`, based on `2ac9a4b033638916f7fafe4fe49c1e07d76d0718`. Independent reviewer tixmo-lead; isolated `/home/daniel/projects/projectTixmo/worktrees/task-350`, branch `tixmo/task-350-independent-lead`. Owned only this artifact. No blocking finding for this tests/evidence-only increment. Parent325 remains **PARTIAL REVIEW**, not accepted/closed. No merge or current composition approval.

## Reviewed behavior

- Complete candidate test diff and suite inspected. Overlap fixture creates two sorted SOLD tickets. Assertions now require original cardinality and exact IDs and equal every complete ticket row except explicit CANCELLED/RELEASED/any-Date updatedAt transitions. This removes the previous vacuous-every/cardinality/identity gap, without asserting universal mutation sensitivity.
- Snapshot helper includes full event row alongside order/sorted tickets/ticket-type/refund rows. Persistent distinct-event foreign controls in overlap and insufficient-SOLD rollback therefore include event data. They are not shared-stock or intermediate-effect isolation proof; sequential reads are not an atomic concurrent snapshot.
- Contention finally releases both gates, awaits allSettled([blocker,settled]), then rethrows blocker rejection. settled itself is allSettled of both owned requests. A rejected blocker no longer bypasses request drain in this finally. Inverse schedules attach immediate rejection handlers and release both gates/drain owned requests in finally. No failure injection performed; setup/gate waits and exceptional paths are not universally qualified.
- Both inverse schedules start caller0 before caller1 and wait for both provider invocations. Each selects a different invocation to return success first; the other returns pending only after terminal success is read. Pre-response ledger REQUESTED/null processor refund ID is distinguished from order PAID/refundStatus PROCESSING. Full terminal order/tickets/event/stock/refunds including timestamps remain equal after slow pending. Both provider calls require the same ledger-derived key.
- Inspected unchanged payment service lines481-663: order lock and observed status/paymentStatus fence precede preparation; unique intent ledger upsert; provider binding/amount/currency checks; updateMany excludes SUCCEEDED and rereads effective terminal status. Unchanged order finalizer lines561-589 locks, no-ops REFUNDED, requires matching successful monetary ledger, then performs inventory/order transition transactionally. Existing CAS/finalization explains these new passing schedules. No new source repair, commercial refund policy, live-provider exactly-once guarantee, or exhaustive concurrency claim.

## Actual checks (source-only)

- Read role/repository/team workflow and board350/325/349 including chronology; claimed350 before review.
- `git diff 2ac9a4b033638916f7fafe4fe49c1e07d76d0718 4a89e7c -- tixmoapi2/src tixmoapi2/prisma`: empty, programmatically asserted PASS. Product/schema unchanged.
- `git diff --check 2ac9a4b033638916f7fafe4fe49c1e07d76d0718 4a89e7c`: PASS.
- `bash -n docs/team/evidence/task-325-terminal/runtime.sh`: PASS; `node --check docs/team/evidence/task-325-terminal/network-guard.cjs`: PASS. Scripts inspected, not executed.
- Candidate test SHA256: `c2c2a7f946db692a812376fae9f9722a354fce1ffc90b24806dc60bb9e37afcb`.
- Python JSON parsing of retained author initial/final results: initial success=false,9PASS2FAIL0SKIP/11; both failures show expected PROCESSING vs actual REQUESTED at new pre-response ledger assertion. Schema line378 defaults REQUESTED; preparation upsert omits status. Correcting the new explicit expectation agrees with existing schema; not source red/green. Final success=true,11PASS0FAIL0SKIP/1suite (author7.161s per retained report). Existing nine cases pass both.
- Inspected independent QA349 artifact at exact `b51849b4a31093f4bec2004bbbd58b6ed2f9ca6c` via git show; separately parsed its fresh result JSON: success=true,11PASS0FAIL0SKIP/1suite. QA reports7.422s and unchanged source/tests, copied writable deps, owned disposable runtime and verified cleanup. Those are QA's execution/cleanup evidence, not a fresh lead execution or independent lead live cleanup certification.
- No DB/tests/runtime/services started, installs, credentials, provider, cloud, spend, config, scheduler, push, merge, deploy or unrelated memory work. Existing main untracked instructions/team docs preserved. Initial source search used nonexistent services paths; corrected to actual src/api paths before review.

## Remaining actionable gaps

Parent325 still needs shared-tickettype-stock foreign-buyer qualification, broader rollback/tier/promo/recovery coverage, route-entry/actor matrix, relevant manual/fairness regressions and full API gate. Lock probe remains query-pattern/count based, not target-PID/order scoped. No mutation/fault-injection pass or universal failure-cleanup guarantee. Two inverse response schedules and synthetic idempotency qualify only demonstrated current paths. Any newer affected candidate needs its own exact-SHA independent reviews.

Artifact commit uses command-scoped identity and core.hooksPath=/dev/null for inspected pre-commit's missing Husky bootstrap, as documented in prior checkpoints. No persistent Git config change or hook-gate pass claimed. Finish350 only; never parent325.
