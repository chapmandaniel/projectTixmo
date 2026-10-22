# Task 540: pre-collection admission cannot yet be safely furnished

## Disposition

SOURCE-ONLY blocker, not an implemented admission adapter or runtime grant.
Exact base `f9a8c2121dc869653ac1738edeb1aae914ae66d2`, new isolated worktree
`task-540`, branch `tixmo/task-540-precollection`. Default Jest configuration,
all last-ten assertions and the repaired ownership helper are unchanged.

Accepted interoperability report inspected at
`cde214229938cae06fc5acc324a12efa64f2e520:docs/team/evidence/task-533/INTEROPERABILITY.md`.
Existing Jest/ts-jest, Supertest, verification-safety and owned-verifier patterns
are adequate libraries; another framework, generic runner or copied scaffold
would not solve the missing authority. No dependency search requiring network
was performed.

## Actual boundary and missing prerequisites

1. `tixmoapi2/jest.config.js` installs `tests/setup.ts` via setupFilesAfterEnv.
   Setup calls `bootstrapTestDatabase` before test-body admission and installs
   Redis/store mocks. The `.local.ts` is deliberately excluded by testMatch.
   Its `tixmo.task499.admitDisposable` guard runs inside the test callback,
   not before setup or collection. No implementation of that symbol exists in
   the candidate scripts/qualification/config paths inspected. Renaming the
   source or selecting it under the default configuration is NOT safe.
2. `scripts/verification-safety.cjs` exports URL policy, redaction and schema
   bootstrap only. Its pure validator accepts an explicit loopback
   `tixmo_disposable_*` database and Redis /1..15; it cannot prove those services
   exist, are solely owned, are disposable, or deny providers/network. Calling
   it does not mint a task499 admission capability.
3. `jest.orders-aggregate.config.js` and `jest.waiting-room.config.cjs` show
   the maintained opt-in pattern: explicit testMatch and empty setup arrays.
   This can avoid default bootstrap/mocks but supplies none of the ownership,
   immutable source/dependency, listener, network or teardown guarantees.
   An adapter that merely combines these settings with the URL validator
   would falsely assert the required contract.
4. `scripts/verify-api.mjs` validates URLs then applies schema and starts the
   standard API suite. `scripts/verify-api-owned.mjs` can provision Docker
   services and scrub selected provider variables, but also accepts externally
   supplied targets and runs build/migrate/default Jest. It supplies neither
   task499 listener/admission symbols nor enforced network/provider denial,
   immutable source/dependencies, or whole-process uncertain-lifetime fencing.
   Neither was executed, imported or adapted.
5. Read latest board448/426 and exact
   `843f0245eed7567350185190f85a6aefe60ecbef:docs/team/evidence/task-426/RUNNER-CHECKPOINT.md`.
   Reviewed stubborn DIRECT-child cleanup is explicitly not escaped-tree
   containment/adoption/reaping, immutable dependency/source TOCTOU closure,
   observer/service identity or admitted integration. Its terminal refusal is
   intentional. Reusing that incomplete boundary as safe499 admission would
   transfer known unresolved prerequisites, not fix them. No duplicate runner,
   task432 scaffold or native namespace probes were added.

## Concrete next source contract, before any future collection

An established, independently reviewed owner boundary must furnish ALL of:

- Pre-Jest/pre-setup immutable binding to the exact selected qualification
  source, ownership helper, candidate/schema and matching installed/generated
  dependencies; no caller-CWD assertion or mutable marker as authority.
- Sole disposable PostgreSQL and Redis identities (same explicit URL policy),
  ownership retained until all admitted processes/work are stopped and reaped;
  URL shape or open port is not service identity.
- Exact owned listener registration/revocation, deny-all except the bound
  DB/Redis/listener network edges and provider denial before product evaluation.
- Lifecycle authority covering descendants/escaped or adopted work and
  observers, fail-closed identity/uncertainty, process termination and verified
  reaping before service teardown. Deadline expiry is not cancellation.
- Only after that boundary exists, a minimal opt-in existing-Jest config with
  default setup excluded, exact `.local.ts` selection and admission before
  collection; preserve all task499 mocks/assertions/ownership repairs. Capacity
  must be explicitly pinned >=100, not inferred from defaults, and matching
  generated dependencies/focused qualification diagnostics remain separate.

Absent any prerequisite, admission must remain refused; no placeholder callback,
environment flag, symbol injection or copied incomplete runner is acceptable.
This maps the same unresolved platform/containment boundary already tracked by
448; it does not request another platform implementation or authority expansion.

## Checks and handoff limits

Actual read-only source/config/board inspection and pure synthetic-object static
checks only. The static check proves the current validator rejects absent inputs
but accepts synthetic URL-shaped targets without any owner authority; confirms
setup bootstrap precedes the mock section, opt-in configs exclude setup, and
last-ten source retains the in-body admission and listener guards. No application
or Jest evaluation/collection, compiler, services, DB/Redis/HTTP, network,
installation, generation, environment/secrets inspection, system configuration,
provider calls, CI, PR, push, merge, deployment or spend. No namespace probes.
Whitespace checked before commit. One documentation addition only.

Independent exact-SHA QA AND lead required before PM disposition. Task540 is a
precise blocker checkpoint, not implementation closure. 499/246 remain incomplete;
no HTTP/capacity/type/mock/full-market acceptance. Integration231 remains owned
by moosey and untouched. Initial guessed `.cjs` aggregate-config and task448
checkpoint paths were absent; resolved to actual `.js` and task426 paths above.
