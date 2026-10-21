# Task472 independent lead: scoped APPROVE

Reviewed exact `4a265fb957cfc760d4c985c55a0190ee4517671b` versus
`069fae13a0875fbb8f9a5fbc8d08a0c6128c9ac0`. NEW isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-472`, branch
`tixmo/task-472-lead-review`, based exactly on target. Read current472/448 notes,
role/repository/team instructions and actual QA471 immutable
`3b388998fe832fe976b208ba55172d8930c1557e` report and independent probe source
before own probes. Author files untouched. Scope: lead467 F1 normalization repair.

## Verdict

APPROVE this source/offline checkpoint only. No newly reproduced blocker.
Both callback paths safely normalize arbitrary rejection before property/code
access; primary child report survives and secondary failure remains nonzero.
The three-file candidate delta only changes process-cleanup normalization,
author regressions and checkpoint documentation. Existing terminal shell is
unchanged and still refuses application/Jest execution. This is not acceptance
of the full task448 runner and does not close448/426 or grant runtime authority.

## Actual checks

`checks.json` records individual exit statuses; retained logs are actual output.

- Independent `node docs/team/evidence/task-472/check.cjs`: exit0,55 cases,
  54 real owned direct children closed/reaped plus one deliberately nonexistent
  command launch (no PID; its close/error diagnostics checked). 52 cases cross both callback paths and primary0/73 with
  null,undefined,string,false,0,NaN,bigint,symbol,null-prototype,revoked Proxy,
  all-getter-throwing Proxy, hostile field getters/unprintable conversion,Error.
  Remaining3: simultaneous synchronous failures in both callbacks; real ENOENT
  plus both callback failures; teardown AND evidence deadlines with demonstrated
  post-deadline late effect. Exact original result identity/code/signal, JSON
  nonempty diagnostics/status,0->1 and73->73 mapping, reaping-before-callback and
  reentrant/sequential one-shot denial pass. ENOENT code/message/path/close-2 and
  status127 remain despite both callback failures. 54 actual primary stderr
  sentinels independently verified exactly once in inherited captured stderr.
- Existing runner-probes: exit0, real cooperative two-process timeout/termination/
  disappearance/direct reaping BEFORE teardown; foreign-PID denial; atomic held
  concurrent/reentrant/sequential denial; ENOENT serialization; primary stderr/
  status+ENOSPC; timer validation/deadline/late rejection and author's36cases.
- Existing shell-probes: exit0, offline shell/preload/source/dependency/path
  denials and real owned exit/signal/ENOENT mapping. Offline fixture success is
  not application admission.
- Three `node --check` checks: independent probe, process-cleanup, runner-probes
  all0; `git diff --check`0. Target/base shell diff empty. Runner/shell ran twice and independent probes three times, all passing;
  retained final logs plus initial independent results/stderr. Final independent
  rerun only corrected launch-attempt versus actual-child output count labels. No failed behavioral checks.
- An exploratory rg included nonexistent shell-admit.cjs and printed a missing
  path warning; not a test or admission check. No behavior assertion uses it.

## Limits

SOURCE/OFFLINE only. No app/Jest/services/sockets/DB/Redis/HTTP/network/install/
config/spend/push/merge/deploy. No author edits or delegation. Actual owned
fixture process checks do not prove full escaped-tree containment, adoption or
reaping, immutable runtime source/dependency provenance/TOCTOU, observer/service
identities or admitted integration. Asynchronous wait deadlines do not preempt
synchronous work, cancel callbacks, prevent late effects or prove teardown
completion. Arbitrary callback code/getters are not sandboxed; report objects
remain mutable and diagnostics are not authenticated receipts. All direct
children from independent probes reaped; missing-command error awaited close.
Evidence commit uses invocation-local Git identity and disabled hooks only;
no persistent configuration mutation.
