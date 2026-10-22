# Task499 bounded source bindings checkpoint

Base: `cf08558f3946b308d27a454d8c867075e6197e39`.
Branch: `tixmo/task-499-checked-bindings`; isolated worktree `task-499-checked-bindings`.
Independent prerequisite report read: task513 exact
`f27757b4b8e2a616e8200a890a8f37be12e557ff:docs/team/evidence/task-513/REVIEW.md`.

## Actual changes

Only qualification TypeScript and this evidence document change. Redis/Prisma,
catchAsync, auth, waitingRoom, validation, limiter, orderService and JWT bindings
now reference actual product types with erased `typeof import` queries. The
heterogeneous any middleware loop becomes explicit module-keyed spies; Redis
and limiter method names are literal tuples. catchAsync arguments are contextual
from the actual module; validation args derive from Parameters<typeof handler>.
The restore-only spy inventory and measurement records no longer use any[].
No new runtime product imports, guard, runner or dependency solution is added.
Existing maintained TypeScript/Jest suffice; no framework is warranted.

## Helper source and remaining boundaries

Read actual `tests/qualification/task499/ownership.cjs` in full: run tracks a
Promise.resolve().then(operation); critical joins then returns its result;
promiseMiddleware forwards original.apply(this,args), requires a thenable, and
permanently preserves unknown lifetimes; criticalCall awaits original and
preserves raw rejection before removal. Helper source and semantics unchanged.
The CJS helper require remains untyped, so helper adapters still erase return
compatibility (including overloaded Redis methods). This checkpoint does NOT
claim those adapters are checked. Server/process guard/Supertest and result
assertion any boundaries also remain. No fabricated module/Prisma declarations,
helper signature declarations, type assertions or suppressed diagnostics added.

## Actual checks and limits

- Existing TypeScript5.9.3 at task508 node_modules, createSourceFile ONLY over
  qualification text: zero parseDiagnostics, exit0. No source evaluation or
  compiler program/import resolution. Package scripts and helper read as text
  before this check; npm/Jest/setup were not invoked.
- Inert AST comparison against exact base: all assertion-call expressions
  unchanged (count in command output), exit0.
- git diff --exit-code exactbase -- ownership.cjs: exit0, unchanged helper.
- git diff --check: exit0; staged whitespace checked before commit.

Compiler/type/mock diagnostics: NOT PRODUCED, not zero. No noEmit compilation:
exact513 records schema-mismatched generated clients and no matching dependency
prerequisite supplied here; no stale-client compiler, dependency search retry,
install or generation attempted. Default tsconfig excludes tests. A later exact
setup-free explicit-source check still needs matching generated dependencies
and inspection of actual diagnostics, including helper/overloaded mock boundaries.

Precollection process admission remains unresolved; default Jest setup can run
DB bootstrap before body guard. No application/Jest/setup imports or evaluation,
DB/Redis/HTTP/services/runtime/network/provider/env/secrets/config/scheduler,
install/generation/push/merge/deploy/spend. Integration231 untouched.
Fresh independent QA and lead of this successor required. Full499/246 remain
OPEN; this is source-binding progress, NOT type/mock/runtime/capacity PASS.
