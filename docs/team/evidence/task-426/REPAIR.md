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

## Two-minute QA442 recursion repair

Exact parent 701ad1040caad539ff0afb625d6aa6256c026473; NEW isolated worktree
`task-426-layering`, branch `tixmo/task-426-spy-layering`. QA identified actual
jest-mock duplicate spy identity causing eval self-recursion and phase restore
removing tracking. Replaced with one permanent trackedSpy per eval/zRem method:
native bound BEFORE spy installation, phase delegate receives that native,
reset clears delegate only, final joined cleanup restores original once. zRem
assertions reference the same permanent tracking spy, with no second spyOn.
Controller service phase spy remains independent from catchAsync body tracking:
restored only after phase work.join; failure cleanup joins before restoration.

Actual installed task434 jest-mock regression PASS: three phase delegates, each
native called exactly once/no recursion, blocked phase join deadline then joined
release, phase failure joined/reset, healthy native fallback, zRem call tracking
retained all phases, exact original method identity restored. lifecycle-probes,
offline-check syntax/dependency/schema/path and diffcheck PASS. No runtime or
HTTP qualification; all preceding runner/whole-app tracking limitations remain.
Fresh independent QA + lead exact successor required. No product change, service,
network, install, runtime, dependency link, configuration, push/merge/deploy.

## Lead443 continuation/provenance successor (source-only)

Base98adaa1b057f5feddd221d4ac8a39673e494df26; immutable lead evidence70f56805520fb0029d4dedba4f52141fc6e1f9eb read before edits. Isolated worktree task-426-continuations, branch tixmo/task-426-continuations; shared main/old worktrees preserved.

The installed express-rate-limit returns an async promise encompassing deferred store increment AND downstream next(). All three exported limiters are now wrapped before app/routes capture them, joining that returned promise, rather than treating sendCommand settlement/socket terminal as middleware completion. Store sendCommand also retains lifetime tracking (including initialization/detached store commands). Existing tracker continues joining synchronously admitted child handlers. Offline regression uses installed matching express-rate-limit with deferred stores, success AND rejection, fails join before controlled store release (before checkout gate), then observes downstream and nested child before synthetic disconnect. No socket or application import is used.

`provenance.cjs.verify` derives real Git root from executed qualification filename, anchors every Git command there, requires explicit exact TASK426_EXPECTED_SHA, clean tracked tree, executed source bytes equal HEAD blob, and no untracked executable source in relevant directories. Before first product OR supertest import it requires TASK426_DEPENDENCY_ROOT, byte-identical package/lock/schema, same real installed node_modules as executed source, confined package paths and runtime entries; receipt includes manifest hashes, installed lock digest and package/entry hashes. This is identity binding and failclosed resolution, NOT exhaustive verification of every installed dependency byte, native binary or generated Prisma client. The future runner still must establish safe scrubbed environment/native preload and verify these identities before spawning Jest/setup imports; this in-module check cannot protect earlier Jest setup. No new runner supplied, no runtime grant assumed.

Actual checks/exit0 in continuation-results.txt: new installed-limiter/provenance/emitted-import-order regressions; existing lifecycle/spy/cleanup/offline TS syntax+parse/package-lock-schema matching/path checks;427 no-connect transportstub; helper nodechecks; diffcheck. Initial existing lifecycle static assertion failed because Git diff moved into provenance helper; updated assertion to check actual helper with --no-ext-diff and reran successfully. This is not weakening a behavioral regression.

Remaining: no claim of arbitrary background-work quiescence or complete middleware-library coverage. Timeout still retains instrumentation/skips disconnect, requiring reviewed owned process termination and reaping BEFORE service teardown. Existing427 runner remains unsuitable unchanged. Top-level provenance rejection has no in-test cleanup receipt (no product initialization has occurred); runner must capture stderr/exit even on disk failure. Future source/dependency changes between guard and use are not prevented by a filesystem snapshot; runner must own immutable source/deps. Actual HTTP/Lua/DB/Redis/inventory/foreign-buyer/server-ACK qualification, Jest/typecheck/build NOTRUN. Fresh independent QA AND lead exact successor review required; task426 remains OPEN/REVIEW, not acceptance or selfapproval. No services/network/install/generation/config/scheduler/provider/cloud/spend/push/merge/deploy, no runtime directories/ports/PIDs/dependency links created.
