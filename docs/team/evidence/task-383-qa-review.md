# Task383 independent QA HTTP100 source review

2026-10-21, tixmo-qa. **REQUEST CHANGES (source review)**.
Reviewed exact `929355653b2b37ae50633e704eb2a2628e5e4967` versus
`80c6710b89d147588e1514aa99a4e55c5630d38a` in isolated branch
`tixmo/task-383-independent-qa`, worktrees/task-383. No author code changed.
Read379/376/378 board contracts and task379 README; role/team instructions
already read this session. Runtime remains unauthorized and NOT RUN.

## Blocking findings

1. **Failure cleanup is not unconditional** (`orders-http-pressure.local.test.ts`
   lines27-41,110-127). Real Redis connection, app import and server listen occur
   before try/finally. App import failure leaves Redis connected; listen has no
   error rejection handler. Inside finally, partial.json serialization/write at115
   happens before the cleanup try at116; disk-full/write failure bypasses order
   cancellation, lease assertion, server close and disconnects. server.close
   rejection also skips Redis/Prisma disconnects. Move acquired resources under
   one outer cleanup boundary and independently attempt each cleanup even after
   setup/evidence/close failure. Preserve original and cleanup errors without
   allowing evidence write failures to prevent teardown. Runner process timeout
   is fallback containment, not the promised test failure-cleanup acceptance.
2. **Background monitor rejection is unattended** (lines71-90). Monitor starts
   an async Promise with PG and Redis awaits; no rejection handler is attached
   until scheduling/completion finishes (or finally). A query/Redis failure can
   become an unhandled rejection rather than a coordinated failed measurement
   with retained evidence and cleanup. Attach handling immediately, record the
   failure and stop/drain scheduling safely; monitoring failure must fail the test,
   not silently discard required metrics. Validate these paths in a separately
   authorized runtime slice after source repair.
3. **Restrictive disk-runtime boundary is assumed, not verified** (runtime.sh
   lines20-22; test lines23-25). mkdir -p -m700 does not correct/reject an existing
   unsafe or symlinked parent. The test checks a lexical prefix and group/other
   mode bits, not directory type, UID or realpath, and no runner disk-backing
   check exists. Source contract explicitly requires owned0700 disk runtime.
   Fail closed on unsafe existing parent/path traversal and establish disk backing
   via a reviewed operator preflight or explicit runner check before services.
   Document any checks intentionally delegated to the fresh runtime grant.

## Source acceptance inspected (not executed)

Real Redis/rate-limit-redis unmock declarations precede imports, with connectRedis
before dynamic app import; no index/bootstrap import. Current sessionVersion0
JWTs for100 enabled synthetic users; published event100GA/cap4. Scheduler uses
100 targets i*1000/30 and max30active pairs, sequential actual public-event GET
and orders POST on one forwarded loopback IP. Arrivals are scheduled pairs, not
200 requests/sec or100 concurrent sessions; last scheduled arrival3300ms.
Exact100GET200/100POST201 and200total exclude429/5xx/status0; pending unique
orders/users/orderNumbers and100HELD unique-barcode tickets, stock0/100/0 asserted.
Untimed service cancellation asserts100/0/0 and zero leases, subject to findings.
Metrics include route percentiles, target/actual invocation/completion timestamps,
backlog/queue age, PGconnections/lockwaiters/ungrantedlocks, process CPU/RSS,
Redis keys/leases. No realized arrival-rate threshold is asserted; timestamps
support later review. Local500ms/2s p95 is not production SLA.

Runner env-i scrubs inherited settings, rejects two ambient dotenv paths, uses
synthetic JWT/provider placeholders and actual verification-safety disposable DB
plus Redis/1 (REDIS_DB1), offline local prerequisites, bounded timeouts and
ownedPID/executable/datadir/listener checks. TERM/KILL cleanup attempts both
services and checks final PID/listeners/socket absence. CachedPG18 is not parity.
Node guard normalizes net connect arguments and permits explicit IPv4loopback
owned ports, denies path sockets/UDP; subprocess native Prisma traffic is NOT
sandboxed. Bootstrap npx is constrained by local executable preflight/offline
flags, not permission to install. No general OS network isolation claimed.
Imports/schema/JWT/service signatures inspected; compiler compatibility remains
unverified because no compiler/dependency execution was authorized.

## Actual checks and limitations

- `git rev-parse HEAD HEAD^`: exit0, exact reviewed/base above.
- `bash -n docs/team/evidence/task-379/runtime.sh`: exit0.
- `node --check docs/team/evidence/task-379/network-guard.cjs`: exit0.
- `git diff --check 80c6710b89d147588e1514aa99a4e55c5630d38a 929355653b2b37ae50633e704eb2a2628e5e4967`: exit0.
- Full four-file source reads plus setup/Jest config, schema, JWT, Redis,
  verification-safety, app/limiter/waitingRoom and order creation/cancellation
  source inspection: exit0. Line references captured with nl/sed.

No TypeScript compile/Jest/harness/helper execution, services/DB/load/network,
install/download/envsecret/config/provider/spend/push/merge/deploy. No runtime
status, metrics, cleanup or guard normalization behavior certified. Hook checks
NOT RUN; report commit command-scoped identity/hooksPath only, no config edits.

Task383 completes this independent review; return findings to379 author, do not
close379. Exact repaired SHA requires fresh independent review. Full246 remains
OPEN: session ramp/soak/60secHTTP/provider/fulfillment/recovery unproved. A fresh
PM sole-owner runtime grant and reviewed safety plan remain mandatory.
