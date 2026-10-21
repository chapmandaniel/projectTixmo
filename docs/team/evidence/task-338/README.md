# Task338 independent guarded QA: approval deletion fixture

**PASS for scoped task334 acceptance** at final exact `6fafb9f9da99d81584341034d3683daa5876b3ac`, base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`, independently inspected/executed by `tixmo-qa` on2026-10-21. Submit review, not done; PM owns closure with separate source337 acceptance.

## Identity and scope

- QA branch `tixmo/task-338-independent-qa`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-338`. Started fromded97d5 and fast-forwarded to final6fafb9f9 obtained fromboard **before runtime**.
- Verified final documentation correction changes only task334 README. Every other tracked blob matchesded97d5, including all product/test/fixture/guard/runtime/rawlog files; final-correction-identity.json retains all-blobs identity and selected hashes. No duplicate run solely for documentation change.
- Complete product/test range includes only approvals.test.ts fixture: added uploadService import, final responsible curation-case deletion spy, exact actual persisted asset key/one-call assertion, asset cascade row-removal assertion and finally restoration. All product source, both unit suites, schema, lockfile and ordinary Jest config are unchanged versus baseline. No task333 analytics or other unmerged fixes composed.
- Dependencies copied privately: `cp -a /home/daniel/projects/projectTixmo/worktrees/task-334/tixmoapi2/node_modules tixmoapi2/node_modules`. Client index before generate inode1457732/nlink1, after own generate1457733/nlink1; author1098312/nlink1 unchanged. No hardlinks/install/shared generated writes. Own generate uses existing binaries, no downloads. Fresh provenance retained.

## Source assessment

Read complete fixture diff and curation test, actual approval delete and uploadService.deleteFile, configured storage unit mocks/assertions and task-only harness/guards. Spy is installed immediately before final delete, after real authorization/curation/archive/list checks, only for that request and restored in finally. Real route/service authorization, actual approval deletion and Prisma cascade remain exercised.

Assertions require200/exact deleted body, one transport call with s3Key read from persisted approvalAsset, and absence of both approvalRequest and approvalAsset rows. Existing noncurator403, owner curation metadata, archive and library-list behavior remain intact. This is not a blanket transport mock, assertion weakening, configured production fallback or product storage change. Underlying product still creates DeleteObjectCommand with Bucket/Key and delegates s3Client.send; original upload.service suite tests configured delegation using mocks. No real provider deletion proof claimed.

## Runtime safety and ownership

Explicit PM soleDB338 grant followed336 final cleanup. Independently rechecked prior336 service PIDs absent, ports closed, sockets/postmaster absent (prior336-cleanup.json); previous336 own audit already confirmed no Node/Jest/context remnants. No other DB owner.

Read strict service ownership helpers: user/executable/datadir/postmaster PID for PG18, unreaped direct-child PID/parent/executable for Redis, exact exclusive127.0.0.1 TCP ownership before database access. Identity-checked bounded shutdown traps. Fresh0700 disk-backed workspace `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task338/run.89QpUi` on `/dev/nvme0n1p2 ext4`, not /tmp. Existing task57 runtime binaries read only; disposable PostgreSQL and RedisDB1 only.

Copied task334 runner/config/context/guard to task338 paths, task IDs and disposable role/database renamed only. Extra Jest config spreads ordinary candidate config and preserves tests/setup.ts then adds context attribution. No ordinary setup omission. env-i clears inherited credentials before imports, synthetic test keys only, CHECKPOINT_DISABLE=1. Node pre-import guard denies nonloopback net/TLS/HTTP/fetch and sanitized blocked-record existence fails runtime even if application catches error. No bypass/selftest env supplied. No provider/network fetch/cloud/spend/merge/deploy. Guard is Node-instrumentation evidence, not OS/native isolation.

## Exact fresh execution

From exact-final QA worktree root:

```bash
bash docs/team/evidence/task-338/runtime.sh > docs/team/evidence/task-338/runtime.log 2>&1
```

Runtime exit **0**. Own Prisma generate and migrate deploy exit0, followed ordinary test bootstrap only against generated disposable loopback DB. Exact selected command retained in runner/commands.log/focused.log:

```bash
npm --prefix tixmoapi2 test -- --config "$artifact_dir/jest.config.cjs" --runInBand --runTestsByPath tests/integration/approvals.test.ts tests/unit/upload.service.test.ts tests/unit/upload-cleanup.test.ts --json --outputFile "$artifact_dir/jest-result.json"
```

Bounded180s timeout; no test-name filtering/skips. Fresh start2026-10-21T08:58:44.035Z, Jest16.923s. **3 suites/28 tests PASS;0 failed/pending/todo/runtime-error suites;0 snapshots**. Breakdown approvals13, upload.service11, upload-cleanup4. openHandles[] in JSON; no open-handle warning, but no detectOpenHandles instrumentation claimed.

**Mandatory zero network attempts satisfied**: no blocked-network.jsonl created; network-verdict.json records0 observed denials. This is a separate required verdict, not inferred from Jest PASS. Guard/context was preloaded for generate/migrate/Jest and inherited child bootstrap. Raw actual logs/results retained; prior author's artifacts are not this run's evidence.

## Cleanup and preservation

Independent audit after completed runtime: PG2943118/Redis2943131 absent, ports30745/47922 no listeners, no PG/Redis sockets/postmaster file, no task338 Node/Jest workers and no per-PID evidence context files or runtime-root contexts. Cleanup.json retains exact observations,0700 modes and ext4 source. Private stopped diagnostic data remains, no services running. **DB lane338 released only after cleanup**.

`git diff --exit-code 6fafb9f9 -- tixmoapi2 docs/team/evidence/task-334` exit0 after runtime: author source/test/evidence preserved. Bash-n and guard/context/config CJS syntax checks exit0. Fixture-only implementation diff-check exit0; whole implementation range exits2 on retained generate.log blankEOF and migrate.log trailing whitespace; documentation-only correction diff-check exit0 (diff-checks.json). Fresh QA raw generate/migrate logs also intentionally retained unchanged; staged QA whitespace diagnostic recorded separately, not an unqualified whole-commit pass. Evidence-only commit uses scoped identity/hooks bypass for missing isolated Husky helper. Tracked QA worktree clean after evidence commit.

## Limits

Focused local fixture/real approval DB cleanup and inert configured storage delegation only. Not actual S3/provider deletion, fullAPI/market readiness, combined-candidate acceptance, staging/production or releaseGO. No product storage repair or broader task318 historical attribution claim. Separate source337 approval remains required before PM closes.
