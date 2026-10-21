# Task429 independent lead review of task427

Reviewer: tixmo-lead, 2026-10-21. Decision: **APPROVE source contract only**
for exact `fcab880ea7caf50493439a21032b7a93effc438f`, compared with
`8aae387bcd4290edd259fd75aa11baaa1f62ca63`.
New isolated branch `tixmo/task-429-review-427`, worktree `worktrees/task-429`.
This report does not approve task428 (same author), close427, authorize runtime,
or claim API/market/HTTP100 PASS. Independent QA430 and later owned-runtime
evidence remain required. No blocking source finding within reviewed scope.

## Inspected scope and reasoning

All seven427 changed files, root verifyApi DI, original379 strict guard/runtime
path/runner,393 current-challenge process-cleanup observer, Redis connection
module, Jest config/setup, and unchanged pressure test body were inspected.

The composed preload installs the outer362/424-style guard before capturing
strict379. Its final dispatcher selects strict only for native AsyncLocalStorage
ownedScope; strict delegates outer then the bottom transport. Scope storage is
private, and run restores the calling context on return/throw while descendant
async resources retain strict scope. Unlike temporarily swapping one global
connect function around a test promise, unrelated concurrent async contexts
continue to use outer protection. Registering the scope function on native net
preserves the existing379 native-module bridge rather than copied Jest globals.
The owned test wraps its whole async setup, workload and finally, including
Redis connect, HTTP server construction/listen and listener revocation. Redis
module import itself does not initiate a connection. Runtime-only native/Jest
bridging and actual server/request async propagation still need qualification.

Native379 listener registration/IPv4 ownership checks, close revocation, owned
DB/Redis allowed ports, Unix/IPv6/non-owned rejection are unchanged. The scope
cannot bypass outer nonloopback checks. Strict379's global UDP prohibition is
also retained outside scope; this is stronger than the old outer-only guard,
not a new egress allowance. Neither guard is an OS/native subprocess sandbox.

Runtime differs from379 principally by grant/scrub marker, composed preload,
block-log path, full unfiltered verifyApi invocation and360s timeout. Fresh
0700 disk path validation, challenge, exact PID/executable/listener ownership
before DB access, synthetic env-i fixtures, and cleanup are retained. Full API
commands remain build/migrate/destructive schema bootstrap/unfiltered Jest;
only JSON receipt options are appended. No test filters/assertion removal.
The pressure test was independently normalized back to the old wrapper and
byte-compared: all100buyer,200request,30concurrency/rate,inventory,latency,
lease and finally/error-preservation assertions are unchanged.

Cleanup preserves the original error and stops only identity-checked owned
services, then observes current-challenge Jest identity and HTTP absence.
It fails closed if pressure receipts do not exist (even e.g. a build failure),
so missing cleanup evidence is not a pass. Timeout/remainder processes must
still be independently checked; do not infer cleanup from shell exit alone.
Runtime remains PG18/Redis8.0.5 NONPARITY; no245 parity inference.

## Actual independent checks

All exit0, no dependency links/writes, native connections or listeners:

- `bash -n docs/team/evidence/task-427/runtime.sh`.
- `node --check` for task427 network-guard.cjs, outer-guard.cjs, run-gate.mjs.
- `node docs/team/evidence/task-427/transport-stub.cjs`: author stub reproduced,
  5 bottom transport calls, normalized/null paths and fake listener allowed;
  nonowned/Unix/external rejection and await restoration passed.
- Additional reviewer `node` stdin stub replaced native Socket.connect BEFORE
  preload, block log `/dev/null`, synthetic ports31001/51001. In parallel with
  an awaiting strict scope, outside unowned-loopback calls succeeded; strict
  calls remained rejected across Promise, setImmediate, nested scope and after
  nested return. Sync throw and async rejection restored the outside context.
  Fake native-class listener rejected invalid/not-listening/duplicate register;
  allowed registered60003 and rejected it after close event. IPv6, Unix path,
  nonowned/external and UDP rejected. Exactly6 bottom stub calls asserted.
  No real listen/connect; fake _handle cleared. This tests actual guard code
  with native ALS, not Jest or real HTTP listener behavior.
- Python read-only comparison removed exactly the new comment/scope declaration
  and opening/closing wrapper changes from pressure test; bytes matched base.
- `git diff --check 8aae387b fcab880e`.

The additional stub was executed via stdin, not a retained runtime or product
artifact. Results above are observed checks, not inferred compilation/test passes.
No compiler/Jest/API/migration/schema/DB/Redis/service/runtime/network execution,
install/generation/dependency writes, config/scheduler/provider/spend/push/merge/
deploy. Main's pre-existing untracked AGENTS/team files were left untouched.

## Acceptance boundary

Approve exact source for QA430 and preparation of a separately granted runtime
slice, not for immediate acceptance. PM must still assign one sole disposable
DB owner, independently establish matching dependencies/generated-client and
version provenance, inspect all ports/services, budget startup/cleanup beyond
360s, capture actual full Jest counts/skips/errors/receipts and live cleanup.
Audit registry authority remains separate and ungranted; no market retry or
network scope follows from this review. Original424 failures remain preserved.
