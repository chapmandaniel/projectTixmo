# Task326 Stage B — diagnostic findings, guarded-local FAIL

Product base remains `4ec8594850eb547dafc145a14bb1b85cdeaa235c`, branch `tixmo/task-326-smoke-storage-diagnostics`. StageA `83fa67f3de7f4b456a76f793a411a71e428c03e9` preserved (stage-A-README.md and Git history). PM explicitly granted sole DB ownership after328 `fa7fe10` cleanup. No product/test/assertion/SQL-policy fix was made; this is evidence and task-owned diagnostic instrumentation only.

## Fresh focused execution

Entry command both runs: `bash docs/team/evidence/task-326/runtime.sh > docs/team/evidence/task-326/runtime.log 2>&1`; first exact script/output retained under stageB-1. Script scrubs inherited environment with env-i before application imports, uses CHECKPOINT_DISABLE=1 and task326 pre-import hard nonloopback guard. Matching dependencies copied `cp -a` from318 into owned326 tree after174G free check; generated client index distinct inode1084841/nlink1 versus318 inode571658/nlink1. No writable hardlinks/shared generation. Existing PG18/Redis executables and existing Prisma binaries only, no install/download/provider credentials or .env. Owned0700 disk-backed runtime, exact service identity/listener assertions and disposable safety validation before schema effects. Prisma generate and migrate deploy exit0 on both runs; Jest setup then applies schema to this disposable database. No full API/market rerun.

- First focused run: smoke, approvals integration, upload.service and upload-cleanup unit suites. **3 passed /1 failed suites,28 passed /1 failed tests**, zero skipped;18.838s. Jest exit1; guarded runtime exit1 independently because S3 attempt was blocked. Original smoke `sales.totalOrders >=1` fails (actual0). All other focused cases passed.
- One bounded harness-only enhancement added **raw SQL** predicates/type/raw timestamp/explicit UTC interpretation and cumulative counts to existing JS diagnostics. Original behavior/assertions/filters untouched. Fresh smoke-only run: **1 failed suite /1 failed test**,12.841s, Jest/runtime exit1. Zero blocked calls in second run. No further retry/fix.
- Both JSON results: zero runtime-error suites, no interrupted run, openHandles[]; no unhandled/open-handle warning observed, not detectOpenHandles instrumentation. Full current raw logs/Jest JSON and compact summaries retained for each run.

## Proven smoke failure: timestamp comparison/session timezone

Second run `smoke-predicates.json` contains exactly one created order:

| Evidence | Value |
| --- | --- |
| Status/payment/currency | PAID /SUCCEEDED /cad |
| Organization | Order event organization equals dashboard requested organization |
| Prisma createdAt | 2026-10-21T08:34:43.548Z |
| Dashboard exact end bound | 2026-10-21T08:34:43.678Z |
| DB column type/raw value | timestamp without time zone /2026-10-21 08:34:43.548 |
| DB session timezone | America/St_Johns |
| Same end bound as timestamptz | 2026-10-21 06:04:43.678-02:30 |
| SQL paid/currency/org/start | true /true /true /true |
| SQL original end predicate | **false** |
| Explicit UTC interpretation start/end | true /true |
| Cumulative counts all→paid→currency→org→start→original end | 1→1→1→1→1→0 |
| Diagnostic explicit-UTC interpretation count | **1** |
| Existing paidSalesSource/direct/dashboard counts | **0 /0 /0** |

Application/DB clocks describe the same instant; no evidence of clock skew, unpaid order, currency or organization mismatch. JS comparisons pass both bounds. SQL timestamp-without-timezone versus timestamptz comparison interprets stored UTC-naive value in nonUTC session timezone, placing it2h30 later and outside exact upper bound. The controlled alternate UTC interpretation restores inclusion without changing window boundaries, currency, org or status. This is diagnostic comparison only, not modified production query or corrected passing smoke.

**Narrow proposal to original backend author:** explicitly compare UTC-normalized timestamp values at query boundary (prefer parameter-side timestamptz-to-UTC timestamp conversion so indexed column remains bare), preserving exact date/org/currency/status predicates and >=1 assertion. Add actual SQL regression coverage under UTC and America/St_Johns sessions, including exact start/end and outside-window cases, without connection-global timezone mutation or widening window. Scope any other raw timestamp comparisons only after evidence/review; this task has not fixed or qualified such changes.

## Storage attempt now attributed, still blocked

`stageB-1/blocked-network.jsonl` has one deny-before-connect record:

- Test: `tests/integration/approvals.test.ts`, **Creative approvals API requires owner or admin curation before approved image assets enter the library**, phase test.
- UTC time2026-10-21T08:33:19.325Z; PID2903963; https host `s3.us-east-1.amazonaws.com`.
- Sanitized stack retains `src/services/upload.service.ts:152` → `src/api/approvals/service.ts:995`, plus SDK frames. Exact fixture deletion is tests/integration/approvals.test.ts566-574. This is fresh narrow-run attribution; do not retroactively claim318's host-only record proved this origin.
- Guard threw before HTTP connect; approval service catches deletion error, so approvals suite PASS is **not** a clean-network gate pass. The guarded run is FAIL even though that test passed. No actual AWS/provider request or credentials were used.

**Narrow proposal:** responsible approvals fixture should provide an inert local delete transport and assert exact key/call/cleanup behavior, while storage unit tests assert configured delegation with mocked client. Any product change to unconfigured-test delete behavior requires separate explicit scope and independent review; do not blanket-swallow failures or claim actual provider deletion.

Guard records only fixed run ID/PID/time, sanitized hostname, repo-relative frame locations and fixture path/name/phase; no headers/bodies/credentials/signed URLs/arbitrary env values. It is a Node guard, not OS network namespace/native executable isolation.

## Cleanup, checks and handoff

`cleanup.json` proves both runs' four PG/Redis PIDs absent, four listeners closed, postmaster files absent, no socket files, no task326 Node/Jest/API workers or context files. Runtime roots mode0700; no API server/browser launched. **DB ownership released.** Private disk roots retained for diagnostics only, no services remain.

Pure guard policy/redaction and syntax checks passed in StageA; all CJS and shell syntax plus git diff-check passed after StageB. Source/provenance hashes retained. Product/source/test diff versus4ec85948 empty. Command-scoped synthetic Git author/hooksPath only; no repo/global config change. Evidence goes to review, not done. No provider/staging/fullgate/releaseGO, secret/AWS access/spend/merge/deploy/scheduler action. Native parent progress relay failed once (hook relay unavailable); final completion carries findings, no alternate session messaging attempted.
