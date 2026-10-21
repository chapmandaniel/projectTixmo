# Task326 Stage A — READY FOR DB, NOT RUNNING

Base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`; branch `tixmo/task-326-smoke-storage-diagnostics`, isolated task326 worktree. Read task320 `a041c35ceb95d6a41d2cc9c2a68681971e8817b2` and task318 `aa64c2c59bba570ec39958d06e004cfbc7b2ad59`. Stage A is source/harness preparation only. Task328 remains sole DB owner; no DB/services/Jest/runtime/integration run was started. Task326 runtime acceptance is unfinished, no cause/attribution/pass claim and no request to close.

## Prepared task-owned files

- `network-guard.cjs`: intended future pre-import NODE_OPTIONS guard; retains nonloopback deny-before-connect for net/TLS/HTTP/fetch, structured repo-relative stack file/line/column, UTC timestamp/monotonic time, PID/fixed run ID and current Jest fixture context from per-PID private metadata. Host extraction removes userinfo/path/query; no request bodies/headers/token/env dumps. Dropped external stack frames avoid unrelated filesystem disclosure. Blocked calls remain gate failures even if swallowed. Node-level guard, not native executable or OS network-namespace isolation.
- `diagnostics.setup.cjs`: extra Jest setup, with suite/test context metadata. BeforeEach installs a task-only spy for smoke's existing `getDashboardSummary`, invokes original unchanged, then captures whitelisted fixture order ID/status/paymentStatus/currency/createdAt/eventId/event-org and exact returned30-day window, per-predicate booleans, application and DB wall/session-timezone clocks. Direct sales analytics and exact existing `paidSalesSource` SQL count use the same currency/org/start/end values. Returns original dashboard payload. No frozen clock, fixture edits, predicate widening, assertion change or production instrumentation. Query diagnostics are disposable-local only. No emails, ticket barcodes, tokens, financial amounts or customer data selected.
- `jest.config.cjs`: extends original candidate config/setup and adds only task diagnostics. Narrow intended suites: smoke and approvals/storage. Existing smoke assertion `>=1` and all date/org/currency filters remain unchanged. Previously blocked S3 origin is **not attributed**; stack/context coverage may still require a narrower caller seam after evidence.
- `guard-selfcheck.cjs`: pure allow/deny policy and record-schema/redaction checks only; no connect/request/fetch invocation. Selftest mode does not install network shims, because no network API is called. No runtime dependencies copied/installed/generated in this stage.

## Completed source-only verification

`node --check` passed for guard, diagnostics setup, Jest config and pure selfcheck; `git diff --check` passed. Scrubbed pure check:

```
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin TASK326_GUARD_SELFTEST=1 CHECKPOINT_DISABLE=1 node docs/team/evidence/task-326/guard-selfcheck.cjs
```

Output retained in stage-A-checks.log: PASS policy/sanitized records, no network API invoked. These are syntax/pure checks only, **not Jest/module-resolution/type/runtime validation** of future diagnostics.

## Pending PM-controlled stage B

Do not execute integration commands until PM explicitly releases task328's DB slot to326. Then inspect current ownership, prepare scrubbed environment and owned0700 disk-backed PG18/RedisDB1 runtime using318's strict exact-PID/listener identity and cleanup trap; use CHECKPOINT_DISABLE=1 and owned dependency copy without writable hardlinks/shared generated Prisma cache. Verify targets before schema effects. Load hard guard before imports; preload path must name this task's guard, not318's host-only version. Execute only focused smoke and approvals/storage suites with original tests and extra config, capture exact candidate/command/exit/current failures plus every blocked record. Blocked records independently fail the guarded run. Verify every owned process/listener/socket removed, preserve evidence and release DB slot. No blind full gate retry. Preparation here does not authorize stageB or claim a completed runnable runtime.

No product/test/source assertions changed, no AWS/provider/network attempt, secrets, spend, scheduler/Gateway/global configuration, merge/deploy action. Remaining acceptance: actual SQL predicate/time root cause and originating storage caller, then evidence-backed narrow proposal to PM/original authors.
