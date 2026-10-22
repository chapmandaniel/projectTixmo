# Independent QA501 - source/inert review

Reviewed exact `52f528a56523c519aee44e38ca3a5ebf0e4aea49` against
`73aa2b2a649dd64bd3d14b048212a84ec1f2d656`.
Isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-501`,
branch `tixmo/task-501-independent-qa`; four-minute bounded review.

## Verdict: REQUEST CHANGES for helper safety

**F1: middleware contract failure does not preserve unknown lifetime.**
`promiseMiddleware` rejects when the original does not return a promise,
explicitly saying it cannot establish continuation lifetime. That rejection
uses ordinary `run`, not a conservative preservation path. `join` uses
`allSettled` and removes the rejected wrapper; subsequent `teardown` succeeds,
`preserved` remains false, and cleanup executes. The independent probe starts
an inert unresolved raw operation inside invalid middleware, observes the
contract rejection, then proves cleanup occurs before that raw operation ends.
An unsupported middleware contract must permanently latch uncertainty before
any teardown/admission, rather than treating this as a settled client error.
Fix in the original author task and independently re-review the new exact SHA.
This is a source seam defect, not evidence of actual application middleware
misbehavior; instrumentation installation is still absent.

## Evidence

Read helper, author probes and CONTINUATION.md before execution. Inspected
exact426 `510824df9e9bb7f5e57984862728b52929f7f849` lifecycle tracker and
middleware-lifetime source via `git show`: mutable-set algorithm and middleware
wrapper match the documented provenance. Inspected493 source on the exact
review candidate (unchanged from its5526991b ancestor): permanent preservation,
observer error latch and IDs recorded before INSERT support the claimed
adaptation. The reviewed diff adds only four files (CONTINUATION.md, helper,
author probes/results); no original source/test assertions were changed.
107 preallocated setup IDs include 100 buyers plus primary3 and foreign4.

Commands, all exit0 unless noted:

- `node --check tixmoapi2/tests/qualification/task499/ownership.cjs`
- `node --check docs/team/evidence/task-499/ownership-probes.cjs`
- `node docs/team/evidence/task-499/ownership-probes.cjs`: all six PASS,
  freshly executed, not copied historical output.
- `node --check docs/team/evidence/task-501/independent-probes.cjs`
- `node docs/team/evidence/task-501/independent-probes.cjs`: two independent
  positive controls PASS, then F1 reproduction (intentionally asserts the
  observed unsafe behavior; exit0 means reproduction, NOT safety PASS).
- `git diff --check 73aa2b2a649dd64bd3d14b048212a84ec1f2d656 52f528a56523c519aee44e38ca3a5ebf0e4aea49`
- `git diff --name-status` same SHAs: four additions only.

The six author checks demonstrate preallocation; unresolved actual exported
middleware continuation and fake raw-close lifetime permanently prevent
cleanup/disconnect/admission even after late settlement; settled client failure
and success both actually execute cleanup; critical observer rejection latches.
Independent controls additionally prove failed teardown step prevents later
disconnect, and mutable join includes nested work registered while a parent
operation runs. The raw-close fake is not real server-close integration proof.

One exploratory `rg` exited2 because426 artifacts and a guessed493 helper path
are absent from this candidate; exact426 source was then read with `git show`,
and493 located in `tests/integration/event-sales-pause.sql.test.ts`. No service
or app execution resulted from that path lookup.

## Acceptance remains incomplete

No 100-buyer last-ten HTTP acceptance test or installed instrumentation exists
in this slice. CONTINUATION.md accurately records the remaining barrier,
actual maxInFlight, ten201 PENDING/no paymentIntent and ninety exact400 soldout,
unique owned order/ticket correspondence, stock0/10/0 then cancellation10/0/0,
duplicate-hold exclusion, foreign-sentinel and full owned-resource requirements.
Do not close499 or246, call this runtime/capacity qualification, or grant runtime
from this report. Independent lead review is separately required.

Executed only reviewed helper/probe code and Node builtins. No application
imports, Jest, typecheck, DB, Redis, HTTP, services, network, dependency install,
generation, env/secrets/config/provider/spend, push, merge or deploy. No product
fixes were made by QA; task501 adds only report and independent inert probe.
