# Independent QA review 389

Reviewer tixmo-qa, 2026-10-21. **APPROVE - source preparation only.**
Exact reviewed `b0d749d6962f75d6daee2836a4605e505daf4556`;
base `929355653b2b37ae50633e704eb2a2628e5e4967`.
Branch `tixmo/task-389-independent-qa`, isolated worktree `task-389`.

Read role/repository/team workflow, tasks385/379/382/383 and complete five-file
diff including repair receipt. No blocking source finding in bounded repair.

- Guard inspects normalized Node [options,callback] directly, otherwise uses
  Node normalization; original arguments forwarded unchanged preserve callbacks.
  Rejects any path, non-127.0.0.1 host and ports outside explicit owned list.
  Node-only protection, emphatically not a subprocess/network sandbox.
- Redis/app/listen acquisition now falls inside try/finally. Redis disconnect
  is attempted even if connect assignment rejects (module singleton inspected),
  and listen failure rejects. Independently attempted server/Redis/Prisma cleanup
  is no longer skipped by artifact/cancellation/disconnect failure.
- Monitor catch attaches immediately, sets failure and stopping flags; scheduler
  checks failure after arrival sleeps and while draining, pump stops queued work.
  Active requests drain; original captured setup/measurement error is rethrown
  before monitor/cleanup errors. These are source control-flow observations.
- Runner path validation precedes services; test repeats it before Redis.
  Existing ancestors checked via lstat, root/current UID, no group/other writes,
  no symlinks; private runtime/task/run exactly owned0700, realpath equality,
  unique child constraint and explicit disk filesystem allowlist fail closed.
  Unique private run now holds migrate/acceptance logs as well as evidence.
- Unchanged100 same-IP actualHTTP assertions: exact100GET200/100POST201,
  200results, max30active,100 unique pending orders/buyer/order numbers,
  HELD ticket/barcode identity and stock0/100/0. Cancellation100/0/0 and lease
  zero retained. Same-IP headers,30/sec scheduler, real Redis/unmock ordering,
  JWT fixture and lock/connection/CPU/RSS/queue/Redis metrics inspected.

Actual checks, all exit0:
- `bash -n docs/team/evidence/task-379/runtime.sh`
- `node --check docs/team/evidence/task-379/network-guard.cjs`
- `node --check docs/team/evidence/task-379/runtime-path.cjs`
- `git diff --check 929355653b2b37ae50633e704eb2a2628e5e4967 b0d749d6962f75d6daee2836a4605e505daf4556`
- Python text-only exact original/current HTTP assertion-block comparison,
  setup boundary, immediate monitor handler, pump stop and disconnect sequencing.

No helper/guard/harness behavior execution, compiler/Jest/DB/services/load,
install/download/network/envsecret/config/Gateway/scheduler/provider/spend/push/
merge/deploy. No runtime certification; external timeout remains last-resort for
hung awaits and source preflight does not prevent same-UID replacement races.
Unknown filesystem fails closed. Fresh separate PM soleDB runtime grant still
required. Full246 remains OPEN; PM owns385/379 closure after both reviews.
Hook execution NOT RUN; only command-scoped identity/hooks flags. Main and all
other worktrees preserved. Prior383 request-changes is historical, not a pass
for this SHA; this report independently reviews its repairs.
