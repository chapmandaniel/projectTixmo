# Task323 — order lifecycle race contracts

Branch `tixmo/task-323-order-race-contracts`, intentionally based on accepted cancellation guard `f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d`, NOT bare4ec85948. Read task319 slice2 findings and current source/tests. No product changes relative to accepted base. Exactly four existing lifecycle race files changed; fifth executed suite is accepted328 seven-case regression, byte-identical. Other unmerged repairs not composed.

## Contract map / repair

- Confirmation fixtures now ON_SALE, not defaultDRAFT. Successful target ticket rows are SOLD/VALID; cancellation rows RELEASED/CANCELLED. Exact other scalar/identity/barcode fields retained with expected updatedAt Date, distinct other-buyer orders/tickets remain exact unchanged snapshots. Added distinct buyer fixtures to older duplicate-confirm/cancel cases.
- Double confirm and double cancel now explicitly require both public requests fulfill idempotently with correct scalar identity/status/payment, instead of old one-rejected assumptions. This is accepted current repeat semantics (source PAID return and328 currentCANCELLED exemption), not permission for double effects: both schedule/read orders retain exact held/sold/available conservation, target ticket identities/counts, foreign complete snapshots. Accepted328 regression separately asserts complete unchanged repeat snapshot.
- Confirm/cancel retains exactly one successful effect and one rejection across both winners/reversed pre-reads. Cancel stale observation remains400; confirmation after cancellation is current409 `Order can no longer be fulfilled`. Full inventory/foreign ledgers retained.
- Inconsistent hold keeps exact entire target/tickets/inventory rollback assertions; diagnostic updated to intentional409 `Order inventory is inconsistent`, not any-rejection acceptance.
- Old expiry harness selected an already-expired target and nevertheless expected confirmation success. Rewritten using fake-timers **Date only** (real timers/SQL stay native): before-expiry confirmation commits, then real later expiry-job scan must leave full paid fixture unchanged. After expiry, all four call-release/read-order permutations require actual confirmation409 and job's one RELEASED cancellation; no already-expired fulfillment. Actual job interval callback is captured, not replaced with a fake cancellation result. Repeated scans compare full post-cancel snapshots.
- Added actual expiry-job stale payment case: real public read, separate committed SQL paymentPROCESSING mutation, guard400 logged/caught by actual job, exact post-mutation full fixture unchanged; later real scan sees stablePROCESSING and cancels once, preserving foreign buyer and inventory. Third scan exact no-op. This qualifies that bounded actual job retry flow; it does not qualify event cancellation's event-commit-then-order-error recovery, which remains unresolved.

Barriers choose actual public read/commit ordering; five-second native timer deadlines bound harness failures, no longer arbitrary timeout. Existing SQL order locks/effects run unmocked; accepted328 inverse NOWAIT55P03 test remains the direct lock-exclusion control. Date-only clock avoids wall sleeps; order expiration2030 and foreign2050 are explicit, no window widening or service eligibility bypass. No source defect encountered in this focused slice; no financial/provider operations introduced.

## Runs and evidence

Exact command from worktree root each time:

```bash
bash docs/team/evidence/task-323/runtime.sh > docs/team/evidence/task-323/runtime.log 2>&1
```

Explicit five suite paths only, ordinary Jest/ts-jest/setup schema push to owned disposable DB, not full API gate.

- attempt-1:4 suites passed, expiry suite compile error (fixture array lacked Order[] annotation);18 tests passed. Retained raw failure artifacts; no barrier timeout or runtime source failure. One bounded compile repair, no assertion removed to hide error.
- attempt-2:5 suites/23 tests passed. Added actual stale-job retry case as requested bounded coverage.
- Final: **5 suites/24 tests passed,0failed/skipped/runtime-error suites**,14.087s, Jest/runtime exit0. All original per-order schedule permutations plus7 accepted328 controls included. No blocked-network records.

Focused Prettier applied to four owned tests. ts-jest compiled all selected suites. No production tsc/build/generate needed (source unchanged). Source/test versus whole-range diff checks retained separately in diff-checks.json; raw Prisma lock-control output is preserved even where it contains trailing whitespace. No raw logs rewritten to manufacture diff-checkPASS.

## Safety / cleanup

PM soleDB grant used; inspected task328 helper adapted to task323. Owned matching dependencies cp-a from333; no hardlinks/install/generation/shared writes. env-i before imports, synthetic keys, CHECKPOINT_DISABLE, preimport nonloopback guard, exact user/executable/runtime PID and listener checks, new disk-backed workspace/runtime/task323 roots0700, PG18+RedisDB1, explicitly disposable schema target only. No provider/network/AWS/credential access/spend/deploy/merge. A Node deny guard is not OS isolation.

cleanup.json verifies all three runs' six PIDs absent, six listeners closed, PG sockets/pidfiles and Redis sockets absent, no task323 Jest/engine workers. Runtime logs retain orderly shutdown. **DB lane released.** Hash provenance and accepted source/test identity verified. Independent source/test-contract plus fresh SQL QA exact-final-SHA still required; author submits review, not done. No full API/launch qualification or event-cancellation recovery claim.
