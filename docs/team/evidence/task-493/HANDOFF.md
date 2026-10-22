# Task 493 - source-only SQL acceptance preparation

Base: `6ab827bff6fdf67283b93f16612106f2217d4dc0`.
Branch: `tixmo/task-493-sales-pause-sql-source`; isolated worktree `task-493`.
Scope: additive synthetic Jest/Prisma test source only; no product files or
existing assertions changed. Actual BB248 decisions and backend487 read.

## Existing solutions reused

- `tests/integration/order-cancel-stale-observation.test.ts`: synthetic fixture,
  bounded gates, owned promises drained in finally and real SQL transaction seam.
- `tests/integration/order-refund-current-path.test.ts`: `pg_blocking_pids` proves
  an actual waiting backend, rather than timing-based assertions or mocked locks.
- Existing Jest setup and Prisma client retained; no harness framework/dependency.
  Inspected package scripts, Jest config, setup, Prisma config and service imports.
  Setup calls `bootstrapTestDatabase`, so even Jest collection was NOT executed.

## Added expectations - all SQL/runtime NOT RUN

- Both PUBLISHED and ON_SALE reject while paused; explicit resume preserves
  lifecycle, event window and stock, and permits otherwise eligible creation.
- Resume cannot bypass SOLD_OUT, elapsed sales window or exhausted inventory.
- Exact UUID replay returns original historical evidence even after resume,
  without re-pausing; altered target/reason conflict; distinct no-op records
  before=true/after=true and changed=false without fabricating a transition.
- Inject an invalid event FK at the real audit INSERT to expect actual Postgres
  failure and unchanged event/stock/orders/audit. No Prisma query result mocked.
  Since implementation inserts audit before updating flag, this specifically
  proves failure atomicity, not rollback of a flag write that preceded audit.
- Both pause-first and create-first hold the actual event lock at the post-lock
  read seam. Backend-PID blocking observation precedes gate release. Pause-first
  denies the waiter; create-first preserves the pre-pause order; subsequent
  creation denied. Bounded polling and finally drain owned operations.
- Generic writer receives a pre-pause stale payload (including pause=false),
  then edits after committed pause; flag/audit/stock/orders remain preserved.
  This is stale payload coverage, not a separate overlapped generic-writer race.

## Actual inert checks

- `node --experimental-vm-modules docs/team/evidence/task-493/check-source.cjs`:
  PASS. Node24.21.0 strips TypeScript, parses a VM module but NEVER links or
  evaluates it. Ten static coverage markers pass. Not typechecking or behavior.
- `git diff --cached --check`: PASS before commit.
- Initial `node --experimental-strip-types --check <test.ts>` failed to parse
  TypeScript definite assignment (`!`); it did not execute tests/imports. Replaced
  with explicit stripTypeScriptTypes + unlinked SourceTextModule above.
- Compiler locations checked were absent; no compiler install or generation.

## Required handoff / limits

Independent lead AND QA review of exact committed SHA mandatory. Tests remain
NOT RUN; no SQL PASS, real rollback/concurrency assurance, generated-client/type
compatibility, mounted route/auth/tenant, paid-access/scanner/recovery or waiting
room runtime qualification is claimed. Source suite is focused service-level
acceptance, not a replacement for those broader mandatory gates.

A later separately scoped sole-disposable-DB runtime grant must first verify
target safety and prerequisites, then generate/apply reviewed schema using
existing guards and execute the focused suite. Nothing here grants that action.
No app imports/evaluation, Jest, services, DB connection/schema generation or
migration, network, installs, environment/secrets reads, config/scheduler,
provider/production/spend, push/merge/deploy occurred. Full248/243/launch OPEN.

## R2 source repair after independent lead494

Read immutable review `3d7b5cfbc72c2cfb2ac9cb10d960fe041b5a51ff`,
`docs/team/evidence/task-494/REVIEW.md` before edits. Both P2 findings accepted.
Original behavioral assertions retained; no product or prior test edits.

- Preallocate and register exact org/user/event/type UUIDs before first INSERT,
  so partial or ambiguous setup is still owned. Whole test-body promises are
  tracked, including fixture construction, rather than only checkout requests.
- afterEach first bounded-drains owned bodies and restores transaction spies in
  finally. Only settled safe runs enter an FK-ordered cleanup transaction scoped
  to those UUIDs: audit, tickets, orders, ticketType, event, user, organization.
  Test-owned audit deletion is explicit disposable-fixture teardown, NOT a
  product retention exception/API or removal of the RESTRICT relation.
- Reused existing `payment-admission-aba` / `payment-competing-claims` nested
  bounded-drain/finally-spy-restoration pattern. Concurrent request drain is now
  bounded; fallback afterEach also restores spies even after a Jest timeout.
- A drain or cleanup timeout/failure latches failClosed, reports exact owned IDs,
  prevents subsequent tests reaching fixtures/SQL, skips further teardown and
  skips disconnect against potentially active SQL. No claim that racing a timer
  cancels a promise/query. Failed cleanup may itself remain active or later commit;
  target must NOT be reused. No safe suite-owned SQL cancellation/reap primitive
  was found: later authorized runtime owner must externally reap process and
  exclusively owned disposable DB, retaining the logged fixture evidence first.
- Concurrency test budget 20s; cleanup hook budget12s; internal gate/drain5s,
  SQL-blocking poll3s and cleanup transaction maxWait2s/timeout4s. These are
  failure detection budgets, not guarantees that transport cancellation works.

R2 actual checks: inert Node strip/unlinked VM parse plus17 static markers PASS;
whitespace PASS. SQL/Jest/typecheck/runtime still NOT RUN. Independent lead+QA
must review the new exact SHA; full248/243/launch OPEN.

## R3 observer lifetime repair (source-only)

Base: `9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b`.
Branch: `tixmo/task-493-observer-lifetime`.
Worktree: `/home/daniel/projects/projectTixmo/worktrees/task-493-observer-lifetime`.
Read complete immutable reports before edits: lead496
`689ed441741cc58f310b5daca3ca61cd142c66d9` and QA495
`9f4b68307bec8198ea2730021072290f298735bd`. Both P2 findings accepted.

Minimal repair wraps only the SQL polling observer in `observe`: any bounded
observer rejection conservatively calls existing `preserve` before concurrency
finally drains requests. This permanently latches failClosed, retains UUIDs,
skips cleanup/disconnect and rejects subsequent test admission, even when the
body and requests settle while the underlying query remains live. Any observer
error (not just timer expiry) preserves evidence conservatively. Existing gate,
request-drain, UUID/FK cleanup and spy restoration remain unchanged. This is
failure containment, NOT cancellation or proof that the observer stops. A late
observer resolution does not clear the latch. External owned-process/disposable
target reaping remains mandatory before reuse; no runtime grant is supplied.

Existing checker extended with an inert extracted-helper regression. Whole test
module is stripped and parsed unlinked/unevaluated. Only helper/hook source before
`fixture` is evaluated in a VM with fake hook registrars and fake Prisma counters;
no app import, Jest or SQL. A manually fired fake timer races a deliberately
unresolved observer. Actual `owned` body then settles/leaves live, but observer
remains pending. Actual afterEach/afterAll/beforeEach reject, cleanup/disconnect
counters stay zero, and fallback spy restoration runs. Resolving the observer
later still leaves subsequent admission blocked. This distinguishes detached
observer lifetime from its wrapper completion, not merely a static marker.

Actual commands/results after inspecting the checker:

- `node --experimental-vm-modules docs/team/evidence/task-493/check-source.cjs`:
  exit0, unlinked TS parse +17 static markers and extracted deferred-observer
  regression PASS; experimental warnings only. Initial new probe assertion
  incorrectly expected stripped generic function syntax without inserted spaces;
  failed inertly, corrected whitespace-tolerant function-presence check, then
  reran successfully. Final strengthened owned-body probe also passes.
- Inline Python standard-library git-show/source assertion comparison against
  original `2a3de901c2297381c9ef5cb816405b0ec981cf9e`: exit0, all41 original
  assertion-start lines identical/in order. This is preservation, not execution.
- `git diff --check`: exit0. Staged whitespace check required before commit.

Only focused test source, existing checker and this handoff changed. SQL/Jest/
typecheck/generated-client/runtime compatibility NOT RUN. No application
imports/evaluation, DB/services, generation/migration, network/install/env/secrets,
config/scheduler/cloud/provider/production/spend/push/merge/deploy. Fresh independent
QA AND lead review must target the new exact commit; prior rejection/approval
cannot qualify it. Task493 remains REVIEW; full248/243/launch remain OPEN.
