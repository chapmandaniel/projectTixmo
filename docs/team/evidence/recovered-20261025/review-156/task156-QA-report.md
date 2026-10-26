# QA156 independent code analysis

Exact ad406c83613ff6158a986a10d82ebc1ca3e66054 versus0d8e1f5bd86363a476fbd836767e35f225376e97; detached review-156. New49-line test and documentation/scripts/historical logs only; product source/schema diff empty. Historical logs inspected but excluded from fresh results.

Four schedules cover FAILED/ancient PROCESSING generation7 with contender0 or1 winning. Initial contender is deterministically at pre-update gate before starting second. Both real findUnique calls have completed before releasing either update. Single genuine clock_timestamp sample taken from disposable PostgreSQL then replayed via narrow query wrapper; assertion permits only exact known clock SQL. Admission service computes cutoff itself. Update observer calls original Prisma updateMany after external gate; no database result/claim fabricated. Release designated winner and await returned generation8 before loser; actual counts expected1/0 or0/1, loser null, full durable successor equality and single event retained. No notification spy called. Finally releases both gates, bounded drains runs and restores observers. Existing real public signed webhook suites cover different scope in broad run.

Limits: direct private beginWebhookEvent admission, not signed public contender delivery; simultaneous contenders are paused before DB updates and released in deterministic sequence, not simultaneous locked SQL execution. Equal-time uses replayed genuine millisecond Date sample, not independently sampled coincident clocks. Ancient lease, no exact-boundary semantics. No new order fixture/business effects, arbitrary ABA uniqueness, maxBigInt expanded order-effects negative, TOCTOU or predicate mutant sensitivity proven. Repository Jest Redis mock and notification/email spy mean no real Redis/provider delivery claims. No product/schema change, no full143 closure or release authorization.

## Fresh execution: checkpoint PASS

`bash .task156-outer.sh > .task156-runtime.log 2>&1` exit0. New isolated disposable PG/Redis only. Complete task141 guard prefix independently asserted byte-identical after own worktree-path/cleanup-label changes; UID/PID/executable/datadir/direct-child/loopback/listener/readiness/verification-target/boundedcleanup preserved. Forbidden5433/5434/6380/6381 never accessed. Existing installed dependencies reused through own node_modules symlink, no reinstall.

Exact commands and timeouts retained in `.task156-runtime.sh`:
- Experimental `timeout --signal=TERM --kill-after=5s 40s npm --prefix tixmoapi2 run build`: exit0.
- Fresh `timeout --signal=TERM --kill-after=5s 30s tixmoapi2/node_modules/.bin/prisma migrate deploy --schema tixmoapi2/prisma/schema.prisma`: exit0, all migrations applied.
- Focused `timeout --signal=TERM --kill-after=5s 40s npm --prefix tixmoapi2 test -- --cacheDirectory "$PWD/.jest-cache156" --runInBand --runTestsByPath tests/integration/payment-competing-claims.test.ts`: exit0,1suite4/4,4.815s.
- Broad same test command with13 complete path list in runtime helper,65s timeout: exit0,13suites69/69,21.989s.
- Unconditional outer EXIT source restoration `SOURCE_RESTORED status=0`; cmp byte equality passed.
- Final restored disabled `timeout --signal=TERM --kill-after=5s 40s npm --prefix tixmoapi2 run build > .task156-disabled-build.log 2>&1`: exit0.
- Final cmp, source constantfalse, `git diff --exit-code` exit0.

Fresh focused log extracted to `.task156-snapshots.json`: FAILED winner0 counts[1,0], FAILED winner1[0,1], ancientPROCESSING winner0[1,0], ancientPROCESSING winner1[0,1]; all successor generation8, actual full snapshot equality after loser. Both contenders read full original generation7 row before release. Historical author logs not used as new pass. No findings within stated checkpoint scope.

Cleanup: PG1093187/port37328; Redis1093200/port41344. Guard cleanup exit0, independent subsequent ps and ss both empty. Disposable datadir/evidence retained; helpers/logs/report/snapshots untracked in review-156. No product edits/commits.

Checkpoint156 only PASS, task143 remains OPEN, recovery DISABLED, release NO-GO. No merge/deploy/production/provider/financial/config/scheduler/spend/secrets/external actions. No child agents.
