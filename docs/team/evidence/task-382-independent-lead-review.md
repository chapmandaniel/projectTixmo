# Task382 independent lead source review

2026-10-21, tixmo-lead. Reviewed exact implementation
`929355653b2b37ae50633e704eb2a2628e5e4967` against
`80c6710b89d147588e1514aa99a4e55c5630d38a` for task379.
Branch `tixmo/task-382-independent-review`; isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-382`.
Only this report is reviewer-owned. Author code is unchanged.

## Verdict: REQUEST CHANGES

### High: guard mishandles Node's already-normalized connect argument vector

`docs/team/evidence/task-379/network-guard.cjs:6` always runs
`net._normalizeArgs(args)`. Node's `net.connect/createConnection` can call
`Socket.connect` with its already-normalized `[options, callback]` vector as
one argument. The wrapper then normalizes the outer array again, treating the
inner array as the options object; `options.host` is undefined and the guard
rejects a legitimate owned connection. This affects common client socket paths,
not just an exotic external target. Preserve Node's already-normalized form
and validate its actual options without bypassing the host/port/path checks.
This is an API/control-flow source finding, not an executed socket probe;
future authorized validation must cover direct object/port overloads and the
net.createConnection path, plus forbidden targets. Node-only interception is
not a subprocess sandbox, as README correctly states.

### High: failure paths can skip cleanup or produce unhandled rejection

In `orders-http-pressure.local.test.ts`, Redis connection, app import and HTTP
listen happen at lines27-33 before the cleanup try at41. Import/listen failures
therefore leave acquired resources without test cleanup. Monitoring starts at71
but its promise has no rejection handler until90/112: a sample-query failure
can become an unhandled rejection while arrivals continue. In finally, the
partial artifact write at115 precedes the nested resource-cleanup try; a disk
write exception bypasses server/Redis/Prisma cleanup. Finally127 also performs
Redis and Prisma disconnect sequentially, so Redis failure skips Prisma.
Contain monitor failure immediately, stop scheduling/retain the original
failure, and ensure each acquired resource is independently cleaned even when
setup, evidence writes, cancellation or another cleanup step fails. The outer
shell deadline is a fallback, not successful test cleanup or preserved evidence.

### Medium: private disk/runtime assumptions are not established

`runtime.sh:20-22` uses `mkdir -p -m700` then mktemp, but an existing task root
is not checked for owner/mode/symlink traversal; mkdir's mode does not repair or
reject an existing insecure parent. There is no disk-backing check. The test's
artifact check at24 tests only a lexical prefix and group/other bits; it follows
symlinks and does not verify owner/directory identity. Migration and acceptance
logs at154-155 are redirected to the source evidence directory instead of the
unique private run, reusing/truncating names on subsequent attempts. Verify the
reviewed disk/private parent contract before services, place each run's logs
under its unique private directory, and fail closed on invalid parents. Do not
infer runtime safety from mktemp or a lexical path prefix.

## Source observations accepted within limits

- Existing Jest/Supertest stack reused, no framework/dependency change.
  Redis and rate-limit-redis are unmocked before dynamic app import;
  connectRedis precedes import. Notification service is stubbed and bootstrap
  entrypoint is not imported. Current JWT sessionVersion0 matches enabled
  synthetic users and the existing token API.
- Actual public slug GET and orders POST routes exist. Scheduler has100
  arrivals with i*1000/30 targets, maximum30 active sequential read/order pairs.
  Results capture actual HTTP durations/statuses; exact100 GET200 and100
  POST201 plus total200 rejects429/auth/5xx. This is not60sec load or sessions.
- Source asserts100 unique pending orders/users/orderNumbers,100 distinct
  barcodes and ticket-order mapping, HELD tickets, stock0/100/0. Untimed
  cancellation checks stock100/0/0 and zero active leases.
- Route percentiles, arrival/completion/backlog/queue samples, PG connections/
  lock waits/ungranted locks, process CPU/RSS and Redis keys/lease counts are
  present. Test-environment limiter budgets are1000, not production budgets.
- Runner selects actual tixmo_disposable guard and Redis DB1, scrubs env via
  env-i on normal entry, rejects ambient dotenv paths, checks local tools,
  sets npm offline, uses bounded migrate/Jest timeouts, records owned PID and
  loopback listener identity, and has bounded service TERM/KILL cleanup.
  These are source mechanisms, not an observed clean service lifecycle.

## Actual checks and limitations

Exit0: `bash -n docs/team/evidence/task-379/runtime.sh`;
`node --check docs/team/evidence/task-379/network-guard.cjs`;
`git diff --check 80c6710b89d147588e1514aa99a4e55c5630d38a HEAD`.
Manual source inspection included all four changed files, Jest setup/config,
verification-safety, current Redis/JWT/app/limiter/waiting-room and order seams.
Task379/376/378 board packets and README were read. No compiler/typecheck,
Jest/harness/helper execution, services, DB/SQL, network, install/download,
envsecret/config/spend/push/merge/deploy. No runtime pass or cleanup pass.
No default-branch changes; report commit uses command-scoped synthetic identity
and disabled hooks only (hooks NOTRUN). Full246 stays OPEN;379 not closed.
Repair exactSHA needs independent lead+QA review before any fresh explicit PM
sole-DB runtime grant, not automatic runtime authorization from this report.
