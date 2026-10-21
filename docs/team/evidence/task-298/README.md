# Task 298 — LOCAL mounted readiness fault/recovery

Product exact baseline `4ec8594850eb547dafc145a14bb1b85cdeaa235c`, unchanged.
Branch `tixmo/task-298-readiness`; isolated worktree `task-298`.
Harness/runtime adapted from task294R4 `9f2c6f0121968adc75607982e4f96ddbd2a1e853`, not historical PASS reuse.

## Reproduce

Link existing matching-lockfile task235 API dependency cache at
`tixmoapi2/node_modules`, then `bash docs/team/evidence/task-298/runtime.sh`.
Runtime execs env-i before tools/imports, synthetic test credentials only,
NODE_ENV=test skips dotenv. New mode0700 disk workspace/runtime/task298 run
(not /tmp), exact executable/PID/loopback listener guards, Postgres18 disposable
DB and real RedisDB1 validated before migrate/test. No remote targets.
No financial fixture, provider request, email or cloud access.

Read actual app/readiness/Redis/waitingRoom source before faulting. /ready and
/health bypass waitingRoom. checkReadiness caches completed results 1 second,
shares an active probe, races its completion against 2000ms, and reports null
for an unresolved dependency. Probe itself is not canceled by response timeout.

## Current acceptance

Final run exit0, Jest **1/1 PASS17.012s** (case10533ms). See acceptance.log for
full exact HTTP JSON and timing. Healthy actual app /ready200, two concurrent
/ready requests during exact owned Redis SIGSTOP return503 around2seconds with
`{database:true,redis:null}` and `not_ready`; /health200 during same stall.
SIGCONT resumes the same process, pending ping completes, then /ready200
`{database:true,redis:true}` after cache interval. No replacement/restart.
Exact public response keys/no-store and no stack/URL/password/secret/path text
asserted. Liveness is explicitly distinct from dependency readiness.

Only real dependency clients/readiness/app are used (Redis and rate-limit-redis
unmocked despite global setup). Inert external Stripe/notification and global
logger mocks prevent unrelated provider/log behavior; this is not provider or
real logger evidence. No readiness/dependency/HTTP response mocks.

First run passed1/1 in16.653s. Final runner-only improvement records API PID,
starttime/listener and adds fail-closed exact node-exe/cwd/starttime fallback
cleanup; final run reruns final harness. First artifacts retained unchanged.
No product behavior weakened or changed; no bug observed in this bounded slice.

## Ownership and cleanup

Trap resumes Redis before any shutdown and handles PG, Redis and API cleanup
independently. Redis remains unreaped direct child/exe verified, PG requires
owned postmaster PID/data-dir/exe. No restarted PIDs exist. API fallback matches
recorded PID/starttime/node executable and worktree cwd. Test closes mounted
HTTP listener and dependency clients. Trap verifies all owned ports absent,
postmaster/Redis socket gone. Current final PG2735714 Redis2735727 API2735814,
ports25819/57951/43509 all absent after run. First PG2734381 Redis2734394
API2734478 ports31758/40538/44475 also independently absent. See runtime logs
and cleanup-verification.txt. Dependency symlink removed after verification;
sole DB ownership released.

## Limits / review

Author evidence requires independent QA at exact committed harness SHA.
SIGSTOP tests stalled Redis/pending ping, not disconnected Redis, Postgres
failure, process replacement, deployment networking or prolonged outage.
PG remains healthy; response null means unresolved, not false. No accumulation
stress/load test, readiness alert delivery, target monitor/on-call ownership,
sales-pause qualification or staging evidence. Full W11 remains NO-GO.
No product edits, push, merge, deployment, spend, config or external actions.

Checks: `bash -n runtime.sh` PASS; source SHA256 manifest recorded. Staged
`git diff --check` exit2 only migration rawlog line103 whitespace in each
retained run; raw logs deliberately unedited, not a clean-diff claim.
