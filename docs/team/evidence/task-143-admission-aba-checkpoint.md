# Task143 generation-only admission ABA checkpoint

2026-10-20, author tixmo-backend. TEST/EVIDENCE ONLY over exact reviewed base `d5010c3b2804dbf1f34663311ed44de03f794e38` on `tixmo/task-143-fenced-processing-recovery`, isolated `/home/daniel/projects/projectTixmo/worktrees/task-143`. Task143 remains unfinished, expired recovery DISABLED, release NO-GO. Independent exact-SHA lead AND QA reviews are required. Commit SHA is recorded in the task143 board handoff.

## Scope and actual oracle

Adds `tixmoapi2/tests/integration/payment-admission-aba.test.ts`, two deterministic real-PostgreSQL cases: FAILED and expired PROCESSING. These directly invoke PRIVATE `beginWebhookEvent`, not public whole-handler acceptance. A reads generation7 and pauses immediately before its actual updateMany, outside any database transaction. B genuinely admits via the same private method and real database, advancing generation7 to8. An explicitly labelled fixture-only update returns the successor to FAILED or ancient PROCESSING while retaining generation8, restoring the same admission status/lease eligibility. This is synthetic ABA fixture choreography, not a claimed public successor failure/recovery lifecycle.

A resumes and actual affected-row count is0, admission returns null, and full successor event, target/other-buyer orders and ordered tickets, full ticket-type inventory, ticket/event counts remain identical. B admission itself also leaves business snapshots unchanged. Confirmation email, admin alert and sendEmail have no calls. A barrier and finally drain each have5s deadlines; Jest cases15s and subprocesses bounded. No custom orchestration or dependencies introduced.

## Disposable mutation sensitivity

Outer helper temporarily enables experimental recovery only in this isolated checkout, saves original disabled source, and unconditionally restores/cmp-checks it on EXIT. Runtime saves enabled candidate and removes ONLY `attemptGeneration: existing.attemptGeneration` from admission updateMany where, retaining id and BOTH FAILED/expired-PROCESSING predicates. Both focused mutant cases fail at actual database count oracle (`Expected:0`, `Received:1`, line50), not a barrier/subprocess timeout. Actual logs include successor generation8, post-stale generation9, and fabricated returned generation8. Runtime restores/cmp-checks enabled candidate before broad regressions; outer restores original disabled source at exit. No product/schema changes retained.

## Fresh executed evidence

All local artifact paths relative to the worktree above. Helpers are existing cutoff helpers adapted only for task-local labels/cache/logs and test tail. Full guard prefix equality was checked by Python against `.task143-cutoff-runtime.sh` after only cutoff-to-admissionaba label substitution: `FULL141_GUARD_BODY_EQUAL labels-only`. All UID/PID/executable/datadir/direct-child/loopback/listener/readiness/verification-target/bounded-cleanup guards retained; inherited services untouched.

- `bash .task143-admissionaba-outer.sh > .task143-admissionaba-runtime-final.log 2>&1`: exit0.
- API build40s TERM/5s KILL: exit0, `.task143-admissionaba-build.log`.
- Fresh disposable `prisma migrate deploy`30s TERM/5s KILL: exit0, all migrations applied, `.task143-admissionaba-migrate.log`.
- Focused control40s bound:2/2 pass,4.991s, `.task143-admissionaba-focused.log`.
- Generation-only mutant40s bound: exit1 EXPECTED,2/2 failed at count oracle,4.423s, `.task143-admissionaba-mutant.log`; runtime requires exit1, Received1, and absence of timeout text.
- Restored candidate broad regression65s bound:15 suites76/76 pass,24.941s, `.task143-admissionaba-regression.log`. Includes new ABA, cutoff/overflow, competing claims, failed successor, expired candidate/successor, fenced checkpoint, failed retry, distinct success, signature, recovery, tenant, double confirm, confirm/cancel, confirm/expiry.
- Outer `SOURCE_RESTORED status=0`; independent cmp of disabled source and `git diff --exit-code -- tixmoapi2/src tixmoapi2/prisma`: exit0.
- Final disabled-source API build40s TERM/5s KILL: see `.task143-admissionaba-disabled-build.log`, completion/exit recorded in board handoff.

## Runtime cleanup and limitations

Fresh owned PostgreSQL PID1115822 port23457 and Redis PID1115836 port40186. Runtime trap successfully stopped both; independent post-cleanup checks found `/proc` entries absent and listeners empty. No owned runtime remains. Existing inherited services were not used or stopped.

This checkpoint proves generation-only admission sensitivity at direct private admission and synthetic eligible-state ABA, not public whole-handler acceptance, arbitrary ABA lifecycle behavior, missing-intent/failure TOCTOU, all remaining139 mutations or full143 recovery completion. No provider/financial/default merge/deployment/configuration/scheduler/spend/secrets/external actions. Recovery stays disabled; PM must arrange fresh exact-SHA independent reviews before further continuation.
