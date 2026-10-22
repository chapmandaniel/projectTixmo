# Live wiring, migration ledger and recovery preflight

Owner: moosey / 231. Authority: BB231-520-20261022-LOCAL-RECOVERY-PATH.
Candidate: `a5da21936f4e0c730cab448610d9ecc75d2ef398` (PR75).
Supplement to TASK_231_RAILWAY_LIVE_EVIDENCE_2026_10_22.md, not deploy approval.

## Executed read-only checks

The inspected `scripts/railway-wiring-redacted.py` captures raw Railway responses
inside its process. It emits only allowlisted IDs, reference-match booleans and
approved database metadata. CLI stderr and exceptions are suppressed rather
than echoed. No credentials/connection strings are arguments, printed, persisted
or included in this receipt. Existing CLI authentication was reused. The
aws-secrets-manager skill was read; no AWS secret retrieval was involved.

Offline self-test PASS: sentinel secret omitted, references mapped correctly,
literal values do not falsely establish wiring, incorrect target fails closed.
`git diff --check` PASS. These are parent checks, not independent security QA.

`--read-only` actual result:

- API DATABASE_URL references exact target Postgres service `e9448ee8-7c8e-4311-8f0c-d935930dd99b`.
- API REDIS_URL references exact Redis service `22ca3ef4-ffb2-4b91-bb18-51b5ea9c5c29`.
- Dashboard VITE_API_URL exists but is a literal, not a service reference. Its
  actual API-origin match remains UNVERIFIED; its value was not emitted.
- VITE_API_BASE_URL and REACT_APP_API_URL absent on dashboard.

`--catalog` actual result: resolved API/Postgres host/port/database/user identity
matched internally; the same service's public proxy database/user was checked
before connecting. TLS required. Fixed metadata-only SQL: BEGIN READ ONLY,
statement_timeout 5s, lock_timeout 1s, bounded ledger LIMIT500, ROLLBACK. Connection
timeout5s, client deadline25s. One execution, no retry, no application rows or
ledger logs read. No migrations/backup/restore ran.

- Actual server: PostgreSQL18.6 (Debian package18.6-1.pgdg13+2).
- Database size aggregate: 10,368,703 bytes (not dump-size or timing proof).
- Returned31 migration records, all finished, no rolled_back_at; each reports
  applied_steps_count1. No failed/incomplete entry returned.
- Parent compared every returned migration name/checksum with `git show`
  candidate SQL bytes and Python SHA256: all31 match. This was a comparison
  of displayed inventories, not a new automated invariant or independent QA.
- Candidate contains32 migration SQL files. Sole unapplied candidate migration:
  `20261021120000_event_sales_pause`, SHA256
  `4e29bed1e8ef7ba93b84a106d497677926790303449f2ab0f07d2e213618feb1`.

Ledger equality does NOT establish absence of manual schema drift. Catalog
table/column/index/constraint comparison still required. Pending migration adds
events.sales_paused defaultfalse, audit table, RESTRICT FK and two indexes.
ALTER TABLE requires locking; small database size is not evidence of no blockers
or a safe window. No lock probe/DDL/runtime operation was run.

## Startup source resolution

Railway documentation fetched 2026-10-22:
https://docs.railway.com/config-as-code states configuration in code always
overrides dashboard settings; dashboard values are not updated to mirror files.
Both deployed `ebfbce7d` and candidate `a5da2193` config source specify:
`/bin/sh -c 'npm run migrate && exec node dist/index.js'`.
`migrate` is `prisma migrate deploy`. Candidate compatibility db:seed is a
console-only no-op. Thus the observed differing dashboard start setting is not
on its own evidence that seed runs; code-config precedence resolves the source
ambiguity. Actual effective deployment-detail origin still needs independently
verified target receipt before operational approval. No config changed.

Documentation additionally says existing config-as-code ends2026-12-01. This is
a future configuration maintenance dependency, not authority to change it now.

## Existing local recovery resources

Version-only commands under scrubbed environment confirm known task57 cached
pg_dump and pg_restore18.6. No tool install/download, server start or synthetic
rehearsal. Host disk233G, available160G. Existing runtime mode0700 ownerdaniel.
Root is ext4 directly on nvme0n1p2; encrypted recovery storage is NOT established
by this inventory. gpg executable exists; bwrap not found on PATH. Tool presence
does not establish usable encryption keys, containment or backup authorization.

Before any real-data dump/restore: approved restricted encrypted destination,
key/retention/data custodian, independent-reviewed restore network/process
containment, zero incremental Railway cost/allocation, bounded source load,
operator and independent reviewer acknowledgements and explicit operational
grant. None is fabricated here. No production data copied or backups created.

Remaining: dashboard-origin identity, catalog drift/compatibility, encrypted
storage/containment/cost proof, named operators and second approval, exact
cutover/rollback smoke plan and proxy operational grant. PRs remain unmerged;
existing no-backup/schedule finding and migration-triggering merge hold persist.

## Independent review and corrective successor

Independent task553 verdict `f78725be` CHANGES REQUIRED against395cafb7:
catalog output values were not fully bounded/validated; extra service IDs could
escape the fixed allowlist; SQL failure emitted a failure JSON but exited0;
internal URL schemes were unchecked; LIMIT500 could silently truncate. TLS
`require` encrypted the historical connection but did NOT verify the peer's
certificate hostname. Preserve that historical limitation and the reported
ledger; no unchanged live query rerun is needed or claimed.

Author corrective successor rejects non-Postgres URLs/private target mismatches,
noncanonical timestamps/types/duplicate migrations,500-or-more ledger entries,
oversized responses and nonfixed service IDs. Server version emits only a
validated18.x numeric value, not an arbitrary package suffix. SQL failure exits1.
Future client connections require `verify-full` and the existing system CA
bundle; no silent `require` fallback. Availability of a trusted matching server
certificate is NOT asserted by offline tests and no new live connection ran.
Seven offline unittest methods exercise adversarial field mutations, output
sentinels, failure propagation, target rejection before connection and fixed
read-only/TLS/timeout command construction; all PASS. Embedded self-test and
diff checks PASS. Exact corrective successor still requires independent553
review before further live use; earlier receipt is not promoted to no-drift or
restore readiness.
