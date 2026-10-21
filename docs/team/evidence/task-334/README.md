# Task334 Stage A — READY FOR DB, NOT RUNNING

Branch `tixmo/task-334-approval-storage-fixture`, isolated task334 worktree, exact product base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. Task333 remains sole DB owner; StageA includes no DB/services/Jest/integration/runtime execution. Claim334 retained, runtime acceptance unfinished.

## Narrow fixture repair

Task326 `8726384e97d5f799ccb4acb76982cb2891a49d42` freshly attributed blocked-before-connect S3 call to approvals curation test, `upload.service.ts152` -> `approvals/service.ts995`, after authorized delete route invocation. It is not evidence of a real provider request.

Only `tixmoapi2/tests/integration/approvals.test.ts` is changed. Import existing uploadService singleton; inside the responsible curation test, read the actual approval asset's private storage key from its disposable fixture row (not public DTO, which intentionally omits it). Immediately around the final real delete HTTP request, install an inert resolved `deleteFile` spy. Assert exactly one call with the actual key, original200/body/approval-removal expectations and explicit asset cascade removal. Restore the spy in finally even if an assertion fails. Existing403 noncurator refusal, owner promotion, archive/list behavior and other tests remain unchanged. Real auth/routes/service/Prisma effects stay active; upload/URL resolution and unrelated behavior are not mocked.

No production change, storage configuration change, blanket catch/fallback or guard disable. Existing configured storage unit test at upload.service.test.ts224-234 still verifies DeleteObjectCommand exact Bucket/Key and client send; that file and all production source are unchanged. StageA cannot claim the new fixture passes until actual focused guarded SQL execution.

## Checks actually completed

- 173G free before copying matching candidate dependency tree from326 with cp-a into owned334 node_modules; cmp package-lock passed. No hardlink/shared generated-client writes, no dependency install/generation/network.
- Scrubbed `env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin CHECKPOINT_DISABLE=1 node docs/team/evidence/task-334/source-check.cjs` passed TypeScript transpile diagnostics and static fixture-scope checks only. It loads TypeScript, not app/Jest setup. No semantic/runtime/Jest pass claim.
- Node syntax checks of task CJS helpers, focused Prettier check and git diff-check passed. Raw pure-check output retained in stage-A-checks.log. No AWS/provider/credentials/network attempt, cloud/spend/merge/deploy/global configuration action.

## Prepared guarded StageB, awaiting explicit PM DB grant

Task-only network-guard.cjs is copied from326's sanitized stack/time/PID/context pre-import hard denial, with334 markers. context.setup.cjs adds fixture attribution only, no smoke/analytics instrumentation. jest.config.cjs preserves original setup and adds task context. These files have syntax checks only, not executed by Jest yet. Use scrubbed environment/CHECKPOINT_DISABLE and preload this guard before imports; no arbitrary env/headers/bodies/secret values in records. Node guard is not an OS network namespace.

After PM releases333 DB ownership, use fresh owned0700 disk-backed task334 PG18/RedisDB1 runtime, exact PID/listener identity/safety checks, owned generated-client provenance and mandatory cleanup. Run focused approvals + upload.service + upload-cleanup only with original guard active. Require all focused assertions PASS and **zero** blocked attempts, even if library catches a blocked call. Record exact test/product SHA/commands/counts/rawlogs and cleanup every worker/listener/socket/context file. No fullgate or provider claim. Source and QA exactSHA review remain required. Do not run before explicit grant.
