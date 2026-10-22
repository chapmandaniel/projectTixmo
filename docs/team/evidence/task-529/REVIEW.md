# Independent QA529: checked-binding source review

Reviewed exact `d4fd52c1637c24d9f1bb003685029e915745bf6e` against
`cf08558f3946b308d27a454d8c867075e6197e39`.
Reviewer: tixmo-qa (not author). Branch `tixmo/task-529-independent-qa`;
new isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-529`.

## Verdict: APPROVE source-binding improvement ONLY

No blocking source regression found in this bounded diff. This is NOT a
TypeScript/mock-compatibility PASS. Compiler diagnostics NOT PRODUCED.
Full499/246 remain INCOMPLETE; separate exact-SHA lead review remains required.
No runtime, HTTP, capacity or precollection-guard acceptance follows.

Read author CHECKED-BINDINGS.md and independent513 immutable
`f27757b4b8e2a616e8200a890a8f37be12e557ff:docs/team/evidence/task-513/REVIEW.md`.
513 establishes existing generated Prisma schema mismatch, not a reproduced
mock error. No repeated dependency search, stale-client compiler, installation,
generation or fake declarations were attempted.

## Source inspection

Actual config/redis exposes async connectRedis returning RedisClientType and
async disconnectRedis returning void; config/prisma defaults PrismaClient.
Type queries target those exports, auth authenticate/optionalAuthenticate,
waitingRoom, catchAsync, validate, limiter exports, api/orders/service orderService
and utils/jwt generateAccessToken. All paths exist. These typeof-import queries,
annotations, definite assignment and literal const assertions are erased types;
no executable imports or product evaluation were added ahead of admission.

Actual catchAsync accepts a Request/Response/NextFunction function returning
Promise<unknown>, and returns a void handler. Replacement preserves this source
shape and now receives contextual args from the real binding. Actual validate
accepts AnyZodObject and returns an async three-argument handler; replacement
uses Parameters<typeof handler> and unchanged tracking around handler(...args).
These are source observations, not compiled assignability evidence.

Splitting the heterogeneous loop preserves auth then waitingRoom require order,
spy installation order authenticate/optionalAuthenticate/waitingRoom, and capture
of each original function before replacing that property. Neither product
middleware module imports the other in the inspected source. The same helper is
called with the same original/work arguments. Redis/limiter literal tuples retain
method names/order, binding and adapter calls; restore inventory remains reversed
in teardown. Measurement runtime objects and pushes are unchanged.

Read ownership.cjs in full; byte-for-byte unchanged versus base. Lifetime tracker,
permanent uncertainty latch, raw criticalCall rejection preservation, inventory,
join, admission and teardown behavior are not modified by this diff. All 23
assertion call expressions are unchanged. Original fixture/request/stock/cancel/
foreign ownership checks are not weakened.

## Fresh inert checks

After inspecting existing task508 TypeScript package/version and entry text,
used only TypeScript5.9.3 createSourceFile over base/candidate text; no compiler
program, resolution, transpile or source evaluation. Inline Node checker imported
only filesystem/child_process/assert/path and that existing parser library.
Results, exit0:

- Base and candidate parseDiagnostics: 0 each (syntax only).
- Recursive AST assertion-call comparison: identical, exactly23.
- All13 typeof-import query occurrences target existing .ts paths and are type queries.
- Helper exact-base byte comparison: identical.
- git diff --check exactbase exactcandidate: exit0.

No type/mock diagnostics were produced. CommonJS ownership helper/adapters remain
untyped, so promiseMiddleware/criticalCall/work returns still erase assignability;
Redis overloaded methods are not verified. Jest spy key typing and contextual
parameters improve checkability but cannot establish actual compatibility without
matching generated dependencies and explicit-source strict noEmit diagnostics.
Remaining server/guard/Supertest/result any boundaries are acknowledged by author.

No app/Jest/setup/helper execution, DB/Redis/HTTP/services/runtime/network/provider,
env/secrets/config/scheduler, install/generation/spend/push/merge/deploy. Existing
precollection admission/default Jest bootstrap gap is unchanged and unresolved.
No implementation changes made; only this independent receipt is committed.
Startup shared-main untracked AGENTS.md/docs/team files were preserved. One initial
text search included nonexistent src/services/orders.service.ts (rg reported it);
correct actual src/api/orders/service.ts was then inspected, not guessed as evidence.
