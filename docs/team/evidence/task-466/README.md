# Task466 independent QA: scoped SOURCE/OFFLINE APPROVE

Candidate `069fae13a0875fbb8f9a5fbc8d08a0c6128c9ac0` versus
`b181da31c0a1358d2e43af3bce2e125c21e5a76a`.
NEW isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-466`,
branch `tixmo/task-466-qa-callbacks`. Task466 claimed only, never448.
Role/repository/team instructions retained from immediately preceding465;
current466 and448 claims/recent notes, actual changed helper and both existing
fixture suites read. Three candidate paths only: process-cleanup.cjs,
runner-probes.cjs and RUNNER-CHECKPOINT.md. No author source edits.

## Verdict

APPROVE bounded asynchronous callback-wait checkpoint only. Timer validation
precedes authority consumption. Inclusive integer1..60000 limits preserve a
valid subsequent completion after rejected options. Once-only authority remains
consumed before callbacks; concurrent and both callback reentrancies deny.
Callback wait deadlines preserve original child code and inherited stderr,
separate cleanup/evidence errors and explicit pending/late-effects status.
Timers clear on success, sync throw and async rejection. Direct owned children
were actually closed/reaped and absent from /proc before callbacks.

## Actual results

- `node docs/team/evidence/task-466/probes.cjs`: exit0, **12 counted independent
  checks PASS**, full stdout/stderr in results.txt. Four inert owned Node child
  subprocesses, all closed/reaped. No app/services/network.
- Independent validation covers eight invalid values for each of four timer
  options (32 denials), two invalid callback options, successful lower/upper
  limits1/60000, successful timer clearing, consumed completion, held teardown
  timeout plus evidence failure, concurrent/reentrant denial, preserved exit50,
  late settlement status, pending evidence/fallback1/late rejection handling,
  synchronous teardown and async evidence failures with both timers cleared.
  These subassertions are grouped into12 checks, not separate extra counts.
- `node docs/team/evidence/task-426/runner-probes.cjs`: exit0 PASS, retained
  runner-results.txt. Existing cooperative two-process timeout/reap-before-
  teardown, foreign child authority denial/reap, serialized ENOENT+close+
  evidence ENOSPC, exit42/stderr, original atomic cleanup and deadline probes.
- `node docs/team/evidence/task-426/shell-probes.cjs`: exit0 PASS, retained
  shell-results.txt. Actual scrubbed shell early denials, owned disk/Git
  source/dependency/path fixtures, owned exit37/SIGTERM/ENOENT mapping.
- `node --check docs/team/evidence/task-426/process-cleanup.cjs` and
  `node --check docs/team/evidence/task-466/probes.cjs`: exit0.
- `git diff --check`: exit0.

Independent suite ran once; existing runner/shell each ran twice, second run
captured explicit per-command exit0 because first batched invocation did not
expose individual exits. No failed test runs. Expected injected evidence error
stacks are retained, not test failures. All existing suites' owned child handles
were reaped and temporary fixture disk removed by their own finally cleanup.

## Limits

Only asynchronous waiting is bounded: no event-loop/synchronous preemption,
callback cancellation, resource release or teardown-completion proof. Callbacks
may have late side effects. Timed-out writeEvidence receives the mutable report;
this is not an immutable or authenticated receipt. Evidence callback observes
pending before its own completion; no self-publication outcome proof implied.

Terminal shell refusal is unchanged. Task448 and426 remain OPEN. Full escaped
process-tree containment/adoption/reaping, immutable dependencies/sourceTOCTOU,
native provenance, observer/service identities and admitted runtime integration
remain OPEN. Independent lead review of this exact SHA remains required.
No runtime grant/fullacceptance/closure. No app/Jest/services/DBRedisHTTP/sockets/
network/audits/install/generation/config/schedulers/cloud/spend/push/merge/deploy.
Main untracked files preserved. Inspected inherited missing Husky helper;
report commit uses invocation-local identity/hooks override only, no persistent
config write and no lint-staged execution claimed.
