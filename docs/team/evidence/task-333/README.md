# Task333 Stage A — READY FOR DB, NOT RUNTIME VERIFIED

Base/product `4ec8594850eb547dafc145a14bb1b85cdeaa235c`; isolated branch `tixmo/task-333-paid-sales-utc`. No task328 cancellation change or other unmerged fixes composed. PM authorized source/test preparation only while QA332 holds the DB lane. **No DB/services/Jest/integration execution occurred here. Await explicit PM runtime grant before Stage B.**

## Evidence and minimal repair

Read task326 diagnostic exact `8726384e`, README and smoke-predicates.json: PAID/cad/correct tenant order created08:34:43.548Z lies before08:34:43.678Z dashboard bound in JS, but SQL session America/St_Johns interprets stored UTC-naive created_at against timestamptz incorrectly: original endfalse/count0 versus explicit-UTCtrue/count1. No financial/window/clock-skew workaround warranted.

Only product change is `src/services/paid-sales-query.ts`: each optional Date bound becomes `(<bound>::timestamptz AT TIME ZONE 'UTC')`, comparing against unchanged bare indexed `o.created_at`. No function/cast on indexed column; >= and <= inclusivity unchanged. No session/global timezone mutation or window widening. Status, currency lowercasing, event/org predicates, promo-derived total_amount, ticket SOLD count and LEFT JOIN semantics unchanged. No other timestamp queries swept into scope.

## Prepared actual-SQL tests (NOT RUN)

`tests/integration/paid-sales-utc.test.ts` has four parameterized cases: UTC and America/St_Johns for inclusive boundaries and Newfoundland fall-back repeated-hour instants. Each executes `set_config('TimeZone', timezone, true)` in its own Prisma transaction (equivalent transaction-local SET LOCAL; no pool-global configuration), verifies setting, creates actual Prisma fixtures and queries the real paidSalesSource fragment.

- Exact start/end inclusion, single instant equality, one millisecond before/after exclusion, start-only and end-only bounds.
- PAID/cad versus excluded PENDING/usd/foreign tenant fixtures, exact returned IDs; exact event filtering where specified.
- 2026-11-01T04:00Z (first01:30 NDT−02:30) and05:00Z (second01:30 NST−03:30): assert both named local wall times are01:30 while exact instant windows select distinct IDs; range includes both. Actual PostgreSQL assertions remain pending. DB-free Node Intl corroborated these labels.

Tests retain bare SQL predicates and no provider dependencies. Disposable fixture rows are scoped by unique UUID tenant per case, never relying on wall-clock sleeps or a global session timezone change. Prepared callback transactions use ordinary Prisma defaults; runtime may reveal a genuine harness or product failure, which must be preserved rather than asserted away.

## Stage A checks

1. Focused Prettier on source/new test: passed.
2. Scrubbed-env `node node_modules/typescript/bin/tsc --noEmit` from tixmoapi2: exit0, typecheck.log empty.
3. Scrubbed-env `node tixmoapi2/node_modules/typescript/bin/tsc --noEmit -p docs/team/evidence/task-333/tsconfig.prepared-tests.json`: exit0, prepared-tests-typecheck.log empty; compiles prepared integration tests without executing them or DB setup. Initial standalone config lacked Jest type roots because it resides under evidence; its failed diagnostics are retained in prepared-tests-typecheck-attempt-1.log. Final config explicitly resolves existing owned node/Jest types (no installation).
4. Scrubbed-env `TS_NODE_PROJECT=tixmoapi2/tsconfig.json NODE_OPTIONS=--require=<absolute task333 network-guard.cjs> TASK333_BLOCK_LOG=<absolute task333 blocked-network.jsonl> node -r ./tixmoapi2/node_modules/ts-node/register docs/team/evidence/task-333/shape-check.cjs`: exit0. Pure fragment shape/value assertions verify UTC parameter casts, bare column, unmodified Date objects, inclusive operators and unchanged existing status/currency/tenant/event/SOLD/LEFT JOIN structure. No configuration/DB client import. No blocked-network record.
5. `git diff --check`: exit0. Hash/inode provenance retained. Owned dependencies copied with cp-a from task328, matching baseline schema/lock, distinct generated-client inode/nlink1, no install/generate/shared generated writes.

No smoke or SQL PASS claimed. Existing326 diagnostic supplies prior baseline failure evidence; same-test fresh baseline RED is still required after runtime grant.

## Stage B pending explicit runtime grant

- Preserve this Stage A commit. Prepare a separate isolated baseline checkout at4ec85948 with this exact new test blob, its SHA256 retained, owned matching dependencies and inspected guarded disk0700 workspace runtime. Run the prepared suite on baseline **before** fixed-source run; retain expected StJohns semantic failure, not compilation/barrier failure. Avoid rewriting this source merely to simulate a baseline pass.
- Then run identical test blob against corrected exact source under fresh owned PG18/Redis; per-case transaction-local timezones as above. Guard/scrub credentials before imports; CHECKPOINT_DISABLE; no provider/network. One sole DB owner only.
- Run original smoke unchanged, preserving `sales.totalOrders >=1`, with nonUTC America/St_Johns disposable DB default reproducing326; do not silently forceUTC globally. Retain all results including failures and explicit network-denial gate outcome, exact source/test hashes and commands.
- Stop owned services and audit exact PIDs/listeners/sockets/pidfiles/Jest workers. Source and fresh SQL QA independent exact-SHA review required. If source fix is insufficient, return concrete result rather than broadening raw SQL/financial scope.

No runtime root or services created in Stage A; no cleanup/DB ownership release claim needed because this lane never acquired runtime ownership. No cloud/provider/AWS actions, credential access, spend, merge or deployment. Stage A is ready-for-DB preparation, not completion of task333. Command-scoped Git identity/hook bypass only for fresh-worktree missing Husky helper.
