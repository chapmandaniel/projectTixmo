# Task434: fresh full unfiltered API verification

Exact reviewed candidate `fcab880ea7caf50493439a21032b7a93effc438f`.
Branch `tixmo/task-434-full-api`; isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-434`.
Task427 source remains unchanged. Evidence only; independent lead review required.

## Authorization and provenance

Read QA/repository instructions, required team documents, tasks427/429/430/424,
full427 README/runtime and composed native/outer guards, run-gate DI,379 path
validator and393 cleanup observer, verification-safety and actual verify-api.
Existing reviewed runner used, no new runtime framework or dependencies.
PM grants sole DB owner for this cycle; unrelated7071/7502/7194/7620 untouched.
Preflight discovered build invokes Prisma generation despite initial prohibition.
No runtime was started until PM explicitly corrected scope to permit the exact
unchanged build generation solely within independent owned copied dependencies;
verbatim correction in scope-correction.txt.

Disk preflight164GiB free; existing API dependencies338MiB, copied via
`cp -a --reflink=auto /home/daniel/projects/projectTixmo/worktrees/task-424/tixmoapi2/node_modules tixmoapi2/node_modules`.
No install/download. Package/lock/source schema byte-match; generated schema
formatting differs but whitespace-normalized content exactly matches. Engines
local and hash-matched; recorded generated/client/compiler/engine files have
independent inodes and nlink1, never a shared dependency link. Existing source
provenance and post-build generation hashes retained. Source-manifest records
all tracked non-evidence files; final comparison must remain unchanged.
Initial byte-equality-only generated-schema preflight failed before any copy or
services; bounded read-only diff confirmed formatting-only differences, followed
by successful normalized comparison. No source repair or assertion changes.

## Exact command and runtime

`TASK427_PM_RUNTIME_GRANT=source-reviewed-sole-owner bash docs/team/evidence/task-427/runtime.sh > docs/team/evidence/task-434/runtime.log 2>&1`

Runner reexecs env-i with fixed Node24 PATH, private0700 disk runtime,
synthetic local provider/JWT fixtures only, fresh current-run identity, verifies
owned loopback listeners before DB connections, and preimports both guards.
Commands.jsonl records unchanged verifyApi build/migrate/schema/full Jest;
only JSON result capture is added. Full outer timeout360s plus startup/cleanup,
no filtering, skip additions, retries, assertion weakening or source modifications.
Native/subprocess traffic is not an OS sandbox. No external network/provider/
mail/cloud/spend/config/scheduler/push/merge/deploy performed.

Owned runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.SVyaBI`;
PG3435925:39710 Redis3435938:41941. Node24.21.0/npm11.19.0,
Prisma5.22.0/TypeScript5.9.3/Jest30.5.2. PostgreSQL18.6/Redis8.0.5 are
NONPARITY relative to task245 PostgreSQL17/Redis8.2.10, not parity acceptance.

## Real HTTP100 receipts

Native HTTP listener127.0.0.1:33683, recorded current Jest PID3436596/run identity.
100 buyers arrived/completed;100read200+100order201, maxActive2/maxQueue1,
elapsed3404.52ms; readp95=17.58ms/orderp95=31.38ms. Full suite checks unchanged
inventory uniqueness,100held then cancellation restoration, lease drain and
cleanup. This synthetic local correctness measurement is not a capacity/SLA,
real-provider/browser or launch acceptance claim. cleanup.json records
serverListeningfalse/cleanupErrors[]. Full raw measurements retained.

## Scope

Task424 original market audit/API failures remain retained; this run is solely
a fresh API result, not full-market GO or task424 closure. Scoped evidence goes
REVIEW, not selfapproval/done. No integration/push/deployment performed.

## Final result: PASS (API only)

Entry exit0. Build0/migrate0/schema0/full Jest0.100 suites PASS,0 FAIL,
10 SKIP/110 total;804 tests PASS,0 FAIL,26 SKIP/830 total;0 snapshots,
232.274s. No timeout or retries. All suites unfiltered; existing skips retained.
Raw commands/stdout/stderr/Jest JSON, measurement and listener/current-run
receipts retained under raw/. No blocked-network log was created.

Runner cleanup passed and independent-cleanup.json separately observes PG,Redis,
Jest,timeout and gate PIDs absent; all3owned ports empty, no remaining runtime
sockets/postmaster pidfile/workers, no dependency link. Unrelated4service PIDs
remain present. Full non-evidence source manifest unchanged. Services stopped,
sole DB ownership RELEASED. Dependency copy remains owned and isolated, not linked.
API result is current exact-candidate acceptance evidence; it does not supersede
full-market audit failure, target parity, provider, capacity, or launch gates.
