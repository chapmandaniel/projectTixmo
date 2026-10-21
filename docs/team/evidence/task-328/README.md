# Task328 — public cancellation stale-observation guard

Branch `tixmo/task-328-cancel-stale-guard`, base/product `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. Isolated task-328 worktree. Read task324 `1eeb38e` contract findings and historical118 `9b9623e2daa4002d11a527812122f244cc7bcd98` change. No other unmerged fixture repairs composed.

## Minimal source change

`src/api/orders/service.ts` public cancelOrder now retains actual authorized public observation, acquires the existing SQL order lock, rereads with identical actor/user scope and rejects400 `Cannot cancel order that has changed` when status/paymentStatus changed. This happens before calling the inventory-effect helper. Inventory always comes from locked current helper state, never the old public snapshot. Already-CANCELLED current state is exempt to retain effect-free idempotent repeat cancellation.

No constant PROCESSING prohibition: stable PENDING/PROCESSING still cancels. Existing actor scope is unchanged; locked scope disappearance remains404. cancelOrderInTransaction is untouched; direct manual73 payment ingress retains its existing fence/helper path. Actual expiry job (`src/jobs/order-expiry.job.ts:34`) and event cancellation (`src/api/events/service.ts:599`) call public cancelOrder and therefore inherit the restored stale-observation guard. Their concurrent race/job behavior is not qualified by this test. No refund/provider/financial-policy change.

## Actual SQL red/green

Exact command from repository root, both runs:

```bash
bash docs/team/evidence/task-328/runtime.sh
```

The script explicitly runs only `tests/integration/order-cancel-stale-observation.test.ts` via ordinary Jest config/ts-jest, not the full API gate. Initial run used baseline source before any implementation change: **1 semantic failure, 6 passes** (PROCESSING stale cancellation resolves CANCELLED instead of rejecting400). Red artifacts retained `red-baseline/`. No harness timeouts/compilation errors; other controls pass on baseline.

After minimal source change, same seven tests: **7 passed,0 failed/skipped**, Jest exit0. Test file unchanged between red and green. `summary.json`, exact `jest-result.json` and `jest.log` retained.

Coverage:

1. Actual authorized public findFirst returns PENDING/paymentPENDING snapshot and pauses before lock. Separate real SQL transaction commits paymentPROCESSING; cancellation resumes and must400, with full target/tickets/inventory/foreign-buyer snapshot exactly equal to post-mutation snapshot.
2. Same schedule commits PAID/SUCCEEDED;400 and exact unchanged snapshots.
3-4. No-change PENDING and stablePROCESSING controls cancel only target; exact ticket rows become RELEASED/CANCELLED, stock8available/2held/0sold, distinct-buyer order/tickets byte-for-byte unchanged, repeated public cancellation exact effect-free snapshot.
5. Foreign actor denial404 preserves entire fixture.
6. Inverse schedule pauses actual transaction after existing row lock and before helper effects. Independent real SQL `FOR UPDATE NOWAIT` returns PostgreSQL55P03 (PrismaP2010), proving cancellation owns the row lock. Release lets cancellation commit; later payment mutation commits without releasing inventory again; foreign buyer and counters intact. This proves lock exclusion using NOWAIT, not a timer-based claim that a queued updater waited.
7. Direct transactional helper still releases stable expired PROCESSING holds without a public observation precondition; foreign buyer unchanged. This control does not invoke actual expiry/event jobs and does not explicitly acquire the order lock; it is not evidence of helper lock ownership under contention.

Deferred promises explicitly select ordering. Five-second deadlines report harness failure only. No transaction waits for another transaction needing its lock; NOWAIT control cannot deadlock. Cleanup/finally drains started requests and restores spies.

## Checks, runtime and cleanup

- Focused Prettier on source/new test passed. Source/test-only `git diff --check 4ec85948 fa7fe10 -- tixmoapi2/src/api/orders/service.ts tixmoapi2/tests/integration/order-cancel-stale-observation.test.ts`: exit0. Whole implementation range `git diff --check 4ec85948 fa7fe10`: exit2, six trailing-whitespace diagnostics in retained raw Jest logs (`jest.log` and `red-baseline/jest.log`, lines2,4,5). Raw log bytes are intentionally preserved; this is not an unqualified whole-commit diff-check pass.
- `env -i HOME=/home/daniel PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin NODE_ENV=test node node_modules/typescript/bin/tsc --noEmit` from tixmoapi2: exit0, `typecheck.log` empty. No generate/build/install commands.
- Owned dependencies copied `cp -a` from task322 matching baseline schema/lock, not hardlinked. No shared generated-client writes. Hash/inode provenance retained.
- Inspected/reused task322 helper: disk-backed task328 root0700, fresh PG18/Redis, exact PID/executable/user/runtime/listener ownership before access. env-i before imports, only synthetic keys, CHECKPOINT_DISABLE, preimport nonloopback denial, no provider calls; zero blocked attempts.
- Default shared test setup's schema push targets only newly generated disposable loopback DB, never production/non-disposable DB. Sole coordinated DB owner.
- `cleanup.json` verifies both runs' PIDs/listeners/PG socket/pidfiles/Redis socket absent and no task328 Jest/engine workers. Runtime logs retain shutdown evidence. Database lane released.

## Limitations and review

This is narrow SQL qualification, not full order race matrix/full API readiness or technical acceptance of refund concurrency. Stable direct expired-hold helper explicitly covered; actual expiry/event callers use the public method and inherit its restored precondition. Expiry catches per-order rejection for later scan; event cancellation may propagate rejection after its event commit. These actual job/race/recovery flows are unverified, not claimed unaffected or accepted. Direct manual73 helper code is unchanged, but manual73 end-to-end was not rerun. Actor scope control covers customer/foreign buyer, not every operator role. No external API/credentials/spend/deploy/default-branch merge. Source and new test need independent lead+QA exact-SHA acceptance; author submits review, not done. Command-scoped agent author/hook bypass used because fresh isolated checkout lacks Husky helper.

## Evidence correction after independent331

Reviewer331 `3576522d973929e2bc0fca11e901492e4e1ef2cc` SOURCE APPROVED exact implementation `fa7fe109959f415b8f83e1ff3e01b68db61416ad` and required the caller-routing and diff-check qualifications above. This followup changes evidence only; source/test blobs and all raw runtime artifacts remain byte-identical to that implementation. No new runtime/DB/services/tests were executed. `evidence-correction-checks.json` records source/test identity, raw log hashes and separate diff-check exits. This documentation correction is not a fresh runtime pass of a newer commit; QA332 must verify the corrected exact SHA independently. No product/policy expansion or invented actual-job acceptance.
