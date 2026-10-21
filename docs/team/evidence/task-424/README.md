# Task 424: exact candidate local qualification

Author: tixmo-release. Exact source `8aae387bcd4290edd259fd75aa11baaa1f62ca63`.
Branch `tixmo/task-424-full-market`; isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-424`.
Documentation-only successor for independent QA425; no self-closure or source repair.

## Exact full market result: FAIL / qualification incomplete

Read exact source scripts, readiness document, role/team workflow and task362
safe runner before execution. Existing built-in verifier/DI and local tools used;
no new product solution/dependency introduced.

Entry command: `bash docs/team/evidence/task-424/runtime.sh > docs/team/evidence/task-424/runtime.log 2>&1`.
The runtime first reexecs `env -i` with fixed Node PATH, then creates synthetic
loopback PostgreSQL/Redis URLs and inert JWT/Stripe fixtures. Existing server
services were not touched. No inherited DATABASE_URL or real credentials.

Exact `npm run verify:market` exit1: stage1 `npm --prefix tixmoapi2 audit`
attempted registry.npmjs.org HTTPS, blocked before request by inherited
pre-import Node guard. market.log and audit-blocked-network.jsonl retain proof.
12 actual script stages:0 PASS,1 FAIL,11 NOT REACHED. No API/test counts may be
attributed to this failed market command. No offline audit/cache pass or audit
bypass, source/test/assertion/baseline weakening, or retry. Readiness document's
8-stage list is stale relative to actual12-stage script. One bounded diagnostic
was source/log inspection, retained in diagnostic.json.

Repair handoff: PM/lead/release-tooling owner must reconcile fresh advisory-audit
network requirements with an authorized execution environment, and update stale
readiness documentation. This is an environment/policy prerequisite, not an
observed waiting-room product defect. No permission for external audit was
assumed. Full market acceptance remains OPEN.

## Supplementary checks (not full market PASS)

PM explicitly authorized existing direct API/dashboard gates after audit failure.
Copied exact package/lock-matched existing task362 API dependencies with
`cp -a --reflink=auto .../task362/tixmoapi2/node_modules tixmoapi2/node_modules`.
Writable generated client/compiler files have distinct inodes/nlink1;
dependency-isolation.json and dependency-source.json retain provenance.
Node24.21.0/npm11.19.0/TypeScript5.9.3/Prisma5.22.0/Jest30.5.2.
PostgreSQL18 and Redis binaries are existing task57 offline runtime; exact
version receipts below. This is not target-version parity or task245 evidence.

API uses task362 inspected DI interface with full unfiltered sequence and only
raw child capture plus Jest JSON output. Commands/statuses in commands.jsonl,
raw1-4stdout/stderr and jest-result.json. Original product verifier is unchanged.
Market-block log was moved to audit-blocked-network.jsonl while supplementary
API ran, so supplementary blocked-network.jsonl independently measures API.
Runtime copy retains this external orchestration detail; do not infer zero
market blocked attempts from absent API blocked log.

Dashboard: byte-matched task251 package/lock existing deps, temporary read-only
node_modules link; no install/download. dashboard.sh records exact scrubbed
commands and guard.250/250 tests PASS,34/34 files PASS,0 failed/pending/todo;
Vitest nested suite counters75 are not file counts. Strict unchanged design
guard PASS,924 tracked baseline violations/no regressions. Production build
PASS2137 modules/13.28s. All three exit0, rawlogs/JSON/exit receipts retained.
Temporary dashboard dependency link removed. No dashboard blocked-network log.

## Scope and boundaries

Source manifest hashes tracked non-evidence files. API guards are accidental
Node net/TLS/http/fetch protection, not OS/native/subprocess network isolation.
Synthetic providers/mock transports only. No install/download/network/provider/
cloud/spend/config/scheduler/merge/push/deploy. No unrelated private memory read.
Local correctness checks do not establish capacity, real-browser/provider flows,
staging parity, launch readiness or release GO. Historical362 results are not
inherited as current passes. Independent QA must review exact evidence commit.

### Existing real Redis/Lua supplementary test

After inspecting `scripts/waiting-room-redis.test.cjs`, executed once:

```sh
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/home/daniel NODE_ENV=test TIXMO_TEST_REDIS_URL=redis://127.0.0.1:50913/1 NODE_OPTIONS=--require=/home/daniel/projects/projectTixmo/worktrees/task-424/docs/team/evidence/task-424/network-guard.cjs TASK424_BLOCK_LOG=/home/daniel/projects/projectTixmo/worktrees/task-424/docs/team/evidence/task-424/lua-blocked-network.jsonl timeout --signal=TERM --kill-after=5s 20s node --test scripts/waiting-room-redis.test.cjs
```

Exit0:1PASS/0FAIL/0SKIP. Actual existing Lua checks two clients/20 contenders
with2 admissions, idempotent same identity at capacity, expiry/replacement and
duplicate release. Random uniquely scoped key cleaned in finally. No blocked
network entries. Missing-env warning expected: this Redis-only probe receives
no database or JWT settings. This is not real HTTP pressure/abort-load evidence.
Runtime binaries:PostgreSQL18.6(Ubuntu18.6-0ubuntu0.26.04.1),Redis8.0.5;
not production-like target PostgreSQL14/Redis7 parity.

## Final supplementary API result: FAIL

Build0/migrate0/schema0; full unfiltered Jest exit1,231.896s.110 suites:
99PASS/1FAIL/10SKIP.830 tests:803PASS/1FAIL/26SKIP.0snapshots. Existing
skips unchanged. summary.json retains exact failing assertion/raw stack.
Failure: `tests/integration/orders-http-pressure.local.test.ts:24`,
`Require task379 runtime artifact directory`. No rerun or test selection.

Bounded diagnostic reads the failed test and task379/runtime-path.cjs: this
unconditionally collected local pressure test additionally requires a current
TASK379_RUN_ID, task379-specific0700 disk artifact path, and native guard listener
registration. Merely setting one env variable is NOT a safe repair. Generic
verifyApi has no provisioning for that reviewed specialized runtime contract.
Original pressure-test author/release-tooling owner should make full-gate runtime
composition coherent with those safety requirements; do not skip/weaken the test
or fabricate guard/artifact acceptance. PM owns deduplicated repair dispatch.
No product source repair performed. The HTTP test failed before listener setup;
no pressure/capacity acceptance is claimed.

## Cleanup and handoff

Owned runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task424/run.QRVtYl`
is0700 disk. PG3394179/Redis3394192 absent; loopback ports30896/50913 empty;
no sockets/postmaster pidfile/owned workers. check-cleanup.py passed and writes
cleanup.json; supplementary API blocked-network attempts0. Dashboard link absent;
API uses an independent copy, not a dependency link. Logs retained, services
stopped, sole DB ownership released. No force-exit of Jest, timeout or cleanup
failure. Product-directory diff against exact source empty. bash-n/runtime,
node-check/DI harness and git-diff-check passed.

Submit REVIEW, not done: actual two gates FAIL (audit boundary and pressure
runtime precondition); supplementary dashboard and standalone Lua PASS do not
make market/API green. Independent QA425 checks this exact documentation-only
SHA. Commit uses command-scoped identity/hooksPath only, no Git config mutation.
