# Task448 bounded source-only checkpoint - NOT runtime ready

Base exact510824df9e9bb7f5e57984862728b52929f7f849; isolated task-448,
branch tixmo/task-448-safe-runner. Original qualification assertions and427
fullAPI runtime are unchanged. No service runner was executed or wired.

Added preflight.cjs reuses426 executed-root/source/dependency identity and
private disk-path checks, rejects preload variables and ambient dotenv,
checks two distinct port values and installs existing379 strict native
listener/connect guard (not427 outer unrestricted-loopback fallback).
Designed to run BEFORE loading Jest; currently **not integrated** into an
end-to-end runner. Guard rejection occurs before application imports.
An already executed malicious NODE_OPTIONS preload cannot be undone here:
future shell MUST re-exec env -i before starting this Node process.

Added process-cleanup.cjs adapts393 observation into a live-child-handle
capability, detached owned session, bounded TERM/KILL and process-group
absence gate. Node close/direct-child reaping and group disappearance are
required before optional service teardown. It refuses PID receipts as signal
authority. Original stdout/stderr are inherited, exit code/signal retained in
report, evidence-write errors retained separately and printed. Session
identity failures or unproven disappearance reject and skip service teardown.

## Actual commands/results

- node docs/team/evidence/task-426/runner-probes.cjs: exit0. Real owned Node
  parent+child timeout, graceful child termination, direct child reaping/group
  disappearance before synthetic teardown PASS. Unrelated live child supplied
  as fake authority rejected without signalling; probe explicitly reaped its
  own foreign child. Preload-variable/wrongSHA denial PASS. Original exit42
  and ORIGINAL_STDERR_SENTINEL preserved with injected ENOSPC evidence error
  separately printed and retained PASS. No sockets or services used.
- node docs/team/evidence/task-426/continuation-probes.cjs: exit0. Installed
  limiter success/error continuation join, temporary Git fixture wrongcaller
  cwd/wrongSHA/absentdeps/dirtysource denials, emitted import ordering PASS.
- node --check docs/team/evidence/task-426/process-cleanup.cjs: exit0.
- node --check docs/team/evidence/task-426/preflight.cjs: exit0.
- git diff --check: exit0.

## Exact remainder / blockers

This is reviewable bounded progress, NOT task448 acceptance or runtime grant.
The helper proves cooperative same-session subprocess cleanup only. A child
which calls setsid/setpgid can escape group enumeration; full owned tree
containment/adoption/reaping is NOT proven. Linux orphan zombies may cause a
failclosed cleanup error; no subreaper is installed. No full SIGKILL-stubborn
or evidence-write-plus-primary-exception integration assertion. Async teardown
callback itself is not bounded. The stored result is NOT yet propagated as a
shell exit status. Do not use this helper for services until those gaps are
resolved and independently reviewed.

Still needed: adapt427 shell to426 paths and identities while preserving427;
env-i bootstrap before any Node/tools; preJest invocation of preflight and
native guard; guard actual test selection/setup; exact immutable source/deps
through use (current identity is snapshot, TOCTOU remains); bounded full tree
containment/reaping and original-exit mapping BEFORE disposableDBRedis stop;
426 observer/receipts adaptation; full timeout/stubborn/foreign identity and
preflight successful-admission/mutation/denial offline integration probes.
No exhaustive transitive/generated-Prisma/native dependency attestation.

No app/Jest/HTTP/Lua/DB/Redis/runtime/typecheck/build/install/generation/network/
config/scheduler/cloud/provider/production/spend/push/merge/deploy executed.
Only owned offline Node/Git fixture processes; shared main unchanged.
Task448 and426 remain open; fresh independent exactSHA lead+QA required.

## QA451 original-author repair successor

New isolated task-448-prejest, branch tixmo/task-448-prejest from exact
f8f54a476ed171fdc8b9c307aa1316c8113cdc52. Despite branch name, no preJest
shell integration added: PM redirected this bounded continuation to actual
QA451 blockers before new scope.

Repaired original ENOENT spawn Error overwrite: close handler now merges
code/signal into existing result, retaining original Error object/diagnostic.
Port validation now compares numeric values and requires canonical decimal
representations, denying leading-zero aliases such as 02345,2345.

Actual node docs/team/evidence/task-426/runner-probes.cjs exit0: real missing
executable ENOENT followed by close retains Error.code/message and code -2 /
signal null; canonical pair accepted and six malformed/alias/range/equal
mutations denied. Existing owned cooperative two-process timeout, foreignPID
authority denial, preload/SHA rejection, exit42/stderr + evidenceENOSPC pass.
Both changed helper node --check commands and git diff --check exit0.

All prior remainder/limits above remain. No env-i shell or beforeJest full
integration, escaped-tree containment, bounded service teardown or immutable
transitive dependencies claim. No runtime/services/network. Fresh independent
exact successor QA+lead required. This only repairs the two reported blockers.

## QA452 serialization repair

New isolated task-448-error-receipt / branch tixmo/task-448-error-receipt,
base exactf28753c035489effa018b41abd346c0ce8a6f84d. Spawn errors now become
explicit plain records with name/message/stack/code/errno/syscall/path/
spawnargs (null for absent fields), retained when close adds code/signal.
Actual runner-probes exit0: real ENOENT with fixture argument, awaited close,
injected evidence ENOSPC and JSON stringify/parse roundtrip asserts all eight
fields, original -2/null close status, false timeout and separate evidence
error. Previous offline regressions also PASS; helper syntax/diff checks exit0.
No other integration attempted. All full-runner/containment/TOCTOU limitations
remain, no runtime or services executed. Independent exactSHA review required.

## Lead454 atomic one-shot authority repair

New isolated worktree task-448-atomic-finish / branch
`tixmo/task-448-atomic-finish`, exact base
`c21be3d31d7b491d691dc5e0c9f96ee39b55853d`. Read independent lead454
`a59d63803988c95e6b3250e5ac4d879c089df2b2` README and existing448 notes.
The original author consumes WeakSet authority synchronously immediately after
membership validation, before any await or callback. Concurrent, callback-
reentrant and sequential duplicate finish calls now reject without signalling,
teardown or evidence callbacks. There is one completion owner, not a shared
completion promise. A failed cleanup also consumes its capability; it is not
permission to retry teardown against uncertain process identity.

Actual `node docs/team/evidence/task-426/runner-probes.cjs`: exit0. New
regressions use two real owned Node children, each awaited through close.
First case holds the original teardown with an explicit gate while a second
finish is rejected; original teardown/evidence counts are each1 and duplicate
callback counts both0. Second case awaits rejected reentrant calls from BOTH
teardown and evidence callbacks, counts original callbacks once and nested
callbacks0. Both additionally verify subsequent sequential reuse denial.
Owned child exit31/32 is retained. Existing cooperative two-process timeout,
process-first teardown, foreign-child authority denial, real ENOENT+close and
all8 diagnostic fields through JSON+evidence ENOSPC, canonical ports/preload/
wrongSHA and exit42/stderr+ENOSPC assertions also PASS. Expected injected
ENOSPC stacks remain visible; they are fixture outcomes, not hidden failures.
`node --check` for process-cleanup.cjs and runner-probes.cjs: exit0;
`git diff --check`: exit0. No original426 qualification assertions modified.

Only this concrete lead454 defect is repaired. Full escaped-tree containment,
immutable dependencies/source TOCTOU, env-i shell/preJest integration, observer
and service identities, bounded teardown and shell exit mapping remain OPEN.
No app/Jest/DB/Redis/HTTP/services/network/install/config/scheduler/spend/push/
merge/deploy or runtime grant. Fresh exactSHA independent QA and lead required;
448 and426 remain OPEN. Commit uses invocation-local identity/hooks override
so inherited API Husky cannot launch app tooling; no persistent config changed.

## Bounded shell/pre-Jest checkpoint (source/offline, NOT a runner)

New isolated `task-448-shell-checkpoint`, branch
`tixmo/task-448-shell-checkpoint`, exact base
`59d3cd722ea14af778feb8048839ab81b8a95aad`. Read actual QA458 `4c671a65`
and lead459 `acd3fc08` scoped reports. Existing426/427/379 helpers were the
existing-solution preflight; reused existing426 identity/path/nativeguard and
cleanup capabilities, bash/env and Node builtins. No custom orchestrator.

`/bin/bash docs/team/evidence/task-426/prejest.sh` always invokes env-i before
Node, allows only explicit inputs, rejects inherited preload attempts, and
runs426 preflight before any possible Jest/app/provisioning. No caller marker
can bypass scrubbing. Guard bytes are compared with tracked HEAD before guard
execution; source/dependency/guard attestation remains snapshot-only. After
preflight it unconditionally refuses runtime admission: no service/Jest launch
code exists here. The grant-shaped string is a denial gate, NOT authorization.
This is a usable preflight checkpoint, deliberately NOT a complete runtime
runner. A shell invoked with hostile loader environment may already have
executed preload at OS startup; this cannot undo prior execution.

Added exit-status.cjs maps actual primary nonzero code, signal (128+signal),
ENOENT127/other spawnerror126, then timeout124 or secondary failure1. Original
structured result/diagnostics stay untouched. It is not wired to a production
runner because there is no admitted runtime path yet.

Actual commands exit0:
- `node docs/team/evidence/task-426/shell-probes.cjs`: actual scrubbed shell
  missing-grant, malicious NODE_OPTIONS missing preload and wrongSHA denials;
  actual private0700 disk Git fixture successful identity (NOT admission),
  dirty source, absent/mismatched dependency, invalid path denials; real owned
  direct-child exit37/SIGTERM143/ENOENT127 mapping, primary status unchanged
  with secondary receipt failure. All real fixture children closed/reaped.
- `node docs/team/evidence/task-426/runner-probes.cjs`: unchanged atomic cleanup,
  reentrant/concurrent/sequential authority, process-first timeout/two-process
  cooperative reaping, foreignPID no-signal, eight-field ENOENT JSON+ENOSPC,
  ports/preload/SHA and exit42/stderr+ENOSPC regressions PASS.
- bash syntax, changed/new Node syntax and `git diff --check` PASS.

Zero qualification/provisioning child ordering is structural plus actual early
shell denials; no successful end-to-end runtime admission was attempted or
claimed. No stubbed runtime checks. Full escaped-tree containment/adoption/
reaping, immutable dependencies and source TOCTOU, observer/service identities,
bounded teardown callbacks and actual shell-runtime exit integration remain
OPEN and enforce terminal runtime refusal. Original qualification assertions
unchanged. No app/Jest/services/DBRedisHTTP/network/install/generation/config/
scheduler/cloud/spend/push/merge/deploy/runtime grant.448/426 remain OPEN;
fresh independent exactcommit QA+lead required.

## Bounded callback checkpoint (source/offline, NOT runtime admission)

NEW isolated task-448-bounded-callbacks / tixmo/task-448-bounded-callbacks,
exact base b181da31c0a1358d2e43af3bce2e125c21e5a76a. Actual independent
QA462 25ea1cbc and lead463 ceccd993 reports read. Existing process-cleanup
helper and Node builtins reused; no new orchestrator or dependencies.

finish now validates timeoutMs/graceMs/teardownMs/evidenceMs as finite integers
1..60000 before consuming authority. Callback types validated likewise.
Teardown and evidence waiting each default1000ms; timers remain referenced
so an otherwise idle process reaches the deadline, and are cleared on every
completion. Atomic authority consumption and process-first reaping unchanged.
Primary result/stderr remain unchanged; cleanupError and evidenceError remain
separate. teardownStatus/evidenceStatus distinguish completed/failed/not-started
from timed-out-pending-late-effects-possible. A teardown timeout rejects with
its report after attempting independently bounded evidence; an evidence timeout
returns the original result with secondary evidenceError. Existing exit mapper
preserves primary47 despite both failures and maps success+evidence timeout1.
The evidence callback sees evidenceStatus pending while writing; its completed
status is only known afterward, not a claim of durable receipt completion.

Actual commands: node runner-probes.cjs (task426 path) exit0, twice (second
run after adding overlap+exitmapper assertions); shell-probes.cjs exit0 once;
node --check process-cleanup.cjs and runner-probes.cjs, git diff --check exit0.
New real owned direct children exit47/stderr and0 are closed/reaped before
callbacks. Pending teardown times out40ms with original47, separate evidence
failure and pending-late-effects status; concurrent/reentrant/sequential calls
are denied and callbacks once. A late teardown rejection is observed without
unhandled rejection. Never-settling evidence times out40ms despite no other
owned live subprocess/handle, returns original0+secondary error. Both callers
finish within1500ms.28 invalid timer mutations deny without consuming authority.
Existing two-process cooperative timeout/reap-before-teardown, foreignPID
no-signal, ENOENT8field JSON+ENOSPC, held callback overlap and both callback
reentrancy, exit42/stderr, numeric ports, shell/preflight refusals all PASS.
Expected injected errors and inherited stderr remain visible. All subprocesses
reaped. No original qualification assertions modified; only these three files.

These deadlines bound ASYNCHRONOUS WAITING, not synchronous callback execution
or event-loop starvation. They cannot cancel arbitrary callback side effects:
late teardown/evidence effects may occur and timed-out callbacks may retain
resources. No claim that teardown completed, services stopped or receipt was
written on timeout. Such cancellation/containment remains a runtime prerequisite.
Shell terminal refusal unchanged. Full escapedtree containment/adoption/reaping,
immutable dependencies/source TOCTOU, observer/service identities and admitted
integration remain OPEN.448/426 remain OPEN; fresh independent exactSHA QA and
lead mandatory, no author approval/closure. No app/Jest/services/DBRedisHTTP/
network/install/generation/config/scheduler/cloud/provider/production/spend/
push/merge/deploy/runtimegrant. Commit invocation-local identity/hooks only.
