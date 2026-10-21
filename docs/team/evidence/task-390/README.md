# Task390 bounded HTTP100 runtime qualification: FAILED

## Exact source and isolation

Executed reviewed source `b0d749d6962f75d6daee2836a4605e505daf4556`, from isolated
`/home/daniel/projects/projectTixmo/worktrees/task-390`, branch `tixmo/task-390-http-runtime`.
PM sole NEW disposable database ownership grant recorded on390. Existing unrelated
Postgres7071/7502 and Redis7194/7620 were inspected as process metadata only, never
connected/stopped. Required role/team docs,379/385 history, runner/test/guard/path
helper, Jest setup and verification-safety inspected before execution. No source repairs.
Existing Jest/Supertest/Prisma/Redis installed stack reused; no alternative custom build.

Runner preserves its reviewed hardcoded `task-379` path; new unique owned0700 disk
run: `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.XAQwvK`.
Preflight traversed ancestors, ownership/mode/symlink/realpath and disk allowlist.
Runner env-i removed inherited credentials, rejected ambient dotenv, used synthetic
fixtures only. No real secrets or provider/mail calls. Node guard allows explicit
owned IPv4 loopback ports, denies other TCP/Unix/UDP; NOT subprocess sandbox or
same-UID path race protection. Runtime/data retained privately; evidence copied here.

## Actual command, timing and result

```
TASK379_PM_RUNTIME_GRANT=source-reviewed-sole-owner timeout --signal=TERM --kill-after=12s 170s bash docs/team/evidence/task-379/runtime.sh > docs/team/evidence/task-390/runner.log 2>&1
```

2026-10-21T12:42:34Z to12:42:54Z, **exit1**. Runner self-scrub uses Node24.21.0.
Inner commands: owned initdb/pg_ctl/createdb/psql and Redis readiness/identity checks;
verification-safety guard; `timeout --signal=TERM --kill-after=5s 35s tixmoapi2/node_modules/.bin/prisma migrate deploy --schema tixmoapi2/prisma/schema.prisma`;
then `timeout --signal=TERM --kill-after=5s 110s npm --prefix tixmoapi2 test -- --cacheDirectory <owned-run>/jest-cache --runInBand --runTestsByPath tests/integration/orders-http-pressure.local.test.ts`.
Migration succeeded (log retained). Jest compiled/executed test, one failed test,
16.577s Jest total,9548ms test. No separate full API build or test run.
`bash -n runtime.sh`, `node --check` both helpers passed exit0 before runtime.

**0/100 GET200,0/100 POST201.** All200 entries status0 with
`Error: Task379 network guard rejected non-owned TCP target`. Assertion at test110
failed before inventory/unique order/ticket assertions.100arrived/100completed,
maxActive1,maxQueue1,elapsed3322.886ms. These are rejected socket attempts, NOT
successful HTTP, service capacity, or valid latency evidence. Details/raw route
percentiles,arrival samples,backlog,PG locks/connections,CPU/RSS,Redis keys/leases
are in measurement.json and summarized summary.json. Max sampled connections1,
lockwaiters0,ungranted0,RSS1070018560bytes,leases0; Redis keys empty. Scheduler
sampled backlog0 because attempts failed immediately. CPU cumulative process
microseconds user9436637/system350218; includes setup, not server-only utilization.

Cleanup artifact has empty cleanupErrors. Finally cancellation stock restoration
assertion executed without error (100available/0held/0sold); no orders were created,
so this is NOT a100-order cancellation proof. Zero leases observed/asserted. Initial
0/100/0 HELD state and100unique pending orders/tickets were NOT established.

## Bounded diagnosis / return to original backend

No rerun, instrumentation or source fix. Strong candidate: Jest creates a copied
process/env (`jest-util/build/index.js` createProcessObject/newProcess.env=createProcessEnv),
while NODE_OPTIONS preloaded guard closes over native process.env. Test appends its
HTTP port only to Jest process.env; guard may retain PG/Redis-only allowed ports.
This is an evidence-backed hypothesis, not an instrumented exact-options diagnosis.
Original backend must reproduce/repair dynamic owned HTTP port communication without
weakening target guard, preserve assertions, submit fresh exact lead+QA reviews, then
obtain new sole-owner runtime grant. Current source is not runtime-qualified.

## Dependencies / provenance

One local untracked symlink tixmoapi2/node_modules points to installed task354 deps;
no installs/downloads/generation or intentional shared-dependency writes. Prisma
bootstrap db-push uses --skip-generate. Jest cache and TMPDIR private owned runtime.
Packages:jest30.5.2,ts-jest29.4.11,prisma and @prisma/client5.22.0,redis4.7.1,
rate-limit-redis4.3.1,supertest6.3.4. Installed PG18.6 Ubuntu18.6-0ubuntu0.26.04.1,
Redis8.0.5 jemalloc5.3.0. **Nonparity only: NOT245 parity, NOT production capacity.**
Both task390/task354 package-lock SHA256:
`f530d7671524de570d43a6cf7e105cc8161f4c1be6b71a7ffc89025ee8a139da`.
Source schema SHA256 `03544f7a5fbe613b111fcf83b0249a38cc21d15ff8427b95ff340989871ec7bb`;
reused generated schema `a8601e89abd910f7464f9848ba061dc68fabf8ec6b4f014d4365004c95dc3b01`.
Whitespace-normalized schemas identical; formatting-only difference. No generated
client replaced. Runner/helper/test hashes in source-sha256.txt.

## Actual cleanup and evidence limitations

Owned PG PID3222581/port38212 and Redis PID3222594/port57257. Exact executable,
PGdata/Redis parent identity and sole loopback listener checks passed before connect.
Runner shut PG down and terminated Redis, verified no listeners, no postmaster.pid,
no owned PG socket, and no live service PIDs. Independent postcheck observed both
/proc/PIDs absent and `ss -H -ltnp 'sport = :38212 or sport = :57257'` empty, exit0.
Actual postcheck log retained. No cleanup failure. Database binary/data/log files
retained privately, not deleted. Node/Jest transient PID and HTTP ephemeral listener
port were not recorded by reviewed harness: evidence limitation, no invented values.
No task runtime process remained after completion; only external unrelated services.

Raw runner/acceptance/migrate/initdb/Postgres/Redis logs, measurement.json,
partial.json,cleanup.json retained. No fullAPI repeat/provider/external/cloud/spend,
config change,push,merge,deploy. Docs-only receipt to REVIEW, independent QA required.
Full246 ramp/soak/60sec/provider/fulfillment/recovery remains OPEN.
