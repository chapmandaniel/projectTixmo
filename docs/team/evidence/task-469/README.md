# Task469 independent lead: scoped extraction APPROVE

Exact candidate `8eaf5cec7fc62bf093bbf4cb401bcc0396a9b161` versus
`d5fec56e99a37218ef06a512e265c99942290340`.
NEW isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-469`,
branch `tixmo/task-469-lead-review`. Required role/repository/team instructions
retained from preceding467/468; current469 assignment and all four changed
files read. Only469 claimed; shared main untracked files preserved.

## Verdict

APPROVE the verbatim inert helper extraction ONLY. No blocker found in this
bounded refactor. Fresh QA470 is separate and remains required. No author edits.

Independent reconstruction compares the helper's entire body after its two
header lines with the immutable base's alive-through-cleanup block, byte for
byte; replacement of the single new source line reconstructs the entire old
runtime.sh exactly. Thus existing grant/scrub defaults, source publication,
trap placement, environment, provisioning/listener/gate ordering and status
handling are unchanged by this diff. Helper top level consists only of comments
and four function definitions; sourcing registers no traps and runs no service
operations. Existing use of PWD matches the runtime's other source references.

The author fixture covers Redis own identity and foreign PID/UID/executable
denials, foreign-live identity refusal, partial startup7/9, mocked leftover
listener and failed cleanup. Independent checks add foreign parent, explicit
zero mock signals for foreign identity, stubborn-owned TERM/KILL40-poll bound,
preexisting trap/options preservation, and partial startup27. These are inert
command substitutions, not validation of live service identity/security.

## Actual checks

- `node docs/team/evidence/task-469/check.mjs`: exit0, six independent grouped
  checks PASS, results.txt retained. Byte-exact extraction/reconstruction;
  inert source preserving options/traps; foreign live identity gets zero mock
  signals; stubborn owned mock performs TERM/KILL and40 mocked polls then
  fails; same UID/PID/executable with foreign parent rejected; no-service
  partial startup retains27 and mocked foreign listener denies success.
- `node docs/team/evidence/task-432/offline-shell-functions.mjs`: exit0 PASS.
- `node docs/team/evidence/task-432/offline-local-phase.mjs`: exit0 PASS,
  including default missing-provider denial and inert lifecycle regressions.
  Both existing results retained in regressions.txt. Each suite ran once.
- `bash -n` runtime.sh and owned-lifecycle.sh: exit0 each.
- `node --check docs/team/evidence/task-469/check.mjs`: exit0.
- `git diff --check`: exit0.

No failed runs. All short Bash/Git fixture subprocesses exited/reaped through
spawnSync/execFileSync. No actual signals, services, process/listener identity
inspection, network or capability experiment. Broad qualification suites
were not repeated; author historical runs are not this review's executions.

## Limits

Extraction preserves existing cleanup semantics; it does not newly prove PID
reuse resistance, escaped-tree containment, PG lifecycle, live service
ownership or native admission. No ready/close provider protocol is added.
Missing-provider denial remains; the legacy entry's grant refusal remains
unchanged. Native enforcement, installed/generated/runtime provenance and
registry/DNS admission remain absent/open. Task432 stays OPEN/INCOMPLETE;
original424 FAIL retained. No runtime grant, fullmarketPASS or task432 closure.
No app/Jest/DB/Redis/HTTP/network/install/config/scheduler/spend/push/merge/
deploy. Only task469 evidence committed with invocation-local identity/hooks
override; no persistent configuration changes.
