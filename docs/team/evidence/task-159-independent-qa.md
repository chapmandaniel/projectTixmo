# Task159 independent QA - cutoff / max-generation checkpoint

2026-10-20. Reviewer tixmo-qa. Scoped checkpoint PASS; task143 remains OPEN, recovery DISABLED, release NO-GO.

## Exact review and isolation

Fresh detached checkout `/home/daniel/projects/projectTixmo/worktrees/review-159` at `d5010c3b2804dbf1f34663311ed44de03f794e38`, compared with `ad406c83613ff6158a986a10d82ebc1ca3e66054`. Diff adds one 78-line integration test and historical author evidence, with no product/schema changes. Main and author product source checkouts were not edited. Existing task143 API node_modules was linked locally without installation; Prisma generation reused that dependency directory (same committed schema). No new dependencies or spend.

Full author outer/runtime helpers read before execution. Copied to `.task159-cutoff-{outer,runtime}.sh` with checkout/task labels only; Python full-body equality against those exact substitutions passed. All full141 UID/PID/executable/datadir/direct-child/loopback/listener/readiness/verification-target/bounded-cleanup guards and subprocess timeouts retained. PM sole disposable-runtime authorization recorded in159. Inherited container processes were observed, excluded, and left untouched; only this new runtime was used.

## Fresh executed checks

All artifact paths below are relative to the absolute checkout above. Complete commands, synthetic fixture environment, all suite paths, and timeouts are preserved in `.task159-cutoff-runtime.sh`.

- `bash .task159-cutoff-outer.sh > .task159-cutoff-runtime-final.log 2>&1`: exit0.
- API build under40s TERM/5s KILL: exit0; `.task159-cutoff-build.log`.
- Fresh disposable DB `prisma migrate deploy` under30s TERM/5s KILL: exit0, all migrations applied; `.task159-cutoff-migrate.log`.
- Focused cutoff/overflow test under40s TERM/5s KILL: exit0, 1 suite, 5/5 tests, 4.927s; `.task159-cutoff-focused.log`.
- Broad specified regression under65s TERM/5s KILL: exit0, 14 suites, 74/74 tests, 23.047s; `.task159-cutoff-regression.log`.
- Outer EXIT source restore/cmp: exit0, `SOURCE_RESTORED status=0`.
- Independent subsequent `cmp .task159-cutoff-disabled-source tixmoapi2/src/api/payments/service.ts`: exit0.
- Final disabled-source `timeout --signal=TERM --kill-after=5s 40s npm --prefix tixmoapi2 run build > .task159-cutoff-disabled-build.log 2>&1`: exit0.
- `git diff --exit-code -- tixmoapi2/src tixmoapi2/prisma`: exit0; source line14 is `const EXPIRED_WEBHOOK_RECOVERY_ENABLED = false;`.

## Independently inspected coverage and limits

Cutoff cases sample genuine PostgreSQL clock once per case and replay only its `$queryRaw` clock seam while real event CRUD executes. `processingStartedAt = sample -300000ms + offset` admits offsets -1ms and0ms with generation7→8; +1ms returns null and preserves the full event. This establishes the inclusive millisecond boundary, not submillisecond precision, independent simultaneous DB clocks, or real-time delay behavior.

Both FAILED and ancient PROCESSING max signed bigint `9223372036854775807` cases call public `handleWebhook` with actual Stripe test signature verification. Before/after full event, target order+tickets, other-buyer order+tickets and full inventory snapshots are asserted unchanged. Exactly four tickets and one webhook event remain; inventory counters are nonnegative/conserved. Confirmation-email, admin-alert and sendEmail mocks record no calls. Full snapshots are in the fresh focused/broad logs. These prove explicit maximum-generation null-admission guards with no effects, NOT execution of SQL arithmetic overflow or exception handling.

No new mutation experiments, generation-only ABA sensitivity proof, missing-intent/failure TOCTOU coverage, full139 acceptance, production/provider/financial operation, default merge, deployment, configuration, scheduler, secrets or external action were performed.

## Runtime cleanup

New owned PostgreSQL PID1111324 port32452 and Redis PID1111337 port50018. Runtime trap returned exit0 and stopped both. Independent post-cleanup assertions found both `/proc` entries absent and `ss` empty for both ports; `.task159-cutoff-cleanup-check.log`. Inherited services untouched. No runtime remains from this review.

## Recommended next bounded task143 slice (not implemented)

Add a deterministic admission generation-only ABA sensitivity case. Pause contender A after reading generation g; let a successor advance to g+1 while leaving the durable row eligible under exactly the same FAILED or expired-PROCESSING status/lease predicates, then resume A. Assert A returns null, no claim is fabricated, and the successor event/full business snapshot and notifications remain unchanged. Under a separately authorized disposable-only mutation, removing ONLY the admission generation predicate must make this focused test fail while status/lease predicates remain satisfied. Keep recovery disabled in committed code, bounded barriers/finally drains, exact restore/final disabled build, and fresh independent exact-SHA review. This isolates generation fencing from existing tests whose changed lease/status could also reject a stale contender.
