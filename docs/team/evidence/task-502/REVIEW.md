# Independent QA502 - unknown middleware lifetime repair

Exact reviewed SHA: `941714e9efa36c8385776acb1ad275c4ae65fcde`.
Compared against: `52f528a56523c519aee44e38ca3a5ebf0e4aea49`.
New isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-502`,
branch `tixmo/task-502-independent-qa`. Three-minute bounded source/inert review.

## Verdict: PASS for QA501 F1 repair only

Read own immutable501 report and the actual repair diff, full helper and
author probes before executing them. No implementation changes by QA.
`promiseMiddleware` now catches an absent promise contract or synchronous
throw and invokes the same permanent `preserve` latch inside the tracked
operation, before that wrapper settles. Unlike an ordinary settled client
failure, unknown lifetime cannot silently disappear from the pending set and
authorize teardown. Preservation retains the first failure and its inventory.

Fresh independent actual-helper probe adapts501 F1 from defect reproduction
to safety assertions for both missing return and synchronous throw after a
hidden deferred operation starts. A queued microtask verifies preservation
and admission rejection before wrapper settlement notification. After wrapper
settlement, pending size is0 but hidden raw work remains pending: teardown
rejects with zero cleanup/disconnect and exact retained IDs. Mutating the
returned inventory copy does not alter retained IDs. Late hidden settlement
does not reopen join, teardown or admission or mutate retained inventory.
Both cases PASS.

Independent nonvacuous controls also PASS: settled client failure and success
each actually execute cleanup without preservation; a failed teardown step
blocks later disconnect; nested raw registration is joined before cleanup.
The author's eight checks freshly PASS, including original pending real helper
middleware continuation/fake raw-close lifetime, 107-ID preallocation and
critical observer rejection controls. Fake raw-close is not server integration.

## Actual commands and results

All exit0:

- `node --check tixmoapi2/tests/qualification/task499/ownership.cjs`
- `node --check docs/team/evidence/task-499/ownership-probes.cjs`
- `node --check docs/team/evidence/task-502/independent-probes.cjs`
- `node docs/team/evidence/task-499/ownership-probes.cjs`: eight PASS.
- `node docs/team/evidence/task-502/independent-probes.cjs`: six PASS.
- `git diff --check 52f528a56523c519aee44e38ca3a5ebf0e4aea49 941714e9efa36c8385776acb1ad275c4ae65fcde`
- `git diff --name-status` same SHAs: only helper, author probe/results and
  CONTINUATION.md modified; no original application/test source weakened.
- `git diff --cached --check` for this report/probe before review commit.

No new blocking finding in this bounded repair review. QA501's historical
REQUEST CHANGES remains immutable for its old exact SHA; F1 is repaired only
on the exact new SHA reviewed here. This report does not change old evidence.

## Limits and remaining acceptance

Approve only the repaired partial source/helper slice, NOT full499 completion.
No installed actual HTTP instrumentation or 100-buyer last-ten HTTP test was
added. Remaining barrier/maxInFlight, exact10 HTTP201 PENDING/no paymentIntent
and90 exact soldout400, unique owned orders/tickets, stock0/10/0 followed by
owned cancellation10/0/0, duplicate-hold exclusion, foreign sentinel and whole
owned-resource integration assertions still require implementation/review.
499 and246 remain incomplete/OPEN; do not close499. Independent lead review
is separately pending. No runtime/capacity qualification or runtime grant.

Execution was reviewed inert helper/probes plus Node builtins only. No app
imports, Jest, typecheck, DB/Redis/HTTP/services/runtime, network, install,
generation, env/secrets/config/provider/spend, push, merge or deploy. Command-
local Git identity/hooks bypass for review commit only; no config writes.
