# Task471 independent QA: scoped APPROVE

Exact candidate `4a265fb957cfc760d4c985c55a0190ee4517671b` versus
`069fae13a0875fbb8f9a5fbc8d08a0c6128c9ac0`.
NEW isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-471`,
branch `tixmo/task-471-qa-review`. Read task471 and actual lead467 report
`2909e0b6b999e12879f962a066e1fd3fe064c372`, repair diff and affected helpers.
Inherited role/repository/team instructions remain applicable. Author untouched.

APPROVE this arbitrary callback rejection normalization repair ONLY. Lead467 F1
is repaired in tested teardown and evidence paths. Defensive property reads and
conversion prevent primitive/hostile rejection handling from replacing the
primary report. Both secondary paths now record nonempty failure diagnostics;
status maps successful primary plus secondary failure to1 and retains nonzero
primary status. Existing Error diagnostics and callback deadline codes survive.

## Actual independent evidence

- `node docs/team/evidence/task-471/check.cjs`: exit0,48 actual owned direct
  closed/reaped child cases. Both teardown/evidence paths crossed with primary0
  and61 and12 values: null, undefined, string, false,0,bigint,symbol,null-prototype
  object, revoked Proxy, hostile message/stack/code getters plus unprintable
  conversion, empty message/stack fields, and ordinary Error. Report retains
  exact original result object/code/signal; JSON remains serializable; diagnostics
  nonempty; statuses failed;0->1 and61->61; Error message preserved. Both callbacks
  run once, verify child /proc disappearance and exitCode before callback work;
  reentrant and sequential reuse denied. Results retained results.txt.
- Child stdio is genuinely inherited: stderr.txt captures all48 distinct primary
  sentinel lines plus separate evidence diagnostics. Explicit Python check found
  every expected sentinel exactly in its primary/path/value combination.
- Existing `node docs/team/evidence/task-426/runner-probes.cjs`: exit0, retained
  runner-results.txt. Includes author's36cases plus preexisting ENOENT/ENOSPC,
  primary stderr/status, timer/late rejection, concurrency/reentrancy, cooperative
  two-process timeout/reaping, foreign authority and port/preload checks. Author
  probes supplement but do not replace independent48cases.
- Existing `node docs/team/evidence/task-426/shell-probes.cjs`: exit0, retained
  shell-results.txt. Scrubbed shell early denials, disposable offline disk/Git
  fixtures, source/dependency/path denials, owned exit/signal/ENOENT status mapping.
- `node --check` process-cleanup.cjs, runner-probes.cjs and independent check.cjs:
  each0. `git diff --check`:0. No failed test attempts.

## Limits

Only inert local fixture children and temporary offline disk/Git fixtures ran.
Owned fixture lifecycle/signal checks do not exercise application services or an
admitted runtime. No app/Jest/DB/Redis/HTTP/network/install/config/spend/push/merge/
deploy. Existing shell terminal refusal remains. This review does not grant runtime,
close448/426, or approve full escaped-tree containment/adoption, immutable runtime
provenance/dependencies/source TOCTOU, observer/service identity or integration.
Timers still bound asynchronous waiting only, not cancellation, synchronous work,
late effects or completed teardown. Callback code is not a hostile-code sandbox;
mutable reports are not immutable/authenticated receipts. Evidence-only commit;
invocation-local Git identity/hooks override, no persistent config mutation.
