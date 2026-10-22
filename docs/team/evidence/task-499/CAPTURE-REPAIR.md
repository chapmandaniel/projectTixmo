# Task499 original middleware capture repair

Exact base: `d4fd52c1637c24d9f1bb003685029e915745bf6e`.
Branch `tixmo/task-499-capture-repair`, new isolated `task-499-capture-repair`.
Read independent lead530 adverse report
`7ef5c4202c8f4bfc2fc90f4aadd6928068cc095e:docs/team/evidence/task-530/REVIEW.md`.

Save authenticate, optionalAuthenticate and waitingRoom originals immediately
before installing each spy; pass the saved reference to promiseMiddleware.
This restores original capture order without changing checked product bindings,
helper bytes, request/fixture ownership, assertion semantics or teardown.
No new framework, product imports, runner or guard added.

Actual checks (exit0):

- `node --check docs/team/evidence/task-499/capture-order-probes.cjs`.
- `node docs/team/evidence/task-499/capture-order-probes.cjs`: three exact
  source pre-capture checks, each paired with isolated fake-JS negative reentry
  and positive saved-original controls; exact source normalization against base
  proves every other qualification byte unchanged; helper byte equality.
  This is NOT an executed Jest or real ownership-helper test.
- Existing inspected TypeScript5.9.3 parser at task508: createSourceFile only,
  base/candidate zero parseDiagnostics; all23 assertion AST texts identical.
  No compiler program, module resolution, transpile or source evaluation.
- `git diff --check` and staged whitespace check before commit.

Compiler/type/mock diagnostics NOT PRODUCED, not zero. Matching generated
types remain absent per task513; no stale-client compiler/install/generation.
CJS adapters and Redis overload compatibility remain unverified. Precollection
process admission/default-Jest-setup safety remains unresolved. No app/Jest/setup/
helper execution, DB/Redis/HTTP/services/runtime/network/provider/env/secrets,
config/scheduler/install/generation/push/merge/deploy/spend. Integration231 untouched.

Fresh independent exact-SHA lead AND QA required, not author approval. Full499
and246 remain INCOMPLETE; this is source/inert repair, no type/runtime/capacity
PASS or runtime grant. Historical CHECKED-BINDINGS.md remains immutable context;
its original middleware ordering was defective as established by lead530.
