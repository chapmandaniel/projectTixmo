# Task143 cutoff / overflow test-only checkpoint

2026-10-20; branch tixmo/task-143-fenced-processing-recovery; isolated worktrees/task-143.
Parent exact ad406c83613ff6158a986a10d82ebc1ca3e66054; prerequisite QA156 and lead157 checkpoint reviews read. No product/schema changes; recovery remains DISABLED,143 OPEN,release NO-GO. Independent exact-SHA QA AND lead reviews required.

## New deterministic evidence

Existing Jest/Prisma/Stripe fixtures and guarded disposable harness reused; no dependencies. Three private admission cases replay one genuine PostgreSQL clock sample ONLY at the clock seam, all event reads/writes real. Original start is sampled now minus300000ms with offsets -1,0,+1ms: first two own generation8, +1 returns null and preserves full event. Each case samples separately once. Prisma JavaScript Date exposes millisecond precision: no submillisecond cutoff proof, real-time delay proof or independently coincident DB-clock claim.

Two maxBigInt negatives use signed PUBLIC handleWebhook, actual signature verification and real DB: FAILED and ancient PROCESSING at9223372036854775807. Both skip normally (explicit guard), not thrown SQL overflow. Assert full webhook event, full target order+tickets, full other-buyer order+tickets and inventory unchanged; four tickets and one event retained, nonnegative conserved counters; zero order confirmation email/admin alert/sendEmail. Actual before/after snapshots logged. This proves no effects at the maximum, not execution of a PostgreSQL overflow exception. Initial author expectation of rejection corrected to actual null-admission contract before any focused test execution; no failed test run.

## Exact executed commands and outcomes

`bash .task143-cutoff-outer.sh > .task143-cutoff-runtime-final.log 2>&1` exit0. Outer unconditional EXIT cp/cmp restores disabled source. Guard runtime prefix assertion compared prior competing harness through first timeout after owned directory label substitution: equal; full141 UID/PID/exe/datadir/direct-child/loopback/listener/readiness/verification-target/boundedcleanup retained. Artifacts runtime.sh/outer.sh contain complete exact commands.

- `timeout --signal=TERM --kill-after=5s 40s npm --prefix tixmoapi2 run build` exit0.
- `timeout --signal=TERM --kill-after=5s 30s tixmoapi2/node_modules/.bin/prisma migrate deploy --schema tixmoapi2/prisma/schema.prisma` exit0 fresh database.
- Focused `npm --prefix tixmoapi2 test -- --cacheDirectory "$PWD/.jest-cache143-cutoff" --runInBand --runTestsByPath tests/integration/payment-cutoff-overflow.test.ts` under40s TERM/5sKILL: exit0,1suite5/5,4.911s.
- Broad same Jest command with new suite + prior13 suite paths (complete exact list in runtime.sh and regression.log),65s TERM/5sKILL: exit0,14suites74/74,23.436s.
- After outer exit, `cmp .task143-cutoff-disabled-source tixmoapi2/src/api/payments/service.ts` exit0; `timeout --signal=TERM --kill-after=5s 40s npm --prefix tixmoapi2 run build > .task143-cutoff-disabled-build.log 2>&1` exit0; `git diff --exit-code -- tixmoapi2/src tixmoapi2/prisma` exit0. Final disabled build independently after restoration.

New cases each15s Jest deadline; no added gates or drains. Existing competing/successor cases retain5s bounded barriers/drains/finally releases; subprocess cap remains cancellation safety for Prisma. Runtime owned PG1101763 port28367, Redis1101776 port45572; cleanup log both stopped and empty ss output. Explicit post-cleanup PID/port checks recorded in cleanup-check.log. Inherited5433/5434/6380/6381 untouched. Prior runtime artifacts preserved.

## Limits / next work

No product activation retained. No new mutation runs, isolated generation-predicate sensitivity/ABA proof, missing-intent or failure TOCTOU coverage, full139 acceptance, merge/deploy/provider or financial actions. Continue only after fresh exact-SHA independent QA+lead and new sole-runtime assignment. Task143 deliberately released unfinished, not implementation done.
