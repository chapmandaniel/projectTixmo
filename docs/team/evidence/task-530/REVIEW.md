# Independent lead530 source-only review

Candidate: `d4fd52c1637c24d9f1bb003685029e915745bf6e`.
Exact base: `cf08558f3946b308d27a454d8c867075e6197e39`.
Reviewer: tixmo-lead, independent of author. New isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-530`, branch
`tixmo/task-530-independent-lead`. Only this report changes.

## Verdict: REQUEST CHANGES - source regression

Blocking finding: qualification source lines44-46 changes capture order for
`authenticate`, `optionalAuthenticate`, and `waitingRoom`:

```ts
jest.spyOn(auth, 'authenticate').mockImplementation(promiseMiddleware(auth.authenticate, work))
```

JavaScript evaluates the call receiver before the argument. `jest.spyOn` first
replaces `auth.authenticate` with the spy. The argument then reads that spy,
not the original function. `promiseMiddleware` closes over the spy, and
mockImplementation replaces that same spy's implementation with the wrapper.
On invocation, unchanged ownership.cjs calls `original.apply(this, args)` from
tracked work; original is now the spy using this wrapper, recursively registering
more work instead of executing the real middleware. All three expressions have
this defect. This is a source-level evaluation-order finding, not an executed
Jest reproduction or a compiler diagnostic.

The base loop explicitly saved `const original = module[name]` BEFORE spyOn.
The candidate retains pre-capture for limiter and Redis loops, but loses it for
these three new explicit expressions. Auth/waitingRoom import order itself is
preserved and neither inspected module imports the other; that does not make
function capture equivalent. QA529's statement that original capture is preserved
is contradicted by these expressions, so its approval is insufficient for closure.

Smallest concrete next step: original author saves each actual middleware function
before installing its corresponding spy, then passes the saved original to
promiseMiddleware. Submit a new exact SHA for independent QA and lead review.
No product repair was made here. No runtime permission follows this recommendation.

## Evidence actually inspected

Read actual immutable QA529 receipt
`3500f6019b5853faeb212d77b24d1bbd818cda1e:docs/team/evidence/task-529/REVIEW.md`,
author CHECKED-BINDINGS.md, and task513 report
`f27757b4b8e2a616e8200a890a8f37be12e557ff:docs/team/evidence/task-513/REVIEW.md`.
Read full qualification and ownership.cjs; inspected exact diff and actual
catchAsync, validate, Redis/Prisma, auth, waitingRoom, rateLimiter exports and
orderService/JWT export/import signatures.

Actual catchAsync takes Request/Response/NextFunction -> Promise<unknown> and
returns a void handler; candidate contextual callback retains that source shape.
Actual validate takes AnyZodObject and returns an async three-argument handler;
Parameters<typeof handler> references that actual shape. Redis connect returns
Promise<RedisClientType>, disconnect Promise<void>, Prisma defaults PrismaClient.
All 13 typeof-import occurrences are type queries pointing to existing modules.
Annotations, definite assignment and literal const tuples are erased; no new
executable product imports precede admission. Measurement record values, literal
Redis/limiter key order and reversed restore inventory remain unchanged.

Helper bytes are identical: raw-work tracking/join, permanent uncertainty latch,
criticalCall rejection preservation, preallocated ownership inventory and teardown
were not modified. All 23 assertion call expressions remain exactly identical.
These preservation facts do not override the three defective adapter captures.

## Fresh actual inert checks

After reading existing TypeScript5.9.3 package metadata and library entry text,
an inline Node checker loaded only fs/child_process/assert/path and that existing
parser. It used createSourceFile only, no program, resolution, transpile or source
execution. Exit0: base parseDiagnostics0, candidate parseDiagnostics0, assertion
AST-text comparison identical/count23, all13 typeof-import paths exist, helper
base/candidate bytes identical. `git diff --check exactbase HEAD`: exit0.
The initial diff used an incorrect scripts/qualification path and produced no
output; the subsequent correct tests/qualification diff was read in full.
Startup git state/worktree inventory inspected; shared-main untracked AGENTS.md
and docs/team preserved. Exact530 claimed;499 was not claimed.

Compiler/type/mock diagnostics: NOT PRODUCED, not zero. No compile/type/mock PASS
is claimed from parsing. CJS ownership adapters remain untyped; actual Redis
method overload compatibility remains unverified. Task513 records missing matching
generated Prisma dependencies; no stale-client compiler, dependency search retry,
installation, generation or fake declarations attempted. Ordinary tsconfig excludes
this qualification. Existing precollection admission/default Jest setup gap remains
unresolved. Full499/246 remain INCOMPLETE; no HTTP/runtime/capacity evidence.

No app/Jest/setup/helper execution, DB/Redis/HTTP/services/runtime/network/provider,
env/secrets, install/generation/config/scheduler, push/merge/deploy/spend. No changes
to integration231, product source or tests. This closes only independent review530
with an adverse verdict; author repair and exact successor review remain required.
