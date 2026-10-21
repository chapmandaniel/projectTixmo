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
Partial results and cleanup diagnostics are attempted independently of resource cleanup, including when assertions or artifact writes fail.

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

## Task385 repair checkpoint (source only)

Base929355653b2b37ae50633e704eb2a2628e5e4967; isolated branch
`tixmo/task-385-http-cleanup`, worktrees/task-385. Addresses lead382 and
QA383 findings: Node normalized connect vectors preserved and actual options
validated; Redis/app/listen acquisition under cleanup coverage with listen error
rejection; immediately handled monitor failure stops new arrivals/queued work,
drains active requests, then fails; each artifact/cancellation/lease/server/Redis/
Prisma cleanup attempted independently, original failure rethrown unchanged.

Shared synchronous runtime-path.cjs preflight checks directory type, UID, modes,
all ancestors for symlink/write exposure, realpath, unique run child name and
explicit disk filesystem allowlist (ext/XFS/Btrfs/ZFS, fail closed for unknown).
Runner validates before starting services; test validates before Redis. Existing
runtime/task parents must be owned0700; no chmod of existing state. Logs now
live in each unique private run, not reused source-directory files. This is a
preflight contract, not protection from concurrent same-UID path replacement.

Actual task385 checks: bash -n runtime.sh, node --check network-guard.cjs,
node --check runtime-path.cjs, git diff --check, all exit0. Source inspection
preserves exact100GET200/100POST201, inventory/uniqueness, cancellation and
metrics assertions. No helper/guard behavior execution, compiler, Jest, DB,
services, runtime, install/download, network, envsecret/config, providers, spend,
push, merge or deployment. Hooks not run (command-local hooksPath only).

Independent fresh lead+QA review of exact repaired SHA required before closure
or a separately granted sole-owner runtime slice. Parent379 remains REVIEW;
full246 remains OPEN. Node guard is not a subprocess sandbox.
