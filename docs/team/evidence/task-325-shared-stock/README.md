# Task325 bounded shared-stock and rollback continuation

Base `4a89e7c93c854a381a661d9e485e1dd47f3a4259`, existing clean isolated `/home/daniel/projects/projectTixmo/worktrees/task-325`, branch `tixmo/task-325-refund-races`. Existing claim preserved; PM explicitly granted sole disposable-local DB after QA349 cleanup. Prior QA PIDs3025803/3025816 and ports38287/56316 independently observed absent before startup. Lead350 simultaneously SOURCE-ONLY reviews prior SHA, not this new candidate.

## Exact commands and results

`bash docs/team/evidence/task-325-shared-stock/runtime.sh > docs/team/evidence/task-325-shared-stock/runtime.log 2>&1`, exit0. Runtime runs:

- `node tixmoapi2/node_modules/jest/bin/jest.js --config tixmoapi2/jest.config.js --runInBand --runTestsByPath tixmoapi2/tests/integration/order-refund-current-path.test.ts --json --outputFile=docs/team/evidence/task-325-shared-stock/jest-result.json` under100s timeout: fresh realSQL **1suite13PASS0FAIL0SKIP**,7.282s.
- `node tixmoapi2/node_modules/jest/bin/jest.js --config tixmoapi2/jest.recovery-fairness.config.js --runInBand --json --outputFile=docs/team/evidence/task-325-shared-stock/focused-result.json` under60s timeout: existing setup-free **2suites17PASS0FAIL0SKIP**,4.45s, manual-late-paid and recovery-fairness.
- `git diff --check` and `bash -n docs/team/evidence/task-325-shared-stock/runtime.sh` PASS.

No failed run or harness repair this continuation. No fullAPI or historical full-suite pass claimed.

## New acceptance evidence

Two appended realSQL cases; previous11 assertions and historical test files preserved. Shared event/tickettype foreign buyer has separate user/order/payment intent and1VALID/SOLD ticket. Own2tickets refund releases exactly2 units: shared stock7available/3sold becomes9available/1sold; entire foreign order/ticket rows, event and refund ledger unchanged. Full stock row equality permits only expected counters/updatedAt. Full own ticket transitions and replay whole snapshots prove no extra release/provider create.

Multi-type rollback: one own ticket reassigned to explicit lexically later `zzzz-` tickettype with0sold. Real transitionInventory sorts tickettype IDs, so earlier valid shared-stock update executes before later conditional update fails409. After rejection, full earlier and later stock rows, event, all own ticket rows and foreign entire snapshot equal pre-request values. Own order differs only legitimate pre-provider refundStatusPROCESSING/updatedAt. One durableSUCCEEDED provider-confirmed ledger remains outside rolled-back local finalization, amount2000/reasonORDER_REFUND; provider create exactly1. Earlier update execution ordering follows real source, not injected mutation or explicit SQL trace. This is bounded multi-type rollback, not every possible transaction failure.

## Isolation, cleanup, unchanged policy and remaining gaps

Preimport deny-nonloopback guard; env-i before imports; synthetic loopback PG18/Redis; inert provider mock and notification module; owned0700disk runtime, copied writable dependency client index linkcount1. No generation against shared dependencies/symlink, .env/inherited credentials, external provider/email/cloud/config/install/network/spend/push/merge/deploy.

cleanup.json independently confirms runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task325/run.Ydmt2N` mode0700, PG3034718/Redis3034731 absent, ports29775/43833 empty, sockets/pidfiles/ownedworkers absent,0blocked network records. DB RELEASED.

Product source/schema unchanged; preserves provider-confirmed finalization, stale-observation guarantee and manual73 policy. Existing focused manual/fairness pass is not full integration qualification. Parent325 stays PARTIAL REVIEW: independent lead+freshQA exact new SHA required. Deduplicated remaining acceptance: tier-specific rollback if required by original scoped criteria, route/actor matrix and fullAPI gate. No expansive promo matrix or policy inferred: current finalizeRefund does not call transitionPromo. Existing lock probe not targetPID-scoped, no universal transient/sharedstock concurrency or fault-injected drain guarantee. No closure or current integrated-release claim.
