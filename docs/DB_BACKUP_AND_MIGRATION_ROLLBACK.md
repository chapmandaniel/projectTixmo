# Production DB Backup And Migration Rollback

Use this before any production schema migration, seed, or manual database repair.
Do not mark the production launch checklist complete until the evidence section is filled for the target environment.

## Scope

- Database: production PostgreSQL.
- App service: Tixmo API.
- Migration command: `npm --prefix tixmoapi2 run migrate`.
- Backup goal: restore the production database to the exact pre-migration state or to a verified point in time.
- Rollback goal: recover service within the launch window without guessing which database state matches the deployed API.

## Required Evidence

Capture this in the launch ticket before migration:

- Railway project, environment, API service, and Postgres service names or IDs.
- Current API deployment ID, git SHA, and `SENTRY_RELEASE`.
- Current `DATABASE_URL` variable target, redacted to host/service name only.
- Latest successful scheduled backup timestamp and retention policy.
- Manual pre-migration backup ID or timestamp.
- Optional logical backup file path, object-store key, checksum, and row-count spot checks.
- Output of `npm --prefix tixmoapi2 run build`.
- Output of `npm run verify:api`.
- Output of `npm --prefix tixmoapi2 run migrate`.
- Post-migration smoke evidence.

## Preflight

1. Freeze event setup and admin repair work for the migration window.
2. Confirm the API deployment you intend to migrate is the same release you intend to run.
3. Confirm the dashboard is pointed at the same API environment.
4. Confirm `SERVICE_NAME`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, and `SENTRY_ALERT_ROUTE` are set.
5. Confirm the Postgres service has scheduled backups enabled.
6. Trigger a manual backup immediately before migration.
7. Confirm the manual backup appears in the provider UI before running migrations.
8. Run local gates:

```bash
npm --prefix tixmoapi2 run build
npm run verify:api
```

## Backup Procedure

Railway supports manual and scheduled backups for services with mounted volumes, including database services. Schedules can be daily, weekly, or monthly, and backups are managed from the service settings Backup tab. Use the provider backup as the primary restore point.

For extra portability, create a logical backup before the migration when the database size allows it:

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "backups/tixmo-prod-pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Then capture a checksum:

```bash
shasum -a 256 backups/tixmo-prod-pre-migration-*.dump
```

Do not store backup files in git. Store them in the approved secure location for launch operations.

## Migration Procedure

1. Verify migration files are committed and ordered in `tixmoapi2/prisma/migrations`.
2. Check the Prisma migration status against production with the production `DATABASE_URL`.
3. Run the deploy migration exactly once:

```bash
npm --prefix tixmoapi2 run migrate
```

4. Restart or redeploy the API only if the deploy platform does not do this automatically.
5. Run smoke checks:
   - Health endpoint.
   - Login.
   - Create/read event.
   - Create paid order in staging or production-like environment.
   - Scanner sync/scan if this migration touches tickets, orders, scanners, or events.
6. Check Sentry for a clean release and no new migration-related errors.

## Rollback Decision Tree

### Code-only issue

If migrations succeeded and the schema is compatible with the previous API:

1. Roll back the API deployment to the last known good release.
2. Keep the migrated database.
3. Run smoke checks.
4. Keep the migration marked as deployed; create a forward-fix migration if schema cleanup is needed.

### Schema issue before customer writes

If the schema is bad and no new customer writes need to be preserved:

1. Keep the incident window frozen.
2. Restore the manual pre-migration backup or PITR target to a new database service when available.
3. Point a staging/recovery API service at the restored database.
4. Run smoke checks.
5. Switch production `DATABASE_URL` only after verification and second-operator approval.
6. Redeploy the last known good API release.

### Schema issue after customer writes

If new paid orders, scans, approvals, or user changes happened after migration:

1. Do not overwrite production immediately.
2. Restore backup/PITR to a separate recovery database.
3. Compare critical records created after the restore point.
4. Choose one:
   - Forward-fix migration if data can be preserved safely.
   - Planned restore plus manual replay/import of verified post-restore customer writes.
5. Require second-operator approval and launch-owner signoff.

## Restore Verification

A backup is not launch-ready until a restore has been tested outside production.

1. Restore the latest scheduled or manual backup to a staging/recovery database.
2. Point a non-production API service at the restored database.
3. Run these checks:

```bash
npm --prefix tixmoapi2 run build
```

Then verify through the app/API:

- Admin login works.
- Recent production-like event is readable.
- Orders and tickets are readable.
- Reports totals load.
- Scanner sync loads tickets for an event.
- Asset share and approval links that should still be valid still resolve.

## Launch Checklist Entry

Only check off "Production backup and rollback are confirmed" when all of these are true:

- Scheduled production backups are enabled.
- A manual pre-migration backup was created for this release.
- Restore was tested in staging/recovery.
- The restore evidence is attached to the launch ticket.
- The rollback owner and second approver are named.
- The last known good API deployment ID is recorded.
- The migration command and smoke-test result are recorded.

## References

- Railway backups: https://docs.railway.com/volumes/backups
- Railway point-in-time recovery: https://docs.railway.com/volumes/point-in-time-recovery
- PostgreSQL backup and restore: https://www.postgresql.org/docs/current/backup.html

## Asset-share ciphertext before authentication key rotation

Stored folder-share tokens have a separate server-only `ASSET_SHARE_ENCRYPTION_KEY`
(32 random bytes encoded as 64 lowercase hex characters). Configure it through the
runtime secret manager before enabling new share creation; absence or malformed
configuration returns 503 for new shares. Never put this key in dashboard/Vite
configuration. New `v2` AES-GCM envelopes authenticate their format/domain. Existing
`v1` envelopes remain readable using `ASSET_SHARE_LEGACY_SECRET` when explicitly
provided, otherwise the existing refresh/JWT/session-secret precedence. The legacy
secret is the original secret string, not its hash. Do not change or remove legacy
decryption configuration until a complete actual rekey and link-verification proof.

After building the API, run `node prisma/rekey-asset-shares.js` from `tixmoapi2`
using an explicitly supplied runtime `TIXMO_ASSET_REKEY_DATABASE_URL` (must match
`DATABASE_URL` when present). This defaults to audit with at most 1000 rows.
`--limit 1..10000` changes that bound; `--organization-id UUID` selects one tenant.
The entire selected set must fit the bound and decrypt/hash-verify, including
expired and revoked shares. Unknown formats, absent ciphertext, corruption or
mismatched hashes fail closed. No record identifiers or token material are output.

Apply requires both `--apply` and runtime `TIXMO_ALLOW_ASSET_SHARE_REKEY=true`.
One bounded transaction rewrites only legacy ciphertext using a compare-and-swap
on identity, organization, original hash and ciphertext; a conflict rolls back the
transaction. Scope, hash, recipient, timestamps (including `updatedAt`), expiry,
revocation, views and public URLs remain unchanged. Replay reports zero updates.
An audit after apply must report zero legacy rows for the **complete database**;
a scoped or bounded failure is not completion proof. Retain the dedicated key in
backup/restore planning independently of authentication secrets. This command is
not an actual target backup, rekey, key retirement or auth-rotation acceptance.

Cutover order is mandatory: first deploy the reviewed `v2` writer with the fresh
asset key and unchanged old authentication keys. Verify every active API worker
is on that version (including the expected replica count). Only then run the
reviewed audit/apply command and obtain an unscoped audit with zero legacy rows,
plus actual link checks. An old worker can create new `v1` rows after a rekey;
pre-deploy rekey alone cannot prove completion. Only after this proof may the
authentication key family rotate. A killed command, failed transaction, bound
failure or CAS conflict is not completion: retain legacy configuration, audit
again, and explicitly retry. No automatic retry or legacy-key retirement occurs.

A separately authorized hash-only preservation policy requires BOTH
`--preserve-hash-only` and runtime
`TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION=true`. Without both, the default audit
remains strict. This policy accepts only actual SQL NULL ciphertext with a canonical
64-character lowercase hexadecimal bearer hash. It preserves those rows, joins and
metadata unchanged; empty or corrupt non-NULL ciphertext still aborts the whole
operation before writes. Apply still requires its separate apply flag and opt-in.

The separate `hashOnly` count is unverified and nonreconstructable: it proves neither
historical provenance nor possession of the original bearer. Existing public bearer
links continue to use their unchanged hashes; staff cannot reconstruct these links.
Only verified v1 ciphertext is rewritten. A complete final audit must separately
report zero legacy rows and separately enumerate current ciphertext and hash-only
counts; never describe all rows
as cryptographically verified or infer provenance from these counts. Existing
cutover, link checks, interruption and legacy-key-retirement gates still apply.

For visible read-only startup diagnostics, set `TIXMO_ASSET_SHARE_AUDIT_ON_START=true`.
It remains a strict audit unless BOTH
`TIXMO_ASSET_SHARE_AUDIT_PRESERVE_HASH_ONLY_ON_START=true` and
`TIXMO_ALLOW_HASH_ONLY_SHARE_PRESERVATION=true` are explicitly set. The preservation
selector alone does nothing without the parent audit flag. Retained encrypted-link
observation requires BOTH `TIXMO_ASSET_LINK_CHECK_ON_START=true` and
`TIXMO_ASSET_LINK_CHECK=true`; normal public GETs may increment share view counters.
These hooks never apply rekey. They run after migration (the link observer also
follows the optional Stripe probe); any failure prevents API startup. Keep a healthy
qualified API available when observing links. Clear temporary flags after collecting
actual complete decoded audit/link counts. Deployment success alone is not proof.
Apply remains an explicitly authorized one-shot pre-deploy operation after the
visible audit; all existing writer cutover, key retention and final-proof gates apply.
