# Task 373 - bounded source/harness preparation

Author: tixmo-release, 2026-10-21. Base: `80c6710b89d147588e1514aa99a4e55c5630d38a`.
Branch: `tixmo/task-373-upgrade-harness`; worktree `/home/daniel/projects/projectTixmo/worktrees/task-373`.
Contract read using `git show 95e62218cabe1a9b315459a67f7144682dc4a47d:docs/team/evidence/task-371-upgrade-preflight.md`.

Reused the existing Prisma upgrade harness. Added its missing tracked SQL fixture,
valid for the 26-migration prefix ending `20260602010000_add_payment_webhook_events`.
Fixture uses explicit pre-account columns and inert synthetic non-login/non-provider
markers. Existing bootstrap email is deliberately present only as a synthetic migration
trigger. The remaining five migrations are staged together; no released migration changed.

Prepared assertions cover complete migration names/checksums, original order monetary
and identity columns, ticket identity/ownership/check-in/transfer history, scan logs,
user identity/password markers, historical webhook fields and zero BIGINT generation.
Separate expected-change assertions cover bootstrap/deleted disabling, session version,
unscoped administrator non-promotion, transfer credential/cache/status/sync delta, USED
credential retention, known SOLD/HELD counters, historical receipt/currency/payment
attempt amount, and ambiguous/unmatched/inconsistent/cancelled reconciliation disposition.
Existing checkout calls are retained and expanded for unmatched/inconsistent fail-closed
cases; those calls have NOT executed.

## Actual checks

- `node --check scripts/verify-payment-upgrade.cjs`: exit 0.
- `git diff --check`: exit 0 (before adding this evidence; repeated before commit).
- Source-only Node assertions: exit 0, output `PASS: 26-prefix/31-total/5-tail source set; required synthetic cases; no post-prefix fixture columns`.
  The command enumerated tracked-layout migration SQL directories, asserted total31,
  prefix index25 and tail5, checked fixture scenario markers and excluded newly added
  session/inventory/generation columns. This checks source shape, NOT SQL validity.

## Explicit limitations / remaining acceptance

NOT RUN: fixture SQL parsing/execution, Prisma migration deploy, populated upgrade,
API auth/session/stale JWT/invitation/QR scanner regression, checkout runtime,
dump/restore, rollback compatibility or Redis behavior. No SQL/runtime pass is claimed.
Existing cache PG18.6/Redis8.0.5 does NOT establish required PG17/Redis8.2.10 parity;
no tools installed/downloaded and no services started. No environment/secret reads,
provider/target/network/cloud/config changes, push/merge/deploy or new financial exposure.

This is a source-only checkpoint, not W08 completion. Before runtime: independent lead
AND QA review exact commit; fresh PM sole-DB-owner grant; owned restrictive disk TMPDIR,
scrubbed loopback environment, service ownership and network guard plan; built API and
already available dependencies. Preserve pre-upgrade rows/dump outside ephemeral harness
cleanup in the separately authorized execution slice. This harness does not yet persist
before/after artifacts or implement the separate-new-database restore/old-code rollback
exercise: those remain acceptance work, not implied by in-memory snapshots. Historical
276/362 results were not rerun or reused as new passes. Parent245/launch remain NO-GO.
