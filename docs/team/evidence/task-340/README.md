# Task 340 independent QA: APPROVE (bounded)

Reviewed exact `232532dcbb143323d42d508a17bfc7ba8965bd23`, based on accepted guard `f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d`.
Branch `tixmo/task-340-independent-qa`; isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-340`.

## Fresh command and results

`bash docs/team/evidence/task-340/runtime.sh > docs/team/evidence/task-340/runtime.log 2>&1` exited 0.
The harness records the full five explicit Jest paths and uses `--runInBand --runTestsByPath --json`, a 180-second deadline, and pre-import network guard.

Five suites passed; 24 tests passed; zero failed, skipped/pending, or runtime-error suites. Counts: double-cancel 5, double-confirm 2, confirm-cancel 4, confirm-expiry 6, stale-observation 7. Raw current JSON/logs are retained. No test/product/script changes or assertion weakening were made by QA; `git diff --exit-code 232532dcbb143323d42d508a17bfc7ba8965bd23 -- tixmoapi2/src tixmoapi2/tests scripts` exited 0.

## Independence and safety

Before DB access, independently checked all three task323 cleanup records against current /proc, ss listeners, socket paths, and postmaster pidfiles. Board showed only PM237, source-review339 and QA340 active; recorded sole DB lane. Adapted existing reviewed harness/guard only for task340 evidence/runtime/synthetic names. Used separate copied node_modules (no install/generation/download); generated engine source/copy had different inodes and link counts 1. Runtime uses existing PG18/Redis binaries, disk-backed owned mode0700 path, loopback-owned PID/listener assertions, synthetic credentials and env -i. Only .env.example is present; no inherited secrets or .env imported. Schema push uses --skip-generate against disposable DB; Redis DB1 target is disposable (application Redis is mocked by existing Jest setup). No blocked network records.

## Contract review

ON_SALE fixtures remain eligible without changing production eligibility. Exact ticket SOLD/RELEASED rows, counters, foreign-buyer snapshots, inconsistent-hold rollback and explicit 400/409 contracts remain asserted. Duplicate public confirm/cancel calls intentionally both fulfill idempotently while one inventory effect is asserted. Read-order gates exercise both schedules, and accepted stale suite includes actual SQL lock qualification. This is not a claim every case overlaps locked SQL transactions.

Actual expiry callback is captured from the production scheduler and invoked with Date-only controlled time: paid-before-expiry survives later scan; all four expired release/read schedules reject confirmation409, cancel/release once, preserve other buyer; actual job stale PROCESSING mutation logs/catches400, keeps full postmutation snapshot, retries once and then no-ops. Existing seven-case accepted guard suite passes unchanged. Production source is unchanged from accepted base.

## Cleanup and limitations

Current cleanup.json: PG2960826/Redis2960839 absent; ports32270/49411 have no listeners; no sockets, pidfiles or task-owned Jest workers remain; mode0700 and zero blocked network records. DB lane RELEASED.

A first auxiliary cleanup-verification script produced AssertionError because it matched its own shell command text as a worker. No test failure occurred; corrected detection requires executable basename node and verified empty worker set. This diagnostic failure is disclosed rather than treated as a product result.

APPROVE only the scoped fixture/expiry contracts on the exact SHA. No full market/API gate, browser, live provider/payment, event-cancel recovery, release GO, merge, cloud or deployment qualification. Event commit-then-cancel-error recovery remains unresolved and is not asserted fixed.
