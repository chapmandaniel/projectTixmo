# Independent lead505 - REQUEST CHANGES

Reviewed exact `b64d52bc934d6a4c16296c0b08076a70e32f68f3` against
`941714e9efa36c8385776acb1ad275c4ae65fcde`, not a reuse of503 approval.
New isolated worktree task-505, branch tixmo/review-505. Source/inert only.

## Blocking F1: detached Redis failures do not preserve

`orders-http-last-ten.local.ts` Redis spies wrap zRem/eval/sendCommand with
ordinary `work.run`. Rejections leave pending with no preservation latch.
Actual waitingRoom.ts catches/logs release zRem errors and renewal eval errors;
acquisition errors also take the product's fail-open path. The test therefore
cannot rely on client or middleware rejection to establish uncertainty.
Once raw rejection is swallowed, join and teardown permit disconnect and
later admission; callback lifetime tracking alone does not provide required
conservative observer failure semantics. Permanently preserve synchronously
inside the raw operation failure path before its tracked wrapper settles.
Do not use critical() in recursively instrumented operations if it self-joins.
Add actual extracted/exported instrumentation inert rejection controls,
including swallowed errors, retained IDs, stopped teardown/admission and valid
settled client/success controls. New exact SHA requires fresh review.

Independent probe extracts the actual Redis spy callback from reviewed TS,
removes only its parameter type annotation and executes it with fake original
and actual ownership helper. All three rejection variants reproduce
preserved=false and cleanup=1/disconnect=1. Probe exit0 means defect reproduced,
NOT safety PASS. No application or TS module evaluated.

## Other source observations

Read complete HTTP source, HTTP-SOURCE.md and static probe before execution.
Actual catchAsync, validation, auth, waitingRoom, limiter, Redis exports,
order controller/service and Jest config/setup read as source. Names/interfaces
match: validate returns async middleware; catchAsync replacement tracks actual
returned controller promise; waiting/auth return promises; controller returns201,
service soldout message is exact400. Limiter dependency runtime promise contract
not executed/qualified. Unknown middleware contract remains guarded by helper.

Source contains100 gated clients with actual start-to-settlement counters,
10 exact201/90 exact400, PENDING/no paymentIntent, unique order/user/ticket IDs,
HELD correspondence, stock0/10/0 then cancellation10/0/0 and foreign snapshots.
Those are assertions, not runtime results. Terminal listener close callback is
registered before drain, external admission stopped, continuations retained on
uncertainty. Fixture rows intentionally retained for disposable-process teardown.
No full fixture/provider/HTTP safety or capacity approval follows from this read.

Known missing process admission symbol is explicit, not a runnable guard.
Additionally default Jest setup calls bootstrapTestDatabase before this test
body; the body guard cannot protect default setup. Any future execution needs
reviewed process-level admission before collection/setup, not a no-op symbol.
No TS parser located in bounded checked main/worktree/global conventional
paths or repository filename search; no syntax/typecheck PASS asserted.

## Actual commands/results

All listed checks exit0:

- node --check docs/team/evidence/task-499/http-source-static.cjs
- node docs/team/evidence/task-499/http-source-static.cjs:12 text assertions PASS.
- node docs/team/evidence/task-499/ownership-probes.cjs:8 fresh helper PASS.
- node --check tixmoapi2/tests/qualification/task499/ownership.cjs
- node --check docs/team/evidence/task-505/detached-rejection-probe.cjs
- node docs/team/evidence/task-505/detached-rejection-probe.cjs:3 unsafe rejection reproductions.
- git diff --check 941714e9efa36c8385776acb1ad275c4ae65fcde HEAD
- git diff --cached --check before report commit.

Parser searches returned no matching installed parser; no parser invoked.
No app imports, Jest/collection, typecheck, DB/Redis/HTTP/services/network,
runtime qualification, install/generation, env/secrets/config/provider/spend,
push/merge/deploy. No product changes; report/probe only.499/246 remain OPEN.
