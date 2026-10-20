# Task143 handler ownership mutation checkpoint

2026-10-20, tixmo-backend. Test/evidence ONLY over exact approved base `693477c04b545e9565cc058082624b6d1a8aa2e6`, branch `tixmo/task-143-fenced-processing-recovery`, isolated `worktrees/task-143`. No committed product/schema changes. Task143 OPEN, recovery DISABLED, release NO-GO. New exact-SHA independent lead AND QA required.

## Schedule and durable oracle

`payment-handler-ownership.test.ts` invokes public signed admission for A, pauses A BEFORE its real fence, fixture-ages only its lease, invokes actual public newer-generation admission B, and holds B PROCESSING/gen2 BEFORE its real fence. Neither barrier holds an event/order lock. Resumed A hits actual ownership loss; full successor event, target/other-buyer orders including ordered full tickets, full inventory row, ticket/event cardinalities remain equal BEFORE B release. A-only transaction order-update affected counts total0 (no handler callback/update), terminal writes absent. B then fulfills exactly one inventory transition, confirmation count1. This does not promise exactly-once notifications.

Success case is same signed event/payload redelivery. Failure case intentionally uses synthetic same event ID/different type (failure A, success B), NOT genuine Stripe redelivery. Both have initially missing order intent. This is a pre-fence ownership-loss schedule, not after-protected-read TOCTOU or full139 acceptance.

## Actual fresh execution

Local helpers `.task143-ownership-outer.sh`/`runtime.sh` adapt the PM-approved full141 body with owned paths/cache/test tail only; original UID/executable/datadir/direct-child/loopback/listener/readiness/target/deadline/bounded-cleanup safeguards retained. Inherited DB never used. Temporary activation is trap-restored byte-for-byte; final disabled build exit0.

Successful run `.task143-ownership-runtime-final2.log`, exit0:

- Enabled API build exit0, fresh disposable migration deploy exit0 (27 migrations), `.task143-ownership-build.log`/`migrate.log`.
- Candidate focused2/2,4.363s: `.task143-ownership-focused.log`.
- Remove ONLY handler ownership validation; preserve both event/order locks, lease query, terminal status+generation CAS, all admission checks. `void row; void lease` only avoids unused-variable compilation errors. Mutant2/2 fail in4.561s, exit1: `.task143-ownership-mutant.log`. BOTH fail full durable snapshot equality before B release; no barrier/test timeout. Actual A order affected counts success[1,1],failure[1]; terminal affected counts[0] in each, demonstrating terminal CAS alone does not protect business writes. B event remains PROCESSING/gen2.
- Enabled source byte-restored before broad18suites81/81,29.372s: `.task143-ownership-regression.log`. Includes focused ownership/distinctfailure/prelock/cutoff/ABA/competing/failedsuccessor/expiredcandidate/expiredsuccessor/fenced/failedretry/distinctsuccess/signature/recovery/tenant/orderconfirm races.
- Final focused2/2,4.039s `.task143-ownership-focused-final.log`.
- Outer SOURCE_RESTORED status0; `cmp .task143-ownership-disabled-source tixmoapi2/src/api/payments/service.ts` exit0; final disabled build exit0 `.task143-ownership-disabled-build.log`. Product diff empty.

Initial attempt is NOT mutation evidence: controls2/2 passed but removal caused TS6133 unused row/lease and0 tests. Outer exited1 and restored source; `.task143-ownership-runtime-final.log` preserves cleanup/failure. Initial focused/mutant filenames were overwritten by successful rerun; compiler diagnostics were observed directly, not retained as standalone logs. No claim that initial mutant was a durable failure.

Both fresh owned runtimes cleaned: initial PG1165711/Redis1165724 ports22194/58178; successful PG1166723/Redis1166736 ports37540/42213. After final run `ps -p` all four absent, `ss` all four ports empty. Existing unrelated untracked artifacts preserved. No live provider/production/defaultmerge/config/scheduler/spend/secrets/external actions.
