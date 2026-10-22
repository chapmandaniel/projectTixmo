# Independent QA497 R3 - APPROVE (source-only)

Exact reviewed target: `5526991b45eb8cf93eeda23205f8341b5637ae90`.
Comparison base: `9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b`.
Reviewer branch: `tixmo/task-497-independent-qa-r3`.
New isolated worktree: `/home/daniel/projects/projectTixmo/worktrees/task-497`.
Only this independent report and inert probe authored; no product or author
source edits. Shared main's unrelated untracked files preserved.

Read role/repository/team instructions, list --mine/inbox, board497/493, and
complete immutable prior reports lead496 `689ed441741cc58f310b5daca3ca61cd142c66d9`
and QA495 `9f4b68307bec8198ea2730021072290f298735bd`. Claimed only497. Read the
actual changed helper, checker, full HANDOFF and focused suite before checks.

## Acceptance review

The previous P2 observer lifetime hole is repaired by the conservative alternative
explicitly allowed in both reviews. Actual polling now awaits `observe`, whose
catch calls `preserve` on timeout OR other rejection. This happens before control
reaches concurrency finally/request drain and before the owned body settles and
leaves `live`. `failClosed` has no reset path; late observer settlement cannot
clear it. The raw polling query can remain alive: timers do NOT cancel SQL.

Actual beforeEach rejects future test admission; afterEach rejects before cleanup
and still executes fallback restorers in finally; afterAll rejects before calling
disconnect. The request-drain nested finally still restores its spy even if its
own drain also fails. Already-running SQL is not stopped by the latch. External
sole-owned process and exclusively disposable target reaping remains mandatory
before reuse, retaining owned IDs/evidence. No runtime authorization is inferred.

The author regression genuinely extracts the actual stripped helper/hooks slice
from gate through before fixture, not a reimplemented latch. The whole module is
only parsed unlinked/unevaluated. Fake timers/hooks/Prisma counters show the owned
body leaves while the raw observer remains pending, teardown/disconnect/admission
are denied, restoration runs, and late settlement remains latched. Static text
also ties the real polling callsite to observe. It does not run actual SQL.

Independent check-observer.cjs separately extracts those same actual helper/hooks
and probes timeout, immediate observer rejection, and successful observation in
fresh VM contexts. It asserts the latch inside the owning body's finally BEFORE
live removal; failure paths keep registered fixture IDs, block both teardown hooks
and admission, keep SQL/disconnect counters zero, and run restoration. Rechecking
hooks after late timeout resolution stays denied. Success is a non-vacuity control:
normal cleanup/disconnect each runs once and the latch stays clear. Fake transaction
does not evaluate its callback, so this is admission/control-flow evidence, not
verification of SQL cleanup operations or their FK compatibility.

R3 test diff consists solely of the observe helper and polling bounded-to-observe
call replacement. Thus existing UUID pre-registration/partial fixture ownership,
FK-ordered UUID-scoped audit/ticket/order/type/event/user/org cleanup, request drain,
spy restore, body ownership and all multiline assertions are unchanged from R2.
All41 original assertion-start lines independently compare identical/in order
against original `2a3de901c2297381c9ef5cb816405b0ec981cf9e`. Historical UUID replay,
conflict/no-op, pause/resume conjunction, actual holder-PID observation and audit
FK expectations are retained. Prior limitations remain: audit-first failure
atomicity is not rollback of an earlier flag write; stale payload is sequential,
not separate overlapping writer qualification; service scope is not mounted auth.

## Actual commands/results

Inspected both scripts before running: built-in fs/path/module/vm/assert only,
no application imports, no whole-module link/evaluate, only extracted helper VM.

- `node --experimental-vm-modules docs/team/evidence/task-493/check-source.cjs`:
  exit0, unlinked TypeScript parse,17 markers, deferred-observer regression PASS.
- `node docs/team/evidence/task-497/check-observer.cjs`: exit0; independent timeout,
  rejection and success probes PASS. Experimental strip/VM warnings only.
- Inline Python standard-library git-show/source comparison: exit0; all41 original
  assertion-start lines identical/in order (not behavioral execution).
- `git diff --check 9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b 5526991b45eb8cf93eeda23205f8341b5637ae90`:
  exit0. Staged report/probe whitespace check required before commit.

SQL/Jest/typecheck/generated-client/runtime compatibility NOT RUN/UNVERIFIED.
No app imports/evaluation, DB/runtime/services/generation/migration, network,
install/env/secrets/config/scheduler/provider/production/spend/push/merge/deploy.
This APPROVE is independent QA source readiness only, not SQL PASS or launch
acceptance. Fresh separate lead498 exact-SHA approval is still mandatory;493
remains REVIEW and full248/243/launch OPEN. Complete reviewer497 only.
