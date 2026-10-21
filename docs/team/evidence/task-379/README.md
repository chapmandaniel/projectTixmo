# Task379 source-only HTTP100 preparation

Base `80c6710b89d147588e1514aa99a4e55c5630d38a`; branch
`tixmo/task-379-http-pressure`, isolated `worktrees/task-379`.

Prepared one existing-stack Jest/Supertest test, adapted task287's c0c41a07
bounded scheduler and owned runner, and reused task284 stock/uniqueness
invariants. No new dependencies/framework. The test un-mocks real Redis and
rate-limit-redis before dynamically importing app, pre-seeds 100 enabled users
and current-version JWTs, sends 100 same-forwarded-IP read/order pairs at
30 scheduled arrivals/sec, caps 30 active pairs, and records status/error,
route latency, arrival/queue/backlog, PG locks/connections, CPU/RSS and Redis
keys/lease counts. Exact HTTP/status and stock/ticket/order assertions plus
post-measurement cancellation/lease assertions are source assertions, NOT passes.
Partial results are written before cleanup even when assertions fail.

Runner is SOURCE ONLY and refuses absent a fresh explicit PM sole-owner grant.
It adapts historical disk-backed 0700 runtime, env-i, owned PID/listener checks,
bounded service/test timeouts and TERM/KILL cleanup. It uses the actual Jest
`tixmo_disposable_*` and Redis /1 guard, explicitly REDIS_DB=1, installed-local
Prisma/Jest checks and npm offline/no-download flags. Node socket guard allows
only owned PG/Redis and the test's own IPv4 loopback HTTP listener; UDP denied.
No app bootstrap/job entrypoint or payment/mail route is used. Notification
service is replaced with an empty object, so accidental notification calls fail.
No secrets, .env, configuration or installed packages were read/changed here.

## Static checks actually performed

- `bash -n docs/team/evidence/task-379/runtime.sh`: exit 0.
- `node --check docs/team/evidence/task-379/network-guard.cjs`: exit 0.
- `git diff --check`: exit 0.
- Required board packet376 and QA378 correction inspected: paid-sales-query
  is an existing modified helper, not a newly introduced helper.

## Explicit gaps / independent review handoff

No TypeScript compiler or installed API dependencies were available in this
worktree; no typecheck, Jest, schema bootstrap, DB, Redis, services, load,
provider, network or runtime execution was performed. Neither HTTP acceptance
nor owned cleanup has been demonstrated. This is a bounded source checkpoint,
not a runtime-ready certification. Independent lead + QA must review exact SHA
before PM schedules runtime; check dynamic import/mock order, ts-jest typing,
Supertest/Node socket normalization, cancellation and failure cleanup paths,
local prerequisite binary/dependency paths, and refusal of ambient dotenv files (environment.ts already skips dotenv in test).
The Node guard does not sandbox subprocesses; runner invokes only inspected
local tools. Monitor/setup failures and timeout cleanup still require review.

Full #246 remains OPEN: 100/250/500 browser sessions, 200-session 30min soak,
60sec authenticated HTTP burst, production rate-limit budgets, 5000-lease
ceiling, provider delivery/fulfillment and recovery are not covered/proved.
500ms read/2s reservation thresholds are local observations, not production SLA.
No push/merge/deploy/spend or full API rerun.
