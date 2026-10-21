# Two-minute source-only continuation after lead440 REQUEST_CHANGES

Parent e03a454fcb55c2e8a16f64bee82f912e800fecc3; reviewed independent report
5c6bd79556255051793b89a57e09366deb64a750. Successor branch
`tixmo/task-426-abort-cleanup`, worktree task-426-cleanup. This document
supersedes earlier README's implementation description where changed.

Repairs attempted: artifact write now happens AFTER cleanup attempts, so ENOSPC
cannot bypass service cleanup; cleanup collector bounds each step and continues
after throw/timeout; server's req aborted/res close acknowledgement is observed
before controlled gate release; sockets tracked and destroyed during drain;
initialization connectRedis/app import/listener construction now owned by try;
healthy inventory excludes only volatile updatedAt, strict abort and foreign
snapshots unchanged. Receipt filenames random+exclusive wx, cleanup results
included. No product code changed.

Actual offline checks PASS: cleanup-probes.cjs injected ENOSPC and unresolved
cleanup promise, verified later drain/disconnect actions both execute, results
false/false/true/true; static server ACK-before-release, I/O-after-cleanup and
initialization-inside-try checks. Existing offline-check.cjs PASS exact matched
package/lock/schema, TS5.9.3 syntax transpile/emitted parse, unsafe paths and
static invariant checks. First static-check run failed solely because new
TypeScript nonnull removal! changed the regex; optional ! accepted, same exact
per-token assertion retained. node --check cleanup helper/probe and diffcheck.

## Explicit remaining gaps - NOT runtime-ready

Full finding3 is NOT resolved: socket close does not prove admitted async
controller/Lua handlers joined; cleanup Promise.race bounds observation but
cannot cancel underlying work. Handler joining must precede disconnect and
instrumentation restoration. Full finding5 is NOT resolved: no invocation/source
binding or explicit original failure status/partial phase receipts; artifact I/O
failure can mask original failure though cleanup now precedes it. Need preserve
original failure while reporting cleanup failures. No current sourceSHA/run
identity claimed. Socket/server ACK semantics not runtime-proven. Further exact
independent review required for all changes, not author approval.

NO actualHTTP/Jest/typecheck/build/DB/Redis/service/network/runtime/install/config/
spend/push/merge/deploy. No owned services/PIDs/ports/runtime/link were created;
no cleanup action against unrelated host services. Safe runner adaptation remains
outstanding, no runtime379 guard bypass. Task426 acceptance remains OPEN.

## Six-minute source/offline successor from c8672a17

Branch `tixmo/task-426-joined-cleanup`, new worktree `task-426-joined`, exact base
c8672a17ea9be27014cbdcf14e6e472fb2d8b70f. Original immutable lead440 report read.
This section supersedes the two remaining-gap descriptions only where specified.

Test-only pre-app instrumentation tracks catchAsync bodies (whose production
wrapper discards the promise), required/optional auth, validation, waitingRoom,
and actual Redis eval/zRem promises including detached terminal removal. Each
phase joins before restoring instrumentation. Failure cleanup first unblocks and
drains owned sockets, then joins admitted tracked work before restoration and
Redis/Prisma disconnect. Join deadline is NOT cancellation: if it fails, restore
and disconnect explicitly fail SKIPPED, preserving instruments and reporting
pending work. Runner must terminate its owned process before tearing down owned
services in that case. No assertion that arbitrary middleware/library background
work is cancellable or exhaustively joined; exact runner/whole-app async review
and runtime qualification remain necessary. No silent successful cleanup claim.

Receipts use random invocation ID + exclusive wx, git HEAD source SHA + SHA256
of executed source path, and require clean tracked source before connection.
Partial phase STARTED/inflight observations survive failure. Lifecycle collector
records original stack and cleanup outcomes; artifact ENOSPC reports diagnostics
to stderr and rethrows the original error object instead of replacing it. If no
primary exists, cleanup failure takes precedence over artifact failure. A failed
artifact cannot promise a durable disk receipt; stderr is the fallback, requiring
runner retention. Initialization exceptions inside the owned try receive the
same cleanup and failure receipt. Preflight guard failures intentionally connect
nothing and are not represented as a qualification invocation.

Actual offline checks PASS: lifecycle-probes.cjs pending-handler settlement before
disconnect, pending timeout retains work, never-settling handler skips disconnect,
original error identity survives ENOSPC plus diagnostic cleanup, initialization
failure empty partial receipt, invocation/source fields, source ACK ordering and
exclusive write checks. cleanup-probes.cjs ENOSPC/hang continuation PASS;
offline-check.cjs exact package/lock/schema, TS5.9.3 syntax transpile and emitted
parse, unsafe paths/static invariant checks PASS; task427 transport-stub PASS;
node --check lifecycle helper and git diff --check PASS. No typecheck claim.

Safe379 runner adaptation NOT attempted. ActualHTTP/Jest/build/typecheck/database/
Redis/runtime/service/network/install/generation/config/spend/push/merge/deploy
NOTRUN. No services, sockets, PIDs, ports, runtime directories or dependency links
created; unrelated services untouched. No product defect reproduced or product
code changed. Still a reviewable SOURCE checkpoint, NOT qualification acceptance.
Independent QA and fresh lead review of exact successor required before closure.
