# Task143 distinct-event failure pre-lock serialization checkpoint

2026-10-20, tixmo-backend. Test/evidence only over independently lead162/QA163-approved `51454f00587c43de7c6e9bae546e63452353fd34`, isolated task-143 worktree, branch `tixmo/task-143-fenced-processing-recovery`. Recovery remains DISABLED; task143 OPEN; release NO-GO. New exact SHA requires independent lead AND QA review before continuation.

## Scope and durable oracle

A genuine separately signed payment_intent.payment_failed event A and payment_intent.succeeded event B have distinct IDs but the SAME intent/order. A admits generation1 through the actual public handler and pauses immediately before its real withWebhookFence transaction: no event/order locks held. B independently admits generation1, binds the null intent, commits PAID/SUCCEEDED, fulfills two tickets once and sends one confirmation email. A resumes with its OWN still-valid generation1, re-reads the paid order inside its fence, cannot regress it, then legitimately completes its own event bookkeeping (terminal affected count1). There is no fixture expiration or same-event takeover in this test.

Before/after complete JSON snapshots cover target order and ordered tickets, another buyer order and ordered tickets, inventory, ticket cardinality4, event cardinality2 and B's complete PROCESSED event. Full equality is asserted; A's separate event is deliberately excluded from equality and independently asserted PROCESSED/generation1. Inventory remains available6/held2/sold2. Confirmation-email spy count1 and exactly one expected Payment Failed notification to A's buyer are asserted. Current failure notification semantics are preserved, NOT suppressed: a failure email may follow success even when failure cannot mutate the paid order. These observed fixture counts do NOT establish exactly-once notification delivery.

This is distinct-event conditional-order serialization before lock acquisition, NOT same-event ownership loss, after-protected-read TOCTOU, expired takeover acceptance, or handler-fence mutation sensitivity. No reversed schedule or mutation attempted within the bounded slice. Prior prelock test was not edited: its shared same-event terminal spy can label B's terminal call A-terminal before the A-only counter reset; its report/QA163 caveat remains applicable. New test filters A's distinct event ID, so its terminal trace count1 is genuinely A.

## Actual verification and artifacts

Root `/home/daniel/projects/projectTixmo/worktrees/task-143/`, artifact prefix `.task143-distinctfailure-`:

- `outer.sh`, `runtime.sh`: entire approved prelock/full141 runtime guard body preserved; only owned labels/cache/paths/test tail adapted. PM explicitly assigned sole runtime ownership. Fresh owned disk Postgres/Redis, loopback/exact PID/executable/datadir/direct-child/listener/readiness/verification-target checks and bounded cleanup deadlines retained; inherited DB never used.
- `build.log`: temporary enabled local-source API build exit0.
- `migrate.log`: fresh disposable migration deployment exit0, all migrations applied.
- `focused.log`: new case1/1 pass, 4.944s.
- `regression.log`: 17 suites79/79 pass, 27.502s (relevant prior78 plus new1).
- `focused-final.log`: exact final test1/1 pass, 3.851s.
- `runtime-final.log`: runtime exit0, SOURCE_RESTORED status0; owned PG1144389/Redis1144402 stopped; ports30630/41590 empty. Independent post-run ps and ss also returned no entries.
- `disabled-build.log`: final disabled-source API build exit0. cmp against saved disabled source and git diff --exit-code on product source both exit0.

Committed files are only the new integration test and this evidence report. Existing tracked/untracked artifacts preserved. No product/schema/activation commit, provider/financial/default-merge/deploy/production/config/scheduler/spend/secrets/external messaging changes. Full139 acceptance and independent exact-SHA reviews remain outstanding.
