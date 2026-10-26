# Task160 independent QA: admission generation ABA checkpoint

2026-10-20, tixmo-qa. Scoped TEST/EVIDENCE checkpoint PASS. Task143 remains OPEN; expired recovery DISABLED; release NO-GO.

## Exact review/isolation

Fresh detached `/home/daniel/projects/projectTixmo/worktrees/review-160` at `8bd93fa4b76f6631c41d0618d5ee9eec50055252`, compared with `d5010c3b2804dbf1f34663311ed44de03f794e38`. Diff adds only the54-line ABA integration test and32-line author evidence; no product/schema changes. Main, author and prior review source checkouts unchanged. Reused existing task143 API node_modules through a local symlink, no installs/spend; Prisma client generation reused that dependency directory with unchanged schema.

Read actual author report, test and complete admissionaba outer/runtime helpers before execution. Copied helpers to `.task160-admissionaba-{outer,runtime}.sh`; full-body equality confirmed after only own checkout/task-label substitutions. Full141 UID/PID/executable/datadir/direct-child/loopback/listener/readiness/verification-target/bounded-cleanup guards and timeouts retained. PM explicitly assigned sole fresh disposable runtime ownership.

## Fresh actual checks

All artifacts relative to this absolute checkout; complete exact commands and suite paths in `.task160-admissionaba-runtime.sh`.

- `bash .task160-admissionaba-outer.sh > .task160-admissionaba-runtime-final.log 2>&1`: exit0.
- API build40s TERM/5s KILL: exit0; `.task160-admissionaba-build.log`.
- Fresh disposable `prisma migrate deploy`30s TERM/5s KILL: exit0, all migrations applied; `.task160-admissionaba-migrate.log`.
- Focused control40s: exit0,2/2,4.903s; `.task160-admissionaba-focused.log`.
- ONLY admission generation predicate mutant40s: expected exit1,2/2 failed at actual database affected-row assertion line50 (`Expected:0`, `Received:1` twice),4.398s; `.task160-admissionaba-mutant.log`. No barrier/Jest/subprocess timeout. Enabled source restored/cmp-checked before broad run.
- Restored broad65s: exit0,15 suites76/76,24.826s; `.task160-admissionaba-regression.log`.
- Outer EXIT restored disabled source byte-for-byte, `SOURCE_RESTORED status=0`; independent `cmp` exit0 and `git diff --exit-code -- tixmoapi2/src tixmoapi2/prisma` exit0. Source line14 remains false.
- Final disabled-source build40s: exit0; `.task160-admissionaba-disabled-build.log`.

## Independently inspected oracles

Both FAILED and expired PROCESSING cases directly invoke private `beginWebhookEvent`. A reads generation7 then pauses before real updateMany outside any transaction. B genuinely admits generation8. Explicit synthetic fixture update returns B row to same eligible status/ancient processingStartedAt with generation8 retained. This is fixture choreography, not a public handler lifecycle claim.

Control A affects0 rows and returns null; full successor event, target/other-buyer orders with ordered tickets, full inventory and ticket/event counts remain unchanged. B admission preserves business snapshots too; all notification mocks are uncalled. Five-second barrier/finally drains and15s Jest cases are retained.

Mutation removes ONLY `attemptGeneration: existing.attemptGeneration` from admission where; id and BOTH FAILED/expired-PROCESSING branches remain. Both real stale updates affect1 row, durable generation reaches9 while stale return fabricates generation8. Parsed fresh focused/mutant log JSON independently confirms generations, unchanged eligible status/time, retained OR predicates, full control snapshots and actual count oracle; `.task160-admissionaba-oracle-check.log`.

## Cleanup

Owned PostgreSQL PID1120196 port35506, Redis PID1120209 port50242. Runtime cleanup exit0; independent post-cleanup `/proc` absence and empty `ss` listeners passed, `.task160-admissionaba-cleanup-check.log`. Inherited services untouched. No owned runtime remains.

## Limits

Checkpoint only: generation-only private admission sensitivity under synthetic eligible-state ABA. No public whole-handler acceptance, arbitrary ABA lifecycle proof, new missing-intent/failure TOCTOU tests, all remaining139 mutations/full139 acceptance, task143 completion, deployment/merge/provider/financial/config/scheduler/secrets/external actions. Recovery stays disabled. Independent lead161 remains a separate gate; no further implementation performed.
