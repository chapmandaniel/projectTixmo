# Task143 failed B / real C retry checkpoint

Tests/evidence only over independently reviewed `03716d3ee8d9d504df9540fa543750e014ec2ed0` on existing isolated task-143 branch. Product source unchanged; expired recovery remains disabled. Existing maintained Jest/Prisma harness suffices; no custom runtime dependency.

New `payment-failed-successor.test.ts` runs two bounded deterministic schedules: A pauses outside transactions at handler entry; fixture-only ancient lease permits B's real signed expired admission generation2. B handler throws the exact injected error before any order transaction (no database mock); public caller receives that same error, real terminal write count1 persists FAILED2, error/timestamps, and full original order/tickets/otherbuyer/inventory remain equal. C uses real signed FAILED retry, generation3, real fenced fulfillment and commits once, pausing outside transactions before finish. A resumes success or injected failure; actual terminal count0 preserves full C-PROCESSING snapshot. Both stale B success/failure terminal methods are directly exercised using its actual lost claim, each real updateMany count0 and complete snapshot equality. C finishes PROCESSED3; duplicate signed delivery is a durable no-op, inventory6/2/2 and exactly one confirmation-email invocation. Gates release/drain in finally; observer spies call real DB methods.

## Actual checks

`bash .task143-failedbc-outer.sh` exit0: unique fresh owned disposable PG/Redis, full141 guard body preserved from inspected terminal helper, only owned path/cache/log labels/check tail adapted. UID/PID/executable/datadir/directchild/loopback/listener/readiness/target/bounded cleanup checks unchanged. Unconditional outer EXIT trap byte-restored disabled source with cmp, `SOURCE_RESTORED status=0`.

- Experimental API build exit0 (40s + kill-after5s).
- Fresh disposable `prisma migrate deploy` exit0 (30s +5s).
- Focused new suite 2/2 pass, exit0 (40s +5s).
- Broad existing eleven suites plus new suite: **12 suites,65/65 pass**, exit0 (65s +5s). Existing generation/afterterminal tests preserved, no mutant rerun this cycle.
- Final byte-restored disabled API build exit0 (40s +5s).

Local scripts/logs retained untracked: `.task143-failedbc-{outer,runtime}.sh`, `.task143-failedbc-{build,migrate,focused,regression,runtime-final,disabled-build}.log`. Full observed failed/successor snapshots and terminal counts exported to `task-143-failed-b-c-snapshots.json` from actual focused logs.

Cleanup: pg1075444 redis1075457; ports25847/55483. Guard cleanup and independent ps/ss confirm both absent and no listeners. No inherited runtime accessed; historical artifacts retained.

## Limits

This is pre-transaction handler-error injection, not a claim of mid-transaction rollback or provider/email exactly-once delivery. Stale B terminal outcomes are direct calls on its real generation2 claim, not new public B deliveries. A's injected handler intentionally performs no business work. No cutoff/equaltime/reversed-expired/TOCTOU/other mutation acceptance attempted. Full143 remains open, recovery disabled/release NO-GO. Exact new SHA requires independent lead AND QA review. No merge/deploy/provider/financial/production/config/scheduler/spend/secrets/external actions.
