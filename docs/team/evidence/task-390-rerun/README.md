# Task390 NEW HTTP100 rerun: FAILED

Exact executed source `5a64d9739f148d966534ba802ddd162fc17e053d`, independently source/stub reviewed by lead398 `7df5bced` and QA399 `a3fca22`. NEW isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-390-rerun`, branch `tixmo/task-390-rerun`. Only evidence files authored; previous task390 failure worktree/evidence preserved. Fresh PM sole NEW disposable-DB grant recorded on390; exact task claimed. Required role/team instructions, recent390/393/397/398/399 history, runtime/guard/path/cleanup/test/setup/safety read before execution. Existing installed Jest/Supertest/Prisma stack reused, not custom rebuilt.

## Command and actual result

```bash
TASK379_PM_RUNTIME_GRANT=source-reviewed-sole-owner timeout --signal=TERM --kill-after=12s 170s bash docs/team/evidence/task-379/runtime.sh > docs/team/evidence/task-390-rerun/runner.log 2>&1
```

2026-10-21T13:24:57Z–13:25:17Z, **exit1**. Migration successful; Jest compiled and ran one test, failed at line121 expected100 GET200, received0. Jest16.084s. No full API repeat. Reviewed inner commands are `timeout --signal=TERM --kill-after=5s 35s tixmoapi2/node_modules/.bin/prisma migrate deploy --schema tixmoapi2/prisma/schema.prisma` and `timeout --signal=TERM --kill-after=5s 110s npm --prefix tixmoapi2 test -- --cacheDirectory <owned-run>/jest-cache --runInBand --runTestsByPath tests/integration/orders-http-pressure.local.test.ts`; setup schema bootstrap uses `npx prisma db push --accept-data-loss --skip-generate` offline.

**0/100 GET200, 0/100 POST201; all200 status0**, exact error `Task379 network guard rejected non-owned TCP target`. 100arrived/100completed, maxActive1/maxQueue1, measured3313.152ms. Rejected attempts are NOT HTTP latency or capacity evidence. No successful orders, uniqueness/PENDING/HELD/0available100held0sold state proven. Cancellation finally restoration100available0held0sold assertion and zero-lease assertion completed, cleanupErrors empty; NOT proof of100-order cancellation because no HTTP orders created. All assertions preserved.

Raw route timing percentiles, arrival schedules/observations, backlog/queue and PG locks/connections/CPU/RSS/Redis key/lease samples retained in measurement.json and partial.json. Summary.json is derived only: maxPGconnections1, lockwaiters0, ungranted0, RSS1070358528bytes, leases0, sampledbacklog0; last cumulative CPU user9351392/system306842 microseconds includes setup, not isolated server CPU. No production SLA/capacity inference.

## Provenance and preflight

Preflight.log records exact lock/schema/helper/test SHA256 and installed package versions: Node24.21.0, Jest30.5.2, ts-jest29.4.11, Prisma/client5.22.0, Redisclient4.7.1, rate-limit-redis4.3.1, Supertest6.3.4. New untracked local node_modules symlink points to installed task354 deps. Lockfiles byte-identical, SHA256 f530d7671524de570d43a6cf7e105cc8161f4c1be6b71a7ffc89025ee8a139da; generated client schema whitespace-normalized identical to source, raw hashes retained. No installs/downloads/generation/shared-dependency writes. bash -n runner and node --check path/guard/cleanup helpers exit0.

Installed task57 binaries: PostgreSQL18.6 (Ubuntu18.6-0ubuntu0.26.04.1), Redis8.0.5 jemalloc5.3.0. **NONPARITY, not245 parity, not production capacity.** Private owned0700 unique disk runtime `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.38xCjd`; reviewed ancestor/symlink/realpath/mode/filesystem guard passed; /dev/nvme0n1p2 with165G available. Runner env-i scrubbed inherited environment and rejected ambient dotenv, synthetic fixtures only. No secrets/target/provider/mail/thirdparty/config/spend/push/merge/deploy. Exact loopback PID/listener verified before connect; unrelated postgres7071/7502 redis7194/7620 inspected metadata only, never connected/signaled.

## Current invocation and verified cleanup

Current fresh run ID `4c496ed05b5124f990ef6550542833198f7339971fa82f0940f42c6af3d6b2d4`, exact runtime root above, retained in both producer receipts; cleanup consumer executed in current parent invocation using shell-held challenge, no manual substitution. JestPID3269192/PPID3269191, Node executable and complete startstat retained; actual HTTP IPv4 listener127.0.0.1:43015. PG3269074:22273 and Redis3269088:48850. Runner stopped exact verified services, process-cleanup.json errors[], JestPID absent and HTTPss empty. Independent immediate postcheck.log confirms all3 /proc PIDs absent, all3 exact ports ss empty exit0, postmaster.pid absent. No unverified signals or invented cleanup identity. Private runtime/data retained, raw logs copied here.

## Bounded diagnosis and handoff

Failure persists despite successful native listener registration (execution reached measurement after registration, no registration error). Exact rejected connector options were not instrumented; root cause NOT established. The new receipt/cleanup qualification succeeds for this failed run, but source/stub guard tests do not establish real HTTP transport compatibility. Return original backend for narrow actual transport-boundary diagnosis, preserving failclosed target guard/all assertions. No source edits, no second rerun, no guard bypass. Any repair needs fresh exact lead AND QA and separate new sole-owner runtime grant.

Evidence-only commit to REVIEW, independent QA of actual artifacts and cleanup required next cycle. Task390 qualification and full246 ramp/soak/60sec/provider/fulfillment/recovery remain OPEN. No acceptance or deployment claimed.
