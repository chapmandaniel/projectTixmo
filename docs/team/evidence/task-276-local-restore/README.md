# Task 276 — local synthetic logical restore rehearsal

Executed 2026-10-21 UTC by tixmo-release. Candidate/base:
`03db05ca5976fd92168acd4daae5e33821b2ff50` (task272 reviewed candidate).
Branch `tixmo/task-276-local-restore`; isolated checkout `worktrees/task-276`.

## Actual result

PASS for this bounded preparatory local rehearsal only. PostgreSQL server/client
18.6 (Ubuntu extracted user-owned task57 binaries); Redis 8.0.5 lifecycle helper
was started only to satisfy the existing target guard and shut down; no Redis
backup/state persistence is claimed. No HTTP/API, provider, email, cloud or real
customer data was used. Environment is rebuilt with `env -i`, synthetic fixture
only; no inherited URLs or credentials. No package install/config change.

Fresh mode0700 disk-backed run directory:
`/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-276/run.UWGSbu`.
Fresh source `tixmo_disposable_276` and NEW empty destination
`tixmo_disposable_276_restored`, role `tixmo276`, `127.0.0.1:24997`.
No `--clean`, drop, overwrite or source teardown SQL. Postgres cluster stopped,
its disk artifacts retained restrictively for inspection (not reusable targets).
Backup custom archive retained outside git as `run.UWGSbu/synthetic.dump`.

## Commands and acceptance

Inspected backup runbook, existing task272/274 lifecycle and client options first.
Exact executed commands and ownership/cleanup functions are in `runtime.sh`.
Reproduce from this task worktree: `bash docs/team/evidence/task-276-local-restore/runtime.sh`
(new run directory and random ports; abort on bind collision).
`bash -n` passed; complete runtime command exited 0. Existing dependency cache
at task274-272 is used only for Prisma CLI execution; schema/migrations are this
candidate's files; no install or generated-code mutation was done there.

`prisma migrate deploy --schema tixmoapi2/prisma/schema.prisma` succeeded on
fresh source. `schema-migrations.sha256` identifies all source schema/migration
files; `migrate.log` and `_prisma_migrations` row fingerprint preserve application
ledger evidence. This is empty-to-current deployment, NOT prior-schema upgrade.

Fixture: one organization, disabled user with sessionVersion7, event, ticket type
(total10/available7/sold2/held1), two orders (paid50 and pending25), three tickets
(two SOLD, one HELD, including a USED ticket with QR/checked-in state), and stale
staff invitation sessionVersion6. All values are synthetic and not usable login
or provider credentials. `fixture.sql` is the exact seed.

`acceptance.sql` asserts counts, inventory equation and allocation, QR/scan state,
disabled-user + session-version stale invitation shape, and completed migration
ledger. Every public table additionally has a sorted full-row MD5 fingerprint
and row count; all 3 snapshots compare byte-for-byte. `source-state.txt` is before
backup, `restored-state.txt` after restore, `source-after-state.txt` proves source
unchanged. Three snapshot SHA256 values are identical (see runtime.log). This
proves stored revocation data preservation, NOT that authentication/scanner/API
flows were exercised. MD5 is only an equality aid for local synthetic records;
archive integrity is captured separately with SHA256 (`backup.sha256`).

Backup: `pg_dump --format=custom --no-owner --no-privileges` on explicit source;
restore: `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges`
on freshly created template0 destination; destination asserted empty first.
Archive contents captured in `backup-toc.txt`.
Actual command wall durations from nanosecond clock: backup 0.081092928 seconds,
restore 0.118525382 seconds. These tiny-fixture measurements exclude startup,
seed, comparison and app recovery. They are NOT RTO/RPO commitments or benchmarks.

## Cleanup and remaining gates

Exact PID ownership, executable, datadir and loopback listeners checked before
SQL. PG PID2624104 and Redis PID2624135 shut down; post-run independent checks
recorded in `cleanup.txt`: both absent, ports24997/57074 have no listeners, no PG
PID file or Redis socket. HTTP not started. No unrelated process was signalled.

Independent QA must review this exact implementation SHA and rerun/check the
harness. Author submits review, not done. No merge/push/deploy authorized.
Full W08 remains open: Postgres17/Redis8.2.10 parity, populated-prior-schema
upgrade, target/staging backup access and restore, schema-compatible code rollback,
app login/reports/scanner/links smoke, scheduled backup retention/PITR, rotation
and session invalidation disposition, production-sized timing and approved RTO/RPO
have NOT been qualified. Launch remains NO-GO.

Commit tooling limitation: default pre-commit hook cannot load missing
`tixmoapi2/.husky/_/husky.sh` in fresh checkout. No install attempted; this
SQL/bash/evidence-only commit uses command-scoped `core.hooksPath=/dev/null`.
The hook's lint-staged did not run; `bash -n`, `git diff --check` and actual
migration/backup/restore/acceptance were run explicitly as recorded above.
