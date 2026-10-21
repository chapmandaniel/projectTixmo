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
