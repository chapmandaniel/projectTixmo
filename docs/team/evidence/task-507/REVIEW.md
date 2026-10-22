# Independent QA507 bounded source/inert checkpoint

Verdict: APPROVE detached Redis repair and inspected source slice ONLY at exact
`cf08558f3946b308d27a454d8c867075e6197e39`, cumulatively against
`941714e9efa36c8385776acb1ad275c4ae65fcde`. Full499/246 remain OPEN/incomplete.
No runtime, capacity, mock/type compatibility or process admission approval.
New isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-507`,
branch `tixmo/task-507-independent-qa`, exact reviewed SHA as base.
Shared main and all previous worktrees preserved; integration231/509 untouched.

Read immutable lead505 rejection dd43b39b6410d79eeda61543a18b1444a8cc4dbe and
repair review7d4766e940559378b8180e66ccbbac4b4bbbf4ab via git show, role/repository
instructions/workflow, full actual HTTP TS source, ownership.cjs and all three
existing inert probe scripts BEFORE execution. Review is cumulative, not merely
repair delta. No implementation changes by reviewer.

## Findings and scope

No new blocking defect established for this source-only repair. Actual three
Redis spies install exported criticalCall before app capture. It forwards the
receiver/arguments, catches synchronous throw and rejected raw promise INSIDE
tracked work, preserves before swallowing consumers receive rejection, and does
not self-join. Independent probes use the actual exported helper with inert
operations, not a reimplementation. Rejection, swallowed error and sync throw
all retain copied IDs, stop teardown/disconnect/admission permanently with other
raw work pending, and remain closed after that work settles. Nested raw work
is independently observed pending size2, returns13 after release, then really
cleans up. Ordinary settled HTTP/client errors remain distinct and clean up.

Actual waitingRoom catches release zRem and renewal eval errors and fails open
on acquisition errors: this confirms the early latch is necessary. Real
catchAsync spy tracks controller promises; auth/waitingRoom are wrapped;
validation tracks returned async handler; limiter promises use unknown-contract
fail-closed helper. Export-spy/ts-jest runtime compatibility remains unverified.
Close callback is registered as raw work before terminal teardown; callback error
preserves before reject. Pending close cannot authorize resource disconnect;
author inert close/continuation tests freshly pass. Actual server behavior is
not exercised. Fixtures are deliberately retained for owned disposable-process
teardown, not globally deleted.

HTTP source has100 preallocated buyers (107 total setup IDs), barrier release,
client active increment before actual awaited request and decrement in finally,
maxInFlight100 plus100 recorded start/settlement pairs. These are client request
lifetimes, not proof100 simultaneous database transactions. Exact10 HTTP201 and
90 HTTP400 with message `Not enough tickets available` account for all100.
Mounted orders route/controller/service confirm201 and ApiError.badRequest
soldout400, PENDING/HELD positive-price orders, not paid orders. Source asserts
unique orders/orderNumbers/users and tickets/barcodes/orderIds; response/DB
correspondence, PENDING/null paymentIntent, stock0/10/0, owned cancellation
restoration10/0/0 and foreign organization/event/buyer/stock/order/ticket snapshots
unchanged before and after cancellation. Assertions are NOT actual HTTP results.
Cancellation uses existing service userId second argument, scoped to owned rows.

Runnable-interface gaps remain: missing task499.admitDisposable process admission
and default Jest tests/setup.ts calls bootstrapTestDatabase BEFORE body guard.
Body guard alone cannot protect collection/setup. No fake guard/new runner made.
An existing TypeScript5.9.3 parser WAS located in task508 dependencies and parsed
this exact source with zero parse diagnostics (no module evaluation, program,
transpile or typecheck). This narrows earlier unparsed-source uncertainty ONLY;
it does not establish type/Jest mocking compatibility or safe runnable admission.

## Actual checks

All following executed exit0 in task507:

- `node --check docs/team/evidence/task-507/independent-probes.cjs`
- `node docs/team/evidence/task-507/independent-probes.cjs`:5 independent PASS.
- `node --check tixmoapi2/tests/qualification/task499/ownership.cjs`
- `node --check docs/team/evidence/task-499/ownership-probes.cjs`
- `node --check docs/team/evidence/task-499/detached-redis-probes.cjs`
- `node --check docs/team/evidence/task-499/http-source-static.cjs`
- `node docs/team/evidence/task-499/ownership-probes.cjs`:8 fresh PASS.
- `node docs/team/evidence/task-499/detached-redis-probes.cjs`:5 fresh PASS.
- `node docs/team/evidence/task-499/http-source-static.cjs`:12 text assertions PASS.
- `node` heredoc: require node:fs and absolute existing task508 TypeScript parser;
  createSourceFile(file, readFileSync(file,'utf8'), ScriptTarget.Latest, true,
  ScriptKind.TS); report parseDiagnostics and fail if nonempty. Exact file
  tixmoapi2/tests/qualification/orders-http-last-ten.local.ts; parser path
  /home/daniel/projects/projectTixmo/worktrees/task-508/tixmoapi2/node_modules/typescript/lib/typescript.js.
  Output parser5.9.3, parseDiagnostics[].
- `git diff --check 941714e9efa36c8385776acb1ad275c4ae65fcde HEAD`
- `git diff --cached --check` before evidence commit.

Read-only searches initially guessed nonexistent tests/integration and
src/services/order.service.ts/src/controllers/order.controller.ts paths; errors
were corrected to actual qualification and src/api/orders files. Parser ls
reported two absent main paths and existing task508 path; no global absence claim.
Failed lookups are not passing checks.

No app imports/evaluation, Jest/collection, typecheck, DB/Redis/HTTP/services,
runtime/network/install/generation, env/secrets/config/provider/spend,
push/merge/deploy. Only review report and independent inert probes committed.
This is the requested four-minute bounded checkpoint, not full499 closure.
