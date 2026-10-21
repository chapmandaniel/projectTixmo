# Lead454 cumulative independent review — REQUEST_CHANGES

Exact reviewed candidate `c21be3d31d7b491d691dc5e0c9f96ee39b55853d`, cumulative
against `510824df9e9bb7f5e57984862728b52929f7f849`. New isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-454`, branch
`tixmo/task-454-lead-review`, started at exact candidate. Four cumulative author
files inspected; author files, original426 assertions and427 runner untouched.
Read required team instructions,448/454 notes, RUNNER-CHECKPOINT and actual
QA451 `be94cf2fc9548b497068318939fb1685aa7c1e85`, QA452
`f698489731a72d16c4919544a6f92925548d6a71`, QA453
`40afdab4b63336ceccd079b14e4490eed0b0263b` README reports.

## Blocking finding: concurrently reusable cleanup capability

`process-cleanup.cjs:35` checks WeakSet membership, but does not consume or mark
in-flight authority until line66, after asynchronous waits, teardown and evidence.
Two simultaneous `finish(record)` calls therefore both accept the SAME genuine
owned child capability and both invoke teardown. This violates the no-reused-
capability requirement, although sequential reuse is correctly denied.

Independent deterministic reproduction uses a real owned Node child already
closed/reaped. First finish enters a held synthetic teardown; second finish on
the same record also enters teardown and releases the first. Both promises
fulfill and teardown count is2. No forged record, network or services involved.
Reject/atomically consume duplicate finish authority before the first await,
or explicitly share one in-flight completion without invoking callbacks twice.
Original author should repair and add concurrent/reentrant regression alongside
existing sequential reuse and primary-error/evidence-failure assertions.
Reviewer made no implementation changes.

## Actual commands and results

- `node docs/team/evidence/task-454/probes.cjs`: exit0, **14 counted checks PASS
  plus1 deterministic reproduced defect**, retained `results.txt`. Real owned
  cooperative TERM and ignoring-TERM SIGKILL timeout cases directly reaped and
  /proc absent before synthetic teardown; sequential consumed authority denied;
  foreign live child denied without signal and explicitly stopped/reaped by
  reviewer. Real ENOENT close, all8 plain diagnostic fields JSON-roundtripped,
  close -2/null, timeoutfalse and separate evidence error preserved. Exit39 and
  stderr sentinel plus injected evidence failure preserved. Three preload
  denials, actual wrongSHA denial, canonical valid pair, six alias/range/malformed
  denials and guard absent after rejected preflights passed.
- `node docs/team/evidence/task-426/runner-probes.cjs`: exit0, retained
  `author-results.txt`: real cooperative two-process timeout/directreap/group
  absence before teardown; foreign authority; ENOENT JSON+ENOSPC, canonical
  ports/preload/SHA, exit42/stderr+ENOSPC PASS.
- Three `node --check` commands: preflight.cjs, process-cleanup.cjs, and
  task-454/probes.cjs: exit0. `git diff --check`: exit0.
- Initial attempted historical reports at REPORT.md returned path-not-found;
  inspected git trees then read actual README.md reports. No test failures
  hidden. Only one independent probe execution and one author execution.

Source inspection confirms preload rejection precedes provenance, private path
validation precedes canonical port validation, and native guard require follows
all those checks. No real successful admission attempted, no provenance/path
substitutions used here. WrongSHA invokes only local Git identity inspection.
Native guard itself/source reuse inspected, not newly exercised on valid path.
No full source/dependency admission or immutable attestation claim.

## Boundaries retained

SOURCE/OFFLINE helper review only, not448 acceptance or426 closure/runtimegrant.
Full escaped-session/tree containment/adoption/reaping remains unproven; group
identity/group disappearance is not exhaustive full-tree containment. env-i shell
bootstrap, before-Jest integration, immutable dependencies/source TOCTOU,
bounded teardown callback, original shell exit mapping, observer and service
identity wiring remain incomplete. Never infer approval from passing direct
child tests or QA453 narrower serialization approval.

No app/Jest/services/DB/Redis/HTTP/network/install/generation/config/scheduler/
cloud/provider/production/spend/push/merge/deploy. All direct fixture children
reaped. Own evidence directory only. Report-only commit uses invocation-local
identity and hooksPath override after inspecting inherited Husky configuration;
missing helper means no lint-staged claim and no persistent config change.
