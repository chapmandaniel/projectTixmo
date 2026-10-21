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
