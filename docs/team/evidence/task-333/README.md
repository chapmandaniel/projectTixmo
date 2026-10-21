# Task333 Stage B — UTC paid-sales bounds, focused RED/GREEN

Base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`, branch `tixmo/task-333-paid-sales-utc`. Stage A exact `4e98efb2d5b7255e72aabe8784b6cea036e420ae` is preserved in Git and stage-A-README.md. Source/test implementation remains byte-identical to Stage A (`61feda408cd721da6d60cc240400f99605855fba` product/test commit). PM explicitly granted sole DB ownership after QA332 cleanup; release334 remained source-only.

## Minimal fix and semantics

Only product change versus baseline is paid-sales-query.ts: each optional Date parameter becomes `(<bound>::timestamptz AT TIME ZONE 'UTC')`; indexed `o.created_at` remains bare. No session/global timezone alteration, date-window widening, column cast/function, or new financial default. Exact >=/<= inclusivity, status PAID, currency lowercasing, event/tenant filters, existing total_amount (including promo discount), SOLD ticket aggregation and LEFT JOIN retained. This fixes the specific proven326 UTC-naive-column/timestamptz mismatch, not every raw timestamp comparison.

## Actual execution, same test blob

Command from worktree root for each run:

```bash
bash docs/team/evidence/task-333/runtime.sh > docs/team/evidence/task-333/runtime.log 2>&1
```

Script runs only new `paid-sales-utc.test.ts` plus original `v1-market-smoke.test.ts` with ordinary candidate Jest setup/schema bootstrap, JSON reporting, bounded timeout and preimport denial guard. No full API gate/build/migration/generate performed. No global TZ override: both fresh disposable DBs reported default **America/St_Johns**, inherited from host initdb defaults, before application import. Each new SQL test uses transaction-local set_config(TimeZone,...,true), not pool-global state.

### Baseline sensitivity

Temporarily wrote exact `git show 4ec85948:tixmoapi2/src/services/paid-sales-query.ts` bytes for the baseline run, restoring fixed bytes in Python `finally` regardless of outcome. `red-source-identity.json` records baseline/fixed/test SHA256, exit1, sourceRestored=true and testUnchanged=true. No baseline substitutes for test data/query/provider results.

Baseline: **2 failed suites,3 failed/2 passed tests**, zero skipped/runtime errors;14.504s. UTC cases pass; both America/St_Johns date-boundary/DST cases fail semantically (missing expected IDs), and original smoke totalOrders>=1 fails actual0. Raw evidence retained under red-baseline/. No compile/timeouts/harness failure. No network denials. Both baseline services stopped before green began.

### Fixed source

Same new test blob and unchanged original smoke: **2 passed suites,5 passed tests,0 failed/skipped/runtime errors**, Jest and guarded runtime exit0;14.871s. Original smoke progressed beyond analytics through the remaining asset/approval path without changing its >=1 assertion or any fixture. Exact smoke blob verified identical to4ec85948. Fixed source and new test hashes verified again after both runs.

New SQL tests cover both UTC/StJohns sessions: exact start/end equality, +/-1ms exclusions, exact-point windows, one-sided start/end, actual PENDING/usd/foreign-tenant exclusion and exact event scope. Repeated Newfoundland01:30 has distinct named instants04:00Z (NDT−02:30) and05:00Z (NST−03:30), both actual PostgreSQL local labels asserted01:30 while exact UTC-point windows select the correct individual IDs and combined window includes both. Actual queries use paidSalesSource, not a mocked alternate query. Every case creates isolated UUID-scoped actual rows inside its locally configured transaction.

## Checks and isolation

Stage A production and prepared-test typechecks, pure guarded SQL-shape/value check and focused formatting passed (initial standalone missing-Jest-type diagnostics preserved, then config corrected). These source/test blobs did not change in Stage B, so no redundant typecheck claimed. Source/test-only and full staged-range diff-check results are separately retained in diff-checks.json, including any raw-log whitespace diagnostics without rewriting raw evidence. bash -n runtime.sh exit0. Source/provenance hashes retained.

Dependencies were already owned cp-a copies from task328, matching baseline schema/lock, distinct generated client inode/nlink1; no install/generate/shared writes. Inspected existing PG18/Redis helper from328 reused: env-i before imports; synthetic keys only; CHECKPOINT_DISABLE; hard preimport nonloopback guard with deny record treated as failure; exact owned user/executable/runtime PID and listener checks before access; new disk-backed workspace/runtime/task333 mode0700; disposable local DB and Redis DB1 only. No AWS/provider/credential access or external connection. Original smoke upload/provider mocks remain unchanged and inert. No blocked-network log exists in either run.

cleanup.json audits both exact PG/Redis pairs absent, all four TCP listeners closed, PostgreSQL sockets/pidfiles absent, Redis sockets absent, no task333 Node/Jest/query-engine workers. Runtime logs retain orderly shutdown. **DB ownership released.** Private disk roots remain only as stopped diagnostic data.

## Limits / handoff

Focused UTC normalization and original smoke are green, not full API/market readiness. No index EXPLAIN/performance claim; bare-column preservation is verified by fragment shape/source. Other analytics customer/date queries and general session/DST correctness outside paidSalesSource remain unqualified. No other unmerged fixes composed; no financial policy/other rawSQL sweep. Independent source+fresh SQL QA exact-final-SHA required before PM closes. Author submits review, not done. No cloud/spend/default-branch merge/deploy. Command-scoped Git identity and hook bypass only (fresh checkout lacks Husky helper).
