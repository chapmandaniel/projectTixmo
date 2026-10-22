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
