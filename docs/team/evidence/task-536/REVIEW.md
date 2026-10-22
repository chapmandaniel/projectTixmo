# Independent QA536: current-candidate source port

## APPROVE - exact source port only

Reviewed `f9a8c2121dc869653ac1738edeb1aae914ae66d2`, exact parent
`a5da21936f4e0c730cab448610d9ecc75d2ef398`, original source
`09dfb648a87eb4f006555f88a93147bf5c34d523`.
Reviewer tixmo-qa; NEW isolated worktree task-536-independent-source-qa,
branch `tixmo/task-536-independent-source-qa`. No blocking source-port finding.

## Actual independent checks

Read role/repository/team instructions and kanban skill; inspected mine/inbox
and tasks536/535/533/534/499, claimed ONLY536. Read immutable lead535 receipt
`b0b242c55ce50c3b7f8004c75546fb8b643e0670`, actual533 interoperability report
`cde214229938cae06fc5acc324a12efa64f2e520`, QA534 receipt
`63e6b495a94036f29416d9b624ff02ea51c993ec`, and port provenance.
Shared main existing untracked AGENTS.md/docs/team preserved.

- `git rev-parse HEAD HEAD^` matched the exact reviewed SHA and parent above.
  `git diff --name-status HEAD^ HEAD` showed exactly THREE additions: port
  provenance `docs/team/evidence/task-499/CURRENT-CANDIDATE-PORT.md` plus both
  qualification files below; no product merge, runner, admission or probe added.
- Independent Python standard-library `git show <original>:<path>` versus
  worktree bytes equality assertions passed for BOTH files:
  `tixmoapi2/tests/qualification/orders-http-last-ten.local.ts`, 12544 bytes,
  SHA256 `7513318a5daf45928d086cd432356697e895db133c9d985ce505a8d9b1893af8`;
  `tixmoapi2/tests/qualification/task499/ownership.cjs`, 4500 bytes,
  SHA256 `f0887580116adba4bf5692ea09c38bbbc3a1f012ad7fc9056433044c56d792c4`.
  Both match provenance. Independent literal `expect(` count equals23; exact
  byteidentity preserves every full assertion, not merely the count. No AST run.
- Read qualification and helper as text. Qualification:20 relative helper
  require resolves to the existing qualification/task499/ownership.cjs, NOT
  docs/evidence. :46-51 captures three originals BEFORE spies; validation,
  Redis and limiter original bindings remain at :53-66. :103-150 preserves
  barrier/client measurements, ten201/ninety exact400, unique PENDING/HELD
  orders/tickets, stock0/10/0 then cancellation10/0/0 and foreign snapshots.
  These are source assertions, NOT passing runtime observations.
- Qualification:153-168 keeps close/raw-work drainage before disconnect and
  spy restoration; helper:14-58 keeps permanent uncertainty, mutable raw-work
  join and teardown sequencing; :63-74 preserves the missing/throwing promise
  contract latch, :80-94 preallocated IDs and detached critical rejection latch.
  All lifetime/ownership source bytes unchanged; no repeated capture probes or
  fresh runtime-lifetime proof. Timers are not cancellation evidence.
- Independently diffed5526991b45eb8cf93eeda23205f8341b5637ae90 to reviewed HEAD:
  app, orders routes, auth, rateLimiter and Prisma schema have no differences;
  orders service changes conditional inventory update to update under existing
  locks and changes confirmation/cancellation; API lockfile changes too.
  Therefore provenance correctly disclaims inherited compatibility/financial
  runtime parity. The global-versus-checkout admission difference concerns the
  earlier HTTP100 lineage, not a newly introduced499 app regression.
- Read Jest config, setup and tsconfig: `.local.ts` is not default-collected;
  setupFilesAfterEnv invokes schema bootstrap and installs mocks before body;
  ordinary production compilation excludes tests. `rg -n admitDisposable
  tixmoapi2 scripts` finds only the in-body symbol read at qualification:12,
  no implementation. In-body guard does not establish safe precollection.
  Matching generated dependencies and real CJS/Redis overload compatibility
  remain unverified, not inferred from byteidentity or prior reviews.
- Python equality/count/path checks exited0; exact source diff whitespace
  `git diff --check HEAD^ HEAD` exited0. Staged report whitespace checked before
  commit. Git/Python text inspection ONLY, no source evaluation.

## Limits and disposition

Compiler/type/mock diagnostics NOT PRODUCED. No app/helper/probe/Jest/setup,
compiler/typecheck, runtime, DB/Redis/HTTP/services, network, installs/generation,
env/secrets/config/scheduler, push/merge/deploy or CI actions. Documentation
commit uses command-local identity and hooks bypass, no config write.

APPROVE is ONLY for this exact two-file source port and accurate provenance;
not admission/type/mock/runtime/capacity/full-market/launch approval. Synthetic
HTTP actors are not browser sessions or100 parallel DB operations; PENDING holds
are not paid sales. Precollection admission, matching generated dependencies,
actual focused diagnostics and separately granted owned-runtime execution remain
open. Full499/246 INCOMPLETE; only review536 closes. Integration231 ownership
and recovery untouched. No source repairs or new executable command supplied.
