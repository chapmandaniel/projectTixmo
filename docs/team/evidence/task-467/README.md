# Task467 independent lead: REQUEST CHANGES, SOURCE/OFFLINE only

Candidate `069fae13a0875fbb8f9a5fbc8d08a0c6128c9ac0` versus
`b181da31c0a1358d2e43af3bce2e125c21e5a76a`.
Actual QA466 report `25b515ab5955078fe65149d9be14a7da087a1372` read;
its scoped approval does not cover the non-Error rejection variants below.
New isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-467`,
branch `tixmo/task-467-lead-review`, based on exact candidate. Shared main's
untracked AGENTS.md/docs/team preserved. No author edits.

## Blocking finding F1: non-Error callback failures are not safely recorded

`docs/team/evidence/task-426/process-cleanup.cjs`, callback catch blocks in
finish (teardown around line90; evidence around line100), assume a caught
value has `.code` and `.stack`. JavaScript callbacks may reject any value.
The validated callback contract does not restrict thrown/rejected values.

Actual real-owned-child reproductions in probes.cjs/results.txt:

- Evidence `throw null` and `throw undefined`: secondary handling itself throws
  TypeError, with no `.report`. Primary child result is unavailable through
  finish's failure contract; one-shot authority has already been consumed.
- Evidence `throw 'primitive467'`: evidenceStatus is failed but evidenceError
  is undefined. With primary code0, existing status(report) returns0, silently
  reporting success despite failed evidence callback.
- Teardown `Promise.reject(null)`: original rejection becomes a property-access
  TypeError; teardownStatus remains pending rather than failed. Primary54 is
  retained in this variant's report, but secondary diagnostic/classification
  contract is broken.

Normalize arbitrary callback rejection values into a safe diagnostic before
inspecting code/stack; preserve primary result and fail secondary status
mapping. Add regression assertions for null/undefined/string (and other
primitive) rejection values in both callback paths. Return to original author;
fresh exact-SHA QA and lead review required. This report makes no author fix.

## Actual checks

- `node docs/team/evidence/task-467/probes.cjs`: exit0; six diagnostic assertion
  groups, including40 invalid timer denials, deadline plus separate Error
  evidence failure, concurrent/reentrant/sequential denial, and four reproduced
  defect variants. Passing reproduction assertions are NOT acceptance approval.
  Five inert direct owned children closed/reaped; /proc absence checked inside
  callbacks. Primary stderr remains inherited and captured in results.txt.
- `node docs/team/evidence/task-426/runner-probes.cjs`: exit0, captured
  runner-results.txt. Existing real cooperative two-process timeout/reap,
  foreign authority denial, original result/stderr, timer and reentrancy probes.
- `node docs/team/evidence/task-426/shell-probes.cjs`: exit0, captured
  shell-results.txt. Read before execution; offline disk/Git/dependency fixtures,
  early shell refusal, owned exit/signal/ENOENT mapping; no admitted app path.
- `node --check` process-cleanup.cjs, runner-probes.cjs and task467/probes.cjs:
  exit0 each. `git diff --check`: exit0. Existing suites each run once.

## Scope and limitations

Integer1..60000 validation precedes one-shot consumption; Error-valued callback
deadlines and separate errors behave as documented in exercised paths.
Timers bound asynchronous waiting ONLY, not synchronous/event-loop execution,
cancellation, prevention of late effects, resource release or completed teardown.
Timed-out mutable report is not authenticated or immutable receipt evidence.
All fixture children reaped; no escaped-tree containment claim.

Full escaped-tree containment/adoption/reaping, native provenance, immutable
dependencies/source TOCTOU, observer/service identities and admitted integration
remain OPEN. Terminal shell refusal unchanged;448/426 remain OPEN. No runtime
grant, app/Jest/services/DB/Redis/HTTP/network/install/config/scheduler/cloud/
spend/push/merge/deploy. Only task467 report, diagnostic script and logs committed.
Invocation-local Git identity/hooks override only; no persistent config mutation.
