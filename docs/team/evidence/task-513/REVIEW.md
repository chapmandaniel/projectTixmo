# Independent task513 type/mock compatibility audit

Audited SHA: `cf08558f3946b308d27a454d8c867075e6197e39`.
Branch: `tixmo/task-513-type-audit`; new isolated worktree:
`/home/daniel/projects/projectTixmo/worktrees/task-513`.
Only this report is changed. Original author is tixmo-backend; reviewer tixmo-lead.

## Verdict: INCONCLUSIVE - matching generated type prerequisite missing

No TypeScript PASS, no mock-compatibility PASS, no runtime/capacity PASS.
The bounded independent audit is complete with an explicit limitation; implementation499
and parent246 remain OPEN. Source-only approvals505/507 are not type evidence.

Existing libraries suffice in principle: TypeScript5.9.3, @types/jest30.0.0,
ts-jest29.4.11, Node24.21.0. No new solution, framework or runner is needed.
However this new worktree, shared main API, and shared main root have no node_modules.
Existing task390 node_modules resolves to task354; task506/task511 resolve to task235
(only symlink metadata inspected; their work was not reviewed or changed).
Both inspected existing generated Prisma schemas differ from the audited schema:

- Exact audited package-lock and task390/task235 package-lock SHA256:
  `f530d7671524de570d43a6cf7e105cc8161f4c1be6b71a7ffc89025ee8a139da`.
- Exact audited schema SHA256:
  `615ba1c9a3bad9630c3d7103440528e4105418602cdf92e8fa291f81590e006e`.
- Both existing generated schemas SHA256:
  `a8601e89abd910f7464f9848ba061dc68fabf8ec6b4f014d4365004c95dc3b01`.
- Audited schema defines EventSalesControl at917 and relation200; existing task235
  generated client index.d.ts has no EventSalesControl/eventSalesControl matches.
  This is a substantive schema mismatch, not merely formatting.

Per task instruction, missing exact dependencies is a limitation, not installation
or generation authority. No compiler invocation was made using stale dependencies.
Compiler diagnostic count: NOT PRODUCED (not zero). Syntax/parser diagnostic count:
NOT PRODUCED. No syntax/type PASS is inferred from static source inspection.

## Actual type/mock interfaces inspected

`tixmoapi2/tsconfig.json` is plain JSON with no extends/plugins/execution hooks,
strict mode, node resolution and src aliases. It includes src/**/* and explicitly
excludes tests. Therefore ordinary project tsc --noEmit would NOT verify this file.
An eventual authorized setup-free check must explicitly include the qualification
source and retain actual strict options/aliases, with no emit or incremental output.
No app/Jest/setup/env evaluation is necessary for TypeScript analysis.

`tixmoapi2/jest.config.js` uses ts-jest and tests/setup.ts; default testMatch excludes
orders-http-last-ten.local.ts. tests/setup.ts invokes bootstrapTestDatabase via
execSync and globally mocks Redis/rate-limit-redis. It was read as text only,
never evaluated. jest.release-integration.config.js has empty setup arrays but a
fixed unrelated testMatch; it does not establish qualification-source compatibility.
No Jest invocation/collection was made.

`tixmoapi2/tests/qualification/orders-http-last-ten.local.ts` lines32-60 uses untyped
CommonJS require for Redis, catchAsync, auth/waitingRoom, validation and rateLimiter;
spies/Redis/Prisma are explicitly any, middleware loop is any[]. The helper require
at19 is also untyped. Installed @types/jest/index.d.ts:1307 checks mockImplementation
against inferred function args/return, but these any boundaries erase actual product
and helper interfaces. A future plain tsc PASS alone would thus not prove those
mock interfaces. This is a verification limitation, not a reproduced mock failure.

The catchAsync replacement at37-38 has the same source-level return shape as
src/utils/catchAsync.ts: Request/Response/NextFunction handler returning void.
The validate replacement at48-50 returns a tracked Promise around the real async
handler (src/middleware/validate.ts:8 onward). These observations are source matches,
not independently compiled assignability results. No actual TS diagnostic or
concrete incompatible mock signature was reproduced, so no product bug is asserted.

## Smallest next original-author step

Do not install/generate or create a process guard/runner under this task. Provide an
already-existing dependency tree whose generated Prisma client matches this exact
schema, or obtain separately scoped dependency preparation authority. Then have the
original author add type-only module bindings (typeof import or equivalent checked
signatures) to the existing spies/helper boundary where needed and run a direct,
environment-scrubbed existing compiler noEmit over this exact qualification source
with actual compiler options; independent review must inspect actual diagnostics.
Do not run npm build (it generates Prisma), Jest, or setup.ts for this type audit.
No runtime grant follows; the task499 admission symbol remains separately unresolved.

## Commands and actual outcomes

- Startup kanban list --mine/inbox/show513/show499: exit0; initial claim refused
  because moosey accidentally claimed concurrently; no force used. After untouched
  release, normal kanban claim513 exit0. Task499 was never claimed or modified.
- git status --short; git worktree list: inspected before worktree creation, exit0.
- git worktree add -b tixmo/task-513-type-audit <worktree> <auditedSHA>: exit0.
- cat actual package.json/tsconfig/Jest configs/setup/source: exit0 when present.
- ls -ld node_modules tixmoapi2/node_modules <main>/tixmoapi2/node_modules:
  exit2, three absent paths. command -v tsc: exit1, no PATH compiler.
- readlink -f <task390>/tixmoapi2/node_modules: exit0, target task354.
- sha256sum exact and existing lock/schema files: exit0; hashes above.
- diff -u <task390 generated schema> tixmoapi2/prisma/schema.prisma:
  differing contents (diff semantic status1; displayed via head pipeline status0).
- rg -n EventSalesControl|eventSalesControl exact schema and task235 generated
  index.d.ts: exit0, TWO matches, both only in audited schema (lines200,917).
- rg installed TypeScript/Jest/ts-jest package.json version fields: exit0,
  versions above. rg source mock sites and Jest mockImplementation definitions:
  exit0. No modules imported by these text reads.

No tests, compiler or parser executed. No env/secrets read, app/runtime import,
DB/Redis/HTTP/services/network/provider probe, config write, install/generation,
spend, push, merge or deployment. Active integration231/511/512 left untouched.
