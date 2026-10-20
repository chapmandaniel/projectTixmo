# Task 143 competing equal-time admission checkpoint

Tests/evidence ONLY over independently checkpoint-approved `0d8e1f5bd86363a476fbd836767e35f225376e97`, on existing branch `tixmo/task-143-fenced-processing-recovery`. Product/schema unchanged. Expired recovery remains DISABLED; task 143 OPEN and release NO-GO.

## Scope and actual results

New `payment-competing-claims.test.ts` exercises two real admission calls against the same FAILED or ancient PROCESSING event, both winner orders (4 cases). Both read the identical durable generation 7 row; both use the same actual PostgreSQL `clock_timestamp()` sample. A test-only wrapper replays that one clock result; it does not fabricate row reads, update results, or claims. Pre-update gates run before real Prisma update calls, outside any transaction lock. Final harness starts contender 1 after contender 0 reaches that gate, ensuring stable contender identity. Both have read before either update is released. Winner advances to generation 8, loser actual `updateMany.count` is zero; full event snapshot remains identical after loser, single event retained, no email/admin alert. Logs include actual snapshots, CAS arguments and counts.

These are direct private admission calls, NOT new public signed-webhook delivery cases; existing public signed delivery suites were rerun in the broad gate. No order fixture/effects are introduced in the new admission-only tests. No exact-cutoff semantics are claimed: expired cases are ancient rows. Equal-time is controlled by replaying one genuine DB clock sample rather than expecting two independently sampled clocks to coincide.

Executed guarded `bash .task143-competing-outer.sh` (runtime exit 0), then `npm --prefix tixmoapi2 run build` (disabled-source final build exit 0). Helper preserves full task141 UID/PID/executable/datadir/direct-child/loopback/listener/readiness/verification-target/bounded-cleanup body; only owned labels/path and check tail adapted. Existing installed Prisma/Jest infrastructure used, no new dependency.

- Experimental API build exit 0; fresh `prisma migrate deploy --schema tixmoapi2/prisma/schema.prisma` exit 0.
- Focused initial test run 4/4 pass; the final contender-identity scheduling clarification was then exercised by broad run.
- Broad final-source run 13 suites, 69/69 pass (22.359 seconds), includes previous 12 suites/65 tests and all four new cases. Exact command and paths in runtime script and regression log.
- Outer unconditional EXIT trap restored disabled source byte-for-byte using `cmp`, `SOURCE_RESTORED status=0`; final disabled API build exit 0. `git diff` of product service empty.
- Cleanup pg PID 1089074, redis PID 1089087, ports 37505/41808. Runtime guarded shutdown exit 0; subsequent `ps -p 1089074,1089087 -o pid=,stat=` and `ss -H -ltnp 'sport = :37505 or sport = :41808'` both empty. Inherited 5433/5434/6380/6381 never accessed.

Actual logs/scripts are in `task-143-competing/`; their local invocation paths intentionally refer to the retained untracked `.task143-competing-*` author artifacts. To reproduce from tracked files, copy runtime.sh and outer.sh to those filenames at worktree root, then run outer.sh from root and final disabled build.

## Explicit limits

No new mutation run; maxBigInt expanded full-order/no-notification overflow negative not added (older narrower overflow coverage remains). Exact cutoff boundaries, missing-intent/failure TOCTOU, other required mutation oracles and full task139/143 acceptance remain outstanding. Equal-time/reversed ancient admission tests do not alone establish generation-history uniqueness over arbitrary ABA lifecycles or mutation sensitivity of each individual claim predicate. No activation, implementation closure, merge/deployment/provider/financial/production/config/scheduler/spend/secrets/external action.

New exact-SHA independent lead AND QA checkpoint review required before further implementation or closure. This checkpoint must not close 143.
