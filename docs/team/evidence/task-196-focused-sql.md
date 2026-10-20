# Task196 focused real SQL verification

2026-10-20; release owner `tixmo-release`; branch `tixmo/task-196-focused-sql`, isolated `/home/daniel/projects/projectTixmo/worktrees/task-196`.
Exact candidate/base `52e504be4a902eac6c005d728fc75243f26350c1`; independently source-approved by lead193 (`98e2bf5`) and QA194 (`f95c810`). Evidence-only: no source, fixtures, assertions, deadlines, schema, config, manifests or locks changed. No184/186 mixed.

## Actual outcome

PASS focused scope only. Explicit `TIXMO_EXPERIMENTAL_RECOVERY=1`:

- Schema bootstrap exit0, wall0.84s.
- Jest exit0, wall7.98s (Jest7.324s), **2 suites passed, 8 tests passed, no skips**.
- Paused-owner baseline all3: fresh duplicate, expired before-handler, expired before-finish.
- Expired-successor all5: before-handler, stale success/failure while real B generation2 remains PROCESSING, and stale success/failure after B terminal. Real fenced stale terminal writes affected zero rows. Complete successor/after-stale snapshot equality preserved; raw logs contain all8 durable records. Additional independent JSON parsing is recorded in `snapshot-validation.log`.
- Owned runtime exit0; cleanup and subsequent PID/listener absence checks PASS.

## Exact execution and provenance

Read57/141 approved lifecycle and182 exemplar before use. Runtime script in `task-196-artifacts/runtime.sh` reproduces the entire command/environment and bounded cleanup. Its prefix through schema invocation is byte-identical to reviewed182 after only task labels/paths normalization (`guard-parity.log`). Main command:

```sh
env -u DATABASE_URL -u REDIS_URL bash docs/team/evidence/task-196-artifacts/runtime.sh > docs/team/evidence/task-196-artifacts/runtime.log 2>&1
```

Timed schema command uses30s deadline, `prisma db push --accept-data-loss --skip-generate --schema tixmoapi2/prisma/schema.prisma`; timed focused command uses90s ceiling with TERM then5s escalation:

```sh
npm --prefix tixmoapi2 test -- --cacheDirectory "$owned_run/jest-cache196" --runInBand --runTestsByPath tests/integration/payment-paused-owner.baseline.test.ts tests/integration/payment-expired-successor.test.ts
```

Existing task177 API dependencies reused through temporary symlink after exact API lock comparison; no install, hooks or config mutation. Link removed after execution. Runtime sets explicit disposable URLs and synthetic test fixtures, never inherits unknown DATABASE_URL. All test deadlines/assertions preserved. Source identity checks before and after execution and hashed inputs in `source-identity.log`; raw schema/focused/runtime logs, exits and timings retained.

## Runtime authority and teardown

PM sole-owner grant on196 and fresh board/process inspection: only196 doing, no competing UID1000 PostgreSQL/Redis/Jest. Unrelated UID70/999 services untouched. Fresh disk-backed mode0700 UID1000 runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task196.eT4pIt`, filesystem ext2/ext3. Exact PostgreSQL18.6 PID1338037 loopback28984; Redis8.0.5 direct child PID1338050 loopback59944. UID/executable/datadir/PIDfile/direct-child checks, unique loopback ownership, unique Redis socket INFO identity, SQL database/user/address/port and fail-closed target guard all passed before schema. Disposable database `tixmo_disposable_57` is isolated in this fresh cluster, not a reused service.

Approved bounded cleanup stopped both exact instances; runtime reports no listeners. Fresh independent worker check confirms both `/proc` PIDs absent and ports empty. PM also independently confirmed absence. Runtime disk data retained, not deleted. Native versions differ from CI14/7; compatibility parity remains unproven.

## Limits and handoff

No full API, build or full-market gate run or claimed.175/177 remain nonpassing / NO-GO; no launch, merge, deployment or production claim. No product repair. Independent QA must check this exact committed evidence and candidate before192 closure. Initial wrong exemplar filename reads returned missing-file errors without mutation; corrected to existing artifact `docs/team/evidence/task-182-artifacts/runtime.sh` before execution. No additional runtime work needed.
