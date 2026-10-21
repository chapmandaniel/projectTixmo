# Task 374 independent lead source review

Verdict: **PASS SOURCE PREP**, 2026-10-21, reviewer `tixmo-lead`.
Reviewed exact author SHA `f8a407cd789ecdebf11927debc3e3b26c4ea5267`,
parent `80c6710b89d147588e1514aa99a4e55c5630d38a`, against source contract
`95e62218cabe1a9b315459a67f7144682dc4a47d:docs/team/evidence/task-371-upgrade-preflight.md`.
Independent branch `tixmo/task-374-review`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-374`.
No product fixes or released migration changes; no blocking source-preparation findings.

## Source findings

- Existing Prisma harness reused; exact sorted 26-prefix ends at webhook events,
  before account security; all five remaining migrations staged, full31 ledger
  names and SHA256 source checksums asserted. Generation migration is BIGINT
  NOT NULL DEFAULT 0; three historical webhook states compare unchanged legacy
  fields and assert JavaScript bigint zero after upgrade.
- Explicit fixture columns inspected against init plus prefix ALTERs, tier,
  scanner and webhook DDL. Event venue/category/timezone are nullable by prefix;
  required columns/defaults, enum literals and referenced synthetic IDs align.
  No post-prefix fields inserted. Synthetic credentials/provider markers are
  inert; bootstrap email is a deliberate migration trigger, not an outbound action.
- Snapshots compare ordered original user identities/password markers, orders'
  IDs/monetary/payment/timestamp fields, ticket ownership/check-in/transfer history,
  scan rows and webhook history. Expected security changes are separately checked:
  disabled bootstrap/deleted identities, session bump, deleted CUSTOMER/unscoped,
  no implicit platform grant, normal user unchanged.
- Transfer barcode rotation/cache clear/status normalization/recipient/tier and
  updated_at delta asserted; USED barcode/status retained, check-in and scans
  conserved. These are SQL/Prisma assertions, not proof of sender QR rejection.
- Known tier has two SOLD and one HELD ticket, limit3; preserved sold2/held1 and
  READY are asserted. Ambiguous overlapping price candidates, unmatched price,
  inconsistent preexisting sold5 versus one allocation, and cancelled paid event
  all assert reconciliation disposition. Checkout rejection calls match current
  source gate ordering for known exhaustion and ambiguous/unmatched/inconsistent
  types, before successful order/notification paths. Historical receipt/currency
  and payment-attempt amount1600 are asserted.
- Existing target guard runs before Prisma connection/migration: explicit test
  opt-in, matching loopback tixmo_test URL; empty public schema required. No reset
  or source overwrite added. Temporary staging is removed. Guard is not service
  ownership, environment scrubbing, network isolation or runtime authorization.

## Actual checks (all exit 0)

- `node --check scripts/verify-payment-upgrade.cjs`.
- `git diff --check 80c6710b89d147588e1514aa99a4e55c5630d38a f8a407cd789ecdebf11927debc3e3b26c4ea5267`.
- Independent inline Node source assertions: 31 SQL migrations, prefix index25,
  tail5, final BIGINT default. Pure target-guard tests: accepted synthetic loopback;
  rejected production NODE_ENV, absent opt-in, remote host, non-test DB name,
  mismatched DATABASE_URL. No DB connection or harness execution.
- Exact parent/SHA and changed-file inspection: harness, fixture and author evidence
  only; released migrations unchanged. One exploratory read used nonexistent
  `scripts/test-target-env.cjs` (exit1); corrected to actual `scripts/test-target.cjs`.

## Limits and required handoff

No fixture SQL parser/deploy/runtime pass. No services, DB grant, API build/runtime,
provider, .env/secrets, network, downloads/install, configuration, spend, push,
merge or deployment. PG17 / Redis8.2.10 parity NOT established.
Persistent immutable snapshots/dump, separate NEW empty database restore, revocation
and QR disposition, post-backup write reconciliation, old-code/new-schema rollback
compatibility and measured recovery remain future acceptance, not delivered by
in-memory snapshots. Auth/session/stale invitations, sender QR rejection and recipient
scanner behavior require API execution. Harness success output must not substitute
for these omitted checks. Fresh PM soleowner/runtime-safety grant is required before
execution; independent QA exact-SHA review remains required before PM closes373.
Task374 completes this bounded source review only; parent245/W08/launch remain NO-GO.
