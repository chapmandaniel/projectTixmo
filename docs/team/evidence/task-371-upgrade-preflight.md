# Task 371: LOCAL W08 upgrade execution preflight

## Receipt and boundaries

2026-10-21; author tixmo-release; task 371, parent 245. Product candidate
`80c6710b89d147588e1514aa99a4e55c5630d38a` (reviewed candidate supplied by PM).
Branch `tixmo/task-371-upgrade-preflight`; isolated checkout
`/home/daniel/projects/projectTixmo/worktrees/task-371`. Only this document is
owned. This is preparation, not W08 completion, product acceptance or target
qualification. Existing full API 725 PASS is historical accepted evidence,
NOT rerun here. ZERO new financial exposure. No database/service execution,
installs, downloads, network, target/provider/email, environment-file/credential
reads, configuration/scheduler changes, push, merge or deploy.

## Actual static/tool results

Inspected candidate source, task 245/243/276 board evidence, existing migration
and recovery harnesses. `git rev-parse HEAD` returned the exact candidate above.
There are **31** migration SQL files. Existing solution is reused rather than
inventing another migration framework: [populated upgrade harness](../../../scripts/verify-payment-upgrade.cjs),
[disposable target guard](../../../scripts/test-target.cjs),
[backup and rollback runbook](../../DB_BACKUP_AND_MIGRATION_ROLLBACK.md).

Known existing extracted cache:
`/home/daniel/projects/projectTixmo/worktrees/task-57/.local-runtime-57/root`.
Executed only `--version`, with `LD_LIBRARY_PATH=<cache>/usr/lib/x86_64-linux-gnu`:

- `<cache>/usr/lib/postgresql/18/bin/postgres --version`: PostgreSQL **18.6**.
- Same directory `pg_dump --version` and `pg_restore --version`: **18.6** each.
- `<cache>/usr/bin/redis-server --version`: Redis **8.0.5**.
- Cache PostgreSQL directory listing contains only `18`; package archive listing
  contains PostgreSQL server/client 18.6 and Redis 8.0.5 packages.
- `command -v postgres pg_dump pg_restore redis-server initdb` found none on
  inherited PATH. This is a bounded known-cache inventory, not an exhaustive
  whole-server search. Required **Postgres 17 / Redis 8.2.10** are NOT evidenced
  available. No install/download is authorized by this task. Version-only
  invocations did not start services.

Historical task 276 at `cb95d021dd5f08d2fa9b95fc1fee17987f8ee564`
(not an ancestor evidence directory in this candidate) already proved tiny
synthetic separate-new-DB restore on PG18.6/Redis8.0.5. Independent 277 source
and 278 runtime review accepted its bounded result; no rerun. Source/restored/
source-after full-row fingerprints matched; preserved inventory, USED ticket
QR/check-in, disabled user sessionVersion 7 and stale invitation 6. Its raw
migration log has a recorded whitespace-only committed diff-check failure.
Its ~0.08s backup/~0.12s restore are tiny-fixture measurements, NOT RTO/RPO;
scanner/payment tables were empty and no API auth/scanner behavior was proved.
Task 243 packet `f82b26c0e741c4ee8e051e4582fb08dbc1cbd324` has independent
local-document QA/lead acceptance only, not staging qualification. Neither
historical packet is silently imported into the product candidate.

## Prior-schema choice and concrete fixture gap

Use the **migration prefix**, not an assumed deployed release: first 26 ordered
migrations, ending `20260602010000_add_payment_webhook_events`, immediately before
[account revocation](../../../tixmoapi2/prisma/migrations/20261004234000_account_revocation_and_invitations/migration.sql).
This covers all five subsequent migrations, including account and stock hazards.
Record the prefix SQL hashes and Prisma ledger in execution evidence. It is a
synthetic prior-schema baseline; actual deployed schema/data remain unknown.

Existing `verify-payment-upgrade.cjs` instead stages 27 migrations (includes
account revocation), seeds, then applies ONLY
[payment/inventory integrity](../../../tixmoapi2/prisma/migrations/20261005003000_payment_and_inventory_integrity/migration.sql).
It does not exercise all later migrations. Critically its referenced
`tixmoapi2/tests/migrations/payment-inventory-upgrade-fixture.sql` is **absent**
at this SHA (`cat` exit 1); running it unchanged cannot qualify the upgrade.
It uses `os.tmpdir()`; a future invocation must set `TMPDIR` to an owned,
restrictive disk-backed workspace runtime directory, never default `/tmp`.
Task 276 fixture is post-schema and cannot simply seed the prior prefix:
its session_version, inventory_state and staff_invitations do not yet exist.

Next implementation must supply a reviewed synthetic **pre-account-schema**
SQL fixture and adapt/stage the existing harness, not edit released migrations.
Use explicit columns valid in the 26-prefix schema. Fixture contract:

- Organization/event/buyer/recipient, legacy `admin@tixmo.com`, anonymized
  deleted account, normal customer and unscoped administrator. No real users,
  login hashes, secrets or provider intent IDs; use inert synthetic markers.
- Known tier with two paid/SOLD and one pending/HELD allocation; one uniquely
  matching historical price/window. Add ambiguous overlapping tiers, unmatched
  historical price, cancelled paid ticket on cancelled event, and inconsistent
  pre-existing tier counters; zero counters must never imply free stock.
- Transferred ticket with old saved barcode/QR and recipient identity; USED
  ticket/check-in and scan log; paid/pending/cancelled orders with durable IDs,
  amounts and historical receipt state. Do not invoke payments/mail workers.
- Historical PROCESSING/FAILED/PROCESSED webhook rows. Reuse the preservation
  pattern in [existing generation upgrade SQL](task-170-admission-qa-artifacts/upgrade.sql)
  for all original values plus attempt_generation zero after the final migration.

## Acceptance and rollback/data-preservation contract

Capture immutable before/after rows and counts, ordered migration ledger and
checksums. Expected changes must be enumerated; whole-row equality is NOT
appropriate across migrations that deliberately rotate credentials or add fields.

- Account migration: deleted users remain disabled/customer/unscoped with bumped
  session version; bootstrap admin disabled, version incremented, platform flag
  false; other unscoped admins do not become platform admins. Normal identity
  and password markers unchanged. API regression must reject disabled users,
  stale JWT/session versions and stale/expired invitations. Restored pre-upgrade
  sessions must NOT revive revoked access: apply/revalidate revocation disposition
  before any recovery API serves traffic. Password/QR rotation is one-way; do
  not roll credentials back to a formerly valid sender/bootstrap credential.
- Historical transfer rotates barcode, clears QR cache, preserves recipient,
  publishes updated_at delta and normalizes TRANSFERRED to VALID; USED/check-in
  and scan history remain intact. Old sender QR must reject; recipient and
  authorized scanner sync/scan must be checked through API, not SQL alone.
- Stock: precise known allocation preserved; ambiguous and inconsistent types
  remain REQUIRES_RECONCILIATION and checkout fails closed. No automatic READY,
  stock reset or reconciliation write. Any reconciliation needs explicit audited
  disposition and separate review. Historical USD/LEGACY_UNKNOWN receipts remain
  historical facts, not commercial currency choice or permission to resend.
- Preserve IDs, order amounts, payment references, timestamps, audit/scan data;
  generation column defaults to BIGINT zero with legacy values unchanged.

Reuse [account security tests](../../../tixmoapi2/tests/integration/account-security.test.ts),
[inventory reconciliation tests](../../../tixmoapi2/tests/integration/inventory-reconciliation.test.ts),
[payment inventory tests](../../../tixmoapi2/tests/integration/payment-inventory-integrity.test.ts)
and [offline scanner tests](../../../tixmoapi2/tests/integration/scanners-offline.test.ts)
for API acceptance design; existing tests are source inputs, NOT new passes.

Rollback: prefer forward fix retaining writes. Code-only rollback may keep the
migrated DB ONLY after exact old-code/new-schema compatibility tests, especially
stock gates, revocation and QR rejection; additive DDL alone is not compatibility.
No approved previous-code SHA currently established by this packet. Never run
inverse SQL or delete Prisma ledger entries. Dump prior-schema source before
upgrade; restore archive only into a separate NEW empty recovery database using
`pg_restore --exit-on-error --single-transaction --no-owner --no-privileges`.
Never `--clean`, overwrite source, or point an old app at customer data on faith.
Preserve source and post-upgrade writes; compare/reconcile post-backup orders,
scans and user changes before any switch, with second operator/owner approval.
A pre-upgrade backup must receive revocation/QR safety disposition before serving;
if old code cannot enforce that disposition, code rollback is unsafe: stay paused
and forward-fix. Proposed 60min RTO/15min RPO remain unmeasured, not promises.

## Bounded next executable slice (NOT executed)

1. PM assigns one DB owner and authorizes a separate fixture/harness-only task;
   no shared service or target reuse. First deliver pre-schema fixture plus
   staged 26-prefix -> all31 harness for independent lead/QA review. No migration
   edits. Confirm dependencies and generated Prisma client exist without install;
   obtain separately authorized PG17/Redis8.2.10 tooling before parity claims.
2. Safe source checks for that future task, from exact candidate checkout:

```bash
git rev-parse HEAD
git ls-files 'tixmoapi2/prisma/migrations/*/migration.sql' | wc -l
test -f tixmoapi2/tests/migrations/payment-inventory-upgrade-fixture.sql
node --check scripts/verify-payment-upgrade.cjs
```

The `test -f` is expected to fail until the fixture gap is resolved. Do not run
an unchanged harness after merely adding a guessed fixture.
3. After reviewed harness prerequisites, a fresh owned disk-backed 0700 runtime,
   scrubbed `env -i`, explicit PID/executable/datadir/listener ownership checks,
   and fresh loopback `tixmo_test_371_upgrade` database confirmed empty, the
   existing command shape is (example inputs, NOT runnable authorization now):

```bash
env -i HOME=/home/daniel PATH="$TASK371_NODE_PATH:/usr/bin:/bin" \
  TMPDIR="$TASK371_OWNED_RUNTIME" NODE_ENV=test \
  TIXMO_ALLOW_TEST_RESET=true \
  TIXMO_TEST_DATABASE_URL="$TASK371_NEW_LOOPBACK_DB" \
  DATABASE_URL="$TASK371_NEW_LOOPBACK_DB" \
  REDIS_URL="$TASK371_NEW_LOOPBACK_REDIS" \
  node scripts/verify-payment-upgrade.cjs
```

All TASK371 inputs must be set explicitly from owned synthetic local runtime,
not inherited credentials; the guard requires matching loopback `/tixmo_test_*`.
Future harness must stage prefix, seed, snapshot+dump, deploy remaining five,
assert invariants, create new recovery DB and verify rollback compatibility.
Build current API first with `npm --prefix tixmoapi2 run build` in that isolated
checkout using already available dependencies. No automatic install fallback.
Runtime teardown must verify exact owned PIDs absent and ports/sockets closed.

**NOT RUN:** empty-schema PG17 deploy, populated-prefix upgrade, fixture/harness
execution, all API/auth/QR/session regression, Redis8.2.10 behavior, dump/restore,
schema-compatible old-code rollback, credential rotation, PITR, production-volume
timing, target backups/provenance/config. Immediate executable gap is a missing
reviewed prior-schema fixture/full31 harness; version-parity tooling is a second
independent prerequisite. Parent245/fullW08 and launch remain NO-GO.
