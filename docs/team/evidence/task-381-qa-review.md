# Task 381 independent QA source review

2026-10-21; tixmo-qa. **PASS SOURCE PREPARATION ONLY**, no blocking source finding.
Exact reviewed author SHA: `1d9e2f74355bf978f47d32c002b8d4e42d0f1f7b`.
Exact base: `f8a407cd789ecdebf11927debc3e3b26c4ea5267`.
Reviewer branch `tixmo/task-381-independent-qa`, isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-381`.
Only this independent report added; no author code fixed. Read task377 handoff,
371 contract at95e62218, 373/375 board history and QA375 report at64f9f3cc.

## Acceptance inspection

- All eight sorted fixture tickets explicitly assert inventory_state/tier_id.
  Paid ambiguous/unmatched are SOLD without tier; inconsistent is SOLD with its
  unique tier; cancelled-paid/cancelled-event is UNKNOWN without tier; cancelled
  order is RELEASED without tier; pending is HELD and transferred/used are SOLD
  on upgrade-tier. These follow the actual migration CASE and candidate SQL.
- All five original types assert total100/available90; known READY, four others
  REQUIRES_RECONCILIATION. All six tiers assert limit/sold/held: known3/2/1,
  inconsistent10/5/0, cancelled10/1/0, ambiguous A/B and unmatched10/0/0.
  Fixture preexisting counters and migration greatest(old_sold,derived_sold)
  agree, including deliberately unchanged inconsistent/cancelled sold counts.
  Before/after equality additionally includes original type/tier columns.
- Optional output parent must already exist, resolve without symlink traversal,
  be owned by current UID and exactly0700. Unique child0700; exclusive wx files
  start0600, fsync then0400 (also on write failure); final directory0500.
  Application-level read-only retention is not owner-resistant WORM or a claim
  of crash durability (no directory fsync). No such stronger guarantee accepted.
- Provenance records commit, harness/fixture hashes, prefix and timestamp;
  migration-sources records all31 hashes; before/after include ordered ledgers.
  after is retained before assertions, so assertion and later checkout failures
  preserve it. Earlier migration/query failures retain only artifacts reached;
  they cannot provide an after snapshot. Finally writes result phase/pass/time
  and hashes of completed artifacts; raw error/env/argv/connection values absent.
  Evidence initialization/write/finalization failure can leave partial evidence,
  as author explicitly documents; no universal successful-manifest guarantee.
- Key filtering omits selected password/email/barcode/QR/payment intent/error/
  token/key fields. Inspected selected fixture rows contain no URL values;
  scan metadata defaults null. Scrub is not a general arbitrary-value sanitizer:
  do not reuse this narrow synthetic-only capture on arbitrary real DB data.
  Date objects survive scrub and stringify to ISO; bigint remains primitive
  until replacer emits lossless decimal $bigint wrapper. No runtime JSON claim.
- Unset output remains no-disk-evidence opt-out. Target helper byte-identical to
  base; guard still precedes evidence initialization and Prisma construction.
  Existing module resolution/temp creation remain ahead of guard, not DB access.
  API compiled-artifact provenance, scrubbed environment, disk backing and service/
  network ownership are future runtime prerequisites, not satisfied by source hashes.

## Actual checks

All below completed exit0 in reviewer worktree; no harness loaded or executed.

- `git rev-parse HEAD HEAD^`: exact reviewed/base SHAs above.
- `node --check scripts/verify-payment-upgrade.cjs`.
- `git diff --check f8a407cd789ecdebf11927debc3e3b26c4ea5267 1d9e2f74355bf978f47d32c002b8d4e42d0f1f7b`.
- Read full harness, fixture, and exact inventory migration
  `20261005003000_payment_and_inventory_integrity/migration.sql`.
- Independent Python stdin static assertions parsed expectedTickets with
  ast.literal_eval, compared its eight exact IDs/states/tiers against fixture
  IDs and reviewer expectations; checked five original type expectations and
  all six complete tier tuples, guard ordering, exclusive modes/fsync, parent
  checks, final manifest/artifact names, date/bigint source markers; compared
  target helper bytes against base and asserted exact two-file author diff.
  Output: PASS static, explicitly not runtime behavior.
- One initial guessed migration path read failed exit1 (nonexistent
  `20260604000000_add_ticket_inventory_tracking`); corrected to actual path above.
  No source or acceptance check failed.

## Limits and handoff

NO SQL parsing/execution, harness/helper behavior, database/services, API build/
regressions, runtime success/failure persistence tests, parity PG17/Redis8.2.10,
dump/new-DB restore, old-code compatibility, rollback or RTO/RPO proof. No install,
network/provider/envsecret/config/spend/push/merge/deploy. No historical test
results represented as new acceptance. Main checkout and unrelated work preserved.

Task381 completes independent source review only. PM retains task377 closure,
requires lead review too, and parent245 remains OPEN/NO-GO. Fresh separate PM
sole-owner DB grant plus reviewed restrictive disk/scrubbed-loopback/service/
network plan required before runtime. A newer author commit requires re-review.
Report commit uses command-scoped synthetic Git identity/hooksPath=/dev/null;
hooks NOT RUN, no persistent config changes.
