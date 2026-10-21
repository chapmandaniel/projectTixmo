# Independent QA442 successor review

Exact reviewed SHA **701ad1040caad539ff0afb625d6aa6256c026473** versus
**c8672a17ea9be27014cbdcf14e6e472fb2d8b70f**. New isolated branch
`tixmo/task-442-independent-qa`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-442`.
Read QA44146334168, lead4405c6bd795, successor REPAIR and actual helpers/diff,
catchAsync/auth/validation/waitingRoom exports. Shared main already had untracked
AGENTS.md/docs/team at inspection: untouched. No author's source edits.

**REQUEST_CHANGES: concrete test-harness blocker reproduced offline.**

## Findings sent immediately to PM and original backend

1. **Redis eval spy self-recursion.** Lifetime instrumentation uses
   `jest.spyOn(redis, 'eval')`. Later `realEval = redis.eval.bind(redis)` captures
   that mock. Per-phase `jest.spyOn(redis, 'eval').mockImplementation(...)` returns
   the SAME mock and replaces its implementation. Calling realEval from the phase
   implementation recursively calls the phase implementation, not the saved native
   function. Independent probe executes the exact extracted tracking and phase
   blocks with installed task434 jest-mock and synthetic Redis; identity equality
   confirmed, bounded recursion sentinel reached at depth7, ZERO native eval calls.
   This is an actual offline harness defect, not a product/realHTTP reproduction.
2. **Per-phase restore destroys lifetime tracking.** Same extracted spy's
   mockRestore restores the original Redis eval method, removing the lifetime
   tracker before later phases. Probe verifies function identity and subsequent
   native eval leaves tracker empty. Keep lifetime Redis spy distinct from phase
   gate logic, preserve original/native implementation independently, and restore
   lifetime instrumentation only after successful join.

## Actual checks and qualified improvements

`node docs/team/evidence/task-442/probes.cjs` exit0; immutable raw output in
`probes-result.txt`. Two blocker reproductions above plus four additional checks:

- Tracker joins child work admitted while parent is active, not just the first
  snapshot; pending child keeps join pending until released.
- Original Error identity survives cleanup failure plus ENOSPC; partial/source
  receipt survives in publication argument and fallback diagnostic contains error.
- Cleanup failure precedes artifact error when no primary error exists.
- Source checks confirm pre-app catchAsync tracking, join-before-restoration,
  explicit timeout skip branches and clean-source guard before Redis connection.

Additional actual exit0: existing lifecycle-probes (pending join, stuck handler
skip-disconnect, initialization/empty partial receipt, first-error ENOSPC),
cleanup-probes, offline-check (TS5.9.3 syntax/emitted parse/exact dependency-schema
match/unsafe paths), task427 no-native-connect/listen transport stub, diffcheck.

Auth/optionalAuth/validation return their async promises and catchAsync's hidden
body is wrapped before app import. Those intended tracking hooks exist; no actual
app import/execution or full wrapper compatibility claim. Detached zRem tracking
is intended; overall tracking safety is blocked by eval spy collision. Join has
no admission-close barrier and cannot cancel timers/library background work;
probed nested admission is narrower than proving whole-app quiescence. SourceSHA
uses git in runner cwd, so correct repository cwd and clean tracked provenance
remain runner prerequisites, not independently proven invocation binding.

## Limits/handoff

Actual HTTP/Jest/typecheck/build/runtime qualification **NOTRUN**. No services,
DB/Redis, sockets/PIDs/ports/runtime dirs, dependency links, network/install/
generation/config/spend/push/merge/deploy. No product edits or qualification
counts claimed. Original backend repair followup is separate, unreviewed here;
fresh exact successor QA and lead review required. Task426 remains OPEN, safe
runner/process termination and authorized actualHTTP qualification outstanding.
Evidence-only commit uses invocation-only identity and hooksPath=/dev/null
(previously documented inherited Husky issue), no persistent config changes.
